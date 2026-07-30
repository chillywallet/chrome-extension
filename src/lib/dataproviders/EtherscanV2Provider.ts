import { CoinHolding, NFT, NFTList } from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import { RateLimiters } from '../../shared/utils/rateLimiter';
import { buildTransaction } from './classify';
import { DataProvider, MissingApiKeyError, ProviderContext } from './DataProvider';
import { fetchJson } from './http';
import { buildNativeHolding, buildTokenHolding } from './holdings';
import {
    NftPage,
    RawTransaction,
    RawTransfer,
    TxPage,
    emptyTxPage,
    makePagination,
} from './types';

/**
 * Etherscan V2 multichain adapter (one free API key for all supported chains,
 * routed by the `chainid` query parameter). Also works for other
 * Etherscan-compatible APIs (e.g. Routescan) — leave `apiKeyRef` unset in the
 * chain config when no key is needed.
 *
 * Endpoints (module=account):
 * - action=balance                  → native coin balance
 * - action=tokentx                  → ERC-20 transfer history (token discovery too)
 * - action=txlist / txlistinternal  → transaction history
 * - action=tokennfttx / token1155tx → NFT transfer history (ownership derived)
 *
 * Free-tier note: token *balances* per address are a Pro endpoint, so holdings
 * are discovered from transfer history with balance 0 and refreshed on-chain
 * by the existing TransactionController.getTokenBalance path.
 */
export class EtherscanV2Provider implements DataProvider {
    readonly kind = 'etherscan';

    #context: ProviderContext;

    constructor(context: ProviderContext) {
        this.#context = context;
    }

    #url(params: Record<string, string | number>): string {
        const config = this.#context.config;
        const search = new URLSearchParams({
            chainid: String(this.#context.chain.chain_id),
            module: 'account',
            ...Object.fromEntries(
                Object.entries(params).map(([key, value]) => [key, String(value)]),
            ),
        });

        if (this.#context.config.apiKeyRef) {
            if (!this.#context.apiKey) {
                throw new MissingApiKeyError(this.#context.config.apiKeyRef);
            }
            search.set('apikey', this.#context.apiKey);
        }

        return `${config.baseUrl}?${search}`;
    }

    async #call(params: Record<string, string | number>): Promise<any[]> {
        const payload = await fetchJson(RateLimiters.etherscan, this.#url(params));

        // status '0' + "No transactions found" is a legitimate empty result
        if (payload?.status === '0' && !Array.isArray(payload?.result)) {
            return [];
        }

        return Array.isArray(payload?.result) ? payload.result : [];
    }

    async getTokenHoldings(address: string): Promise<CoinHolding[]> {
        const chain = this.#context.chain;
        const holdings: CoinHolding[] = [];

        // Native balance (action=balance returns a plain string result)
        try {
            const payload = await fetchJson(
                RateLimiters.etherscan,
                this.#url({ action: 'balance', address, tag: 'latest' }),
            );
            const balance =
                Number(payload?.result ?? 0) / 10 ** (chain.native_coin_decimals ?? 18);
            holdings.push(buildNativeHolding(chain, address, balance));
        } catch (error) {
            if (error instanceof MissingApiKeyError) {
                throw error;
            }
            logger.log('Etherscan: native balance unavailable', error);
            holdings.push(buildNativeHolding(chain, address, 0));
        }

        // Token discovery from transfer history (balances refreshed on-chain later)
        try {
            const transfers = await this.#call({
                action: 'tokentx',
                address,
                page: 1,
                offset: 300,
                sort: 'desc',
            });

            const seen = new Set<string>();

            transfers.forEach((entry: any) => {
                const tokenAddress = (entry?.contractAddress ?? '').toLowerCase();

                if (!tokenAddress || seen.has(tokenAddress)) {
                    return;
                }
                seen.add(tokenAddress);

                holdings.push(
                    buildTokenHolding(chain, address, {
                        tokenAddress,
                        name: entry?.tokenName ?? '',
                        symbol: entry?.tokenSymbol ?? '',
                        decimals: Number(entry?.tokenDecimal ?? 18),
                        balance: 0, // live balance read on-chain
                    }),
                );
            });
        } catch (error) {
            if (error instanceof MissingApiKeyError) {
                throw error;
            }
            logger.log('Etherscan: token discovery unavailable', error);
        }

        return holdings;
    }

    async getTransactions(
        address: string,
        page: number,
        size: number,
        tokenAddress?: string,
    ): Promise<TxPage> {
        const chain = this.#context.chain;
        const nativeDecimals = chain.native_coin_decimals ?? 18;

        try {
            let rawTxs: RawTransaction[];

            if (tokenAddress) {
                const transfers = await this.#call({
                    action: 'tokentx',
                    address,
                    contractaddress: tokenAddress,
                    page,
                    offset: size,
                    sort: 'desc',
                });
                rawTxs = this.#groupTransfers(transfers, nativeDecimals);
            } else {
                const [txs, tokenTransfers] = await Promise.all([
                    this.#call({ action: 'txlist', address, page, offset: size, sort: 'desc' }),
                    this.#call({
                        action: 'tokentx',
                        address,
                        page,
                        offset: size,
                        sort: 'desc',
                    }),
                ]);

                const byHash = new Map<string, RawTransaction>();

                txs.forEach((tx: any) => {
                    byHash.set(tx.hash, {
                        hash: tx.hash,
                        from: tx.from ?? '',
                        to: tx.to ?? tx.contractAddress ?? '',
                        value: Number(tx.value ?? 0) / 10 ** nativeDecimals,
                        fee:
                            (Number(tx.gasUsed ?? 0) * Number(tx.gasPrice ?? 0)) /
                            10 ** nativeDecimals,
                        success: tx.isError !== '1',
                        timestamp: Number(tx.timeStamp ?? 0),
                        block: Number(tx.blockNumber ?? 0),
                        method: tx.methodId && tx.methodId !== '0x' ? tx.methodId : '',
                        hasData: Boolean(tx.input && tx.input !== '0x'),
                        transfers: [],
                    });
                });

                tokenTransfers.forEach((entry: any) => {
                    const transfer = this.#toRawTransfer(entry);
                    const existing = byHash.get(entry.hash);

                    if (existing) {
                        existing.transfers.push(transfer);
                    } else {
                        byHash.set(entry.hash, {
                            hash: entry.hash,
                            from: entry.from ?? '',
                            to: entry.to ?? '',
                            value: 0,
                            fee: 0,
                            success: true,
                            timestamp: Number(entry.timeStamp ?? 0),
                            block: Number(entry.blockNumber ?? 0),
                            method: 'transfer',
                            hasData: true,
                            transfers: [transfer],
                        });
                    }
                });

                rawTxs = Array.from(byHash.values()).sort(
                    (a, b) => Number(b.timestamp) - Number(a.timestamp),
                );
            }

            return {
                data: rawTxs.map(raw =>
                    buildTransaction(
                        raw,
                        address,
                        chain.chain_id,
                        chain.native_coin_symbol,
                        chain.native_coin_address,
                    ),
                ),
                pagination: makePagination(page, size, rawTxs.length >= size),
            };
        } catch (error) {
            if (error instanceof MissingApiKeyError) {
                throw error;
            }
            logger.log('Etherscan: transactions unavailable', error);
            return emptyTxPage(page);
        }
    }

    #groupTransfers(entries: any[], nativeDecimals: number): RawTransaction[] {
        const byHash = new Map<string, RawTransaction>();

        entries.forEach((entry: any) => {
            const transfer = this.#toRawTransfer(entry);
            const existing = byHash.get(entry.hash);

            if (existing) {
                existing.transfers.push(transfer);
                return;
            }

            byHash.set(entry.hash, {
                hash: entry.hash,
                from: entry.from ?? '',
                to: entry.to ?? '',
                value: 0,
                fee:
                    (Number(entry.gasUsed ?? 0) * Number(entry.gasPrice ?? 0)) /
                    10 ** nativeDecimals,
                success: true,
                timestamp: Number(entry.timeStamp ?? 0),
                block: Number(entry.blockNumber ?? 0),
                method: 'transfer',
                hasData: true,
                transfers: [transfer],
            });
        });

        return Array.from(byHash.values());
    }

    #toRawTransfer(entry: any): RawTransfer {
        const decimals = Number(entry?.tokenDecimal ?? 18);
        const isNft = entry?.tokenID !== undefined && entry?.tokenDecimal === undefined;

        return {
            from: entry?.from ?? '',
            to: entry?.to ?? '',
            tokenAddress: entry?.contractAddress ?? '',
            symbol: entry?.tokenSymbol ?? '',
            decimals,
            amount: isNft ? 1 : Number(entry?.value ?? 0) / 10 ** decimals,
            isNft,
            tokenId: entry?.tokenID ?? null,
            nftName: isNft ? (entry?.tokenName ?? '') : '',
            name: entry?.tokenName ?? '',
        };
    }

    async getNFTs(
        address: string,
        search: string,
        page: number,
        size: number,
    ): Promise<NftPage> {
        const chain = this.#context.chain;
        const wallet = address.toLowerCase();

        try {
            // Derive current ownership from the full ERC-721 transfer history.
            const transfers = await this.#call({
                action: 'tokennfttx',
                address,
                page: 1,
                offset: 1000,
                sort: 'asc',
            });

            const owned = new Map<string, any>(); // `${contract}:${tokenId}` -> latest entry

            transfers.forEach((entry: any) => {
                const key = `${(entry.contractAddress ?? '').toLowerCase()}:${entry.tokenID}`;

                if ((entry.to ?? '').toLowerCase() === wallet) {
                    owned.set(key, entry);
                } else if ((entry.from ?? '').toLowerCase() === wallet) {
                    owned.delete(key);
                }
            });

            const searchLower = search.trim().toLowerCase();
            const collections = new Map<string, NFTList>();

            owned.forEach(entry => {
                const contractAddress = (entry.contractAddress ?? '').toLowerCase();
                const collectionName = entry.tokenName ?? 'Unknown Collection';
                const nftName = `${collectionName} #${entry.tokenID}`;

                if (searchLower && !nftName.toLowerCase().includes(searchLower)) {
                    return;
                }

                const nft: NFT = {
                    _id: `${contractAddress}:${entry.tokenID}`,
                    wallet_address: wallet,
                    contract: { type: 'ERC-721', name: collectionName },
                    contract_address: contractAddress,
                    current_usd_value: 0,
                    image_url: '',
                    token_id: String(entry.tokenID),
                    nft_collection: {
                        _id: contractAddress,
                        collection_id: contractAddress,
                        floor_price: 0,
                        image_url: '',
                        marketplace_pages: [],
                        name: collectionName,
                        spam_score: 0,
                    },
                    name: nftName,
                    previews: { blurhash: '', image_medium_url: '', image_small_url: '' },
                    video_url: null,
                    audio_url: null,
                    chain: chain.chain_key,
                    platform_id: chain.platform_id,
                };

                const existing = collections.get(contractAddress);

                if (existing) {
                    existing.nftDetails.push(nft);
                } else {
                    collections.set(contractAddress, {
                        _id: contractAddress,
                        name: collectionName,
                        address: contractAddress,
                        platform_id: chain.platform_id,
                        integration_type: 'wallet',
                        spamThreshold: 100,
                        nftDetails: [nft],
                    });
                }
            });

            const all = Array.from(collections.values());
            const start = (page - 1) * size;
            const paged = all.slice(start, start + size);

            return {
                nfts: paged,
                pagination: makePagination(page, size, start + size < all.length),
            };
        } catch (error) {
            if (error instanceof MissingApiKeyError) {
                throw error;
            }
            logger.log('Etherscan: NFTs unavailable', error);
            return { nfts: [], pagination: null };
        }
    }
}
