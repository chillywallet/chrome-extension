import { NFT, NFTList, CoinHolding } from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import { RateLimiters } from '../../shared/utils/rateLimiter';
import { buildTransaction } from './classify';
import { DataProvider, ProviderContext } from './DataProvider';
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
 * Blockscout instance adapter (REST API v2, no API key required).
 *
 * Endpoints used:
 * - GET /api/v2/addresses/{addr}                → native coin balance
 * - GET /api/v2/addresses/{addr}/token-balances → ERC-20/721/1155 balances w/ metadata
 * - GET /api/v2/addresses/{addr}/transactions   → transactions (keyset pagination)
 * - GET /api/v2/addresses/{addr}/token-transfers?transaction_hash=… (per-tx enrichment
 *   is skipped — the tx payload already carries transfer summaries where available)
 * - GET /api/v2/addresses/{addr}/nft            → NFT instances
 *
 * Blockscout paginates with `next_page_params` (keyset), not page numbers, so
 * this adapter keeps a cursor map per (address, resource) and supports the
 * sequential page access pattern the UI uses (infinite scroll).
 */
export class BlockscoutProvider implements DataProvider {
    readonly kind = 'blockscout';

    #context: ProviderContext;
    /** cursorKey -> next_page_params for the NEXT page (page numbers are 1-based). */
    #cursors = new Map<string, Record<string, any> | null>();

    constructor(context: ProviderContext) {
        this.#context = context;
    }

    get #base() {
        return this.#context.config.baseUrl.replace(/\/$/, '');
    }

    async getTokenHoldings(address: string): Promise<CoinHolding[]> {
        const chain = this.#context.chain;
        const holdings: CoinHolding[] = [];

        // Native coin
        try {
            const info = await fetchJson(
                RateLimiters.blockscout,
                `${this.#base}/api/v2/addresses/${address}`,
            );
            const nativeBalance =
                Number(info?.coin_balance ?? 0) / 10 ** (chain.native_coin_decimals ?? 18);
            holdings.push(buildNativeHolding(chain, address, nativeBalance));
        } catch (error) {
            // A fresh address 404s — still show the native coin row.
            logger.log('Blockscout: address info unavailable', error);
            holdings.push(buildNativeHolding(chain, address, 0));
        }

        try {
            const balances = await fetchJson<any[]>(
                RateLimiters.blockscout,
                `${this.#base}/api/v2/addresses/${address}/token-balances`,
            );

            (balances ?? []).forEach(entry => {
                const token = entry?.token;
                const tokenAddress = token?.address ?? token?.address_hash;

                if (!tokenAddress || token.type !== 'ERC-20') {
                    return;
                }

                const decimals = Number(token.decimals ?? 18);
                const balance = Number(entry.value ?? 0) / 10 ** decimals;

                holdings.push(
                    buildTokenHolding(chain, address, {
                        tokenAddress,
                        name: token.name ?? token.symbol ?? '',
                        symbol: token.symbol ?? '',
                        decimals,
                        balance,
                        logo: token.icon_url ?? '',
                    }),
                );
            });
        } catch (error) {
            logger.log('Blockscout: token balances unavailable', error);
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
        const cursorKey = `tx:${address.toLowerCase()}:${tokenAddress ?? ''}`;

        const params = new URLSearchParams();
        if (page > 1) {
            const cursor = this.#cursors.get(`${cursorKey}:${page}`);
            if (!cursor) {
                return emptyTxPage(page); // sequential access only
            }
            Object.entries(cursor).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    params.set(key, String(value));
                }
            });
        }

        const url = tokenAddress
            ? `${this.#base}/api/v2/addresses/${address}/token-transfers?token=${tokenAddress}&${params}`
            : `${this.#base}/api/v2/addresses/${address}/transactions?${params}`;

        let payload: any;
        try {
            payload = await fetchJson(RateLimiters.blockscout, url);
        } catch (error) {
            logger.log('Blockscout: transactions unavailable', error);
            return emptyTxPage(page);
        }

        const items: any[] = payload?.items ?? [];
        const nextPageParams = payload?.next_page_params ?? null;
        this.#cursors.set(`${cursorKey}:${page + 1}`, nextPageParams);

        const nativeDecimals = chain.native_coin_decimals ?? 18;

        const rawTxs: RawTransaction[] = tokenAddress
            ? items.map(item => this.#tokenTransferToRawTx(item, nativeDecimals))
            : items.map(item => this.#txToRawTx(item, nativeDecimals));

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
            pagination: makePagination(page, items.length, Boolean(nextPageParams)),
        };
    }

    #txToRawTx(item: any, nativeDecimals: number): RawTransaction {
        const transfers: RawTransfer[] = (item?.token_transfers ?? [])
            .map((transfer: any) => this.#toRawTransfer(transfer))
            .filter(Boolean);

        return {
            hash: item?.hash ?? '',
            from: item?.from?.hash ?? '',
            to: item?.to?.hash ?? item?.created_contract?.hash ?? '',
            value: Number(item?.value ?? 0) / 10 ** nativeDecimals,
            fee: Number(item?.fee?.value ?? 0) / 10 ** nativeDecimals,
            success: item?.status ? item.status === 'ok' : true,
            timestamp: item?.timestamp ?? new Date(0).toISOString(),
            block: Number(item?.block_number ?? item?.block ?? 0),
            method: item?.method ?? '',
            hasData: (item?.tx_types ?? item?.transaction_types ?? []).includes(
                'contract_call',
            ),
            transfers,
        };
    }

    #tokenTransferToRawTx(item: any, nativeDecimals: number): RawTransaction {
        const transfer = this.#toRawTransfer(item);

        return {
            hash: item?.transaction_hash ?? item?.tx_hash ?? '',
            from: item?.from?.hash ?? '',
            to: item?.to?.hash ?? '',
            value: 0,
            fee: 0,
            success: true,
            timestamp: item?.timestamp ?? new Date(0).toISOString(),
            block: Number(item?.block_number ?? 0),
            method: item?.method ?? 'transfer',
            hasData: true,
            transfers: transfer ? [transfer] : [],
        };
    }

    #toRawTransfer(transfer: any): RawTransfer | null {
        const token = transfer?.token;
        const tokenAddress = token?.address ?? token?.address_hash;

        if (!tokenAddress) {
            return null;
        }

        const decimals = Number(token.decimals ?? 0);
        const isNft = token.type === 'ERC-721' || token.type === 'ERC-1155';
        const rawValue = transfer?.total?.value ?? transfer?.total?.token_id ?? 0;
        const amount = isNft
            ? Number(transfer?.total?.value ?? 1)
            : Number(rawValue) / 10 ** (decimals || 18);

        return {
            from: transfer?.from?.hash ?? '',
            to: transfer?.to?.hash ?? '',
            tokenAddress,
            symbol: token.symbol ?? '',
            decimals: decimals || 18,
            amount,
            isNft,
            tokenId: transfer?.total?.token_id ?? null,
            nftName: isNft ? (token.name ?? '') : '',
            logo: token.icon_url ?? '',
            name: token.name ?? '',
        };
    }

    async getNFTs(
        address: string,
        search: string,
        page: number,
        size: number,
    ): Promise<NftPage> {
        const chain = this.#context.chain;
        const cursorKey = `nft:${address.toLowerCase()}`;

        const params = new URLSearchParams({ type: 'ERC-721,ERC-1155' });
        if (page > 1) {
            const cursor = this.#cursors.get(`${cursorKey}:${page}`);
            if (!cursor) {
                return { nfts: [], pagination: makePagination(page, 0, false) };
            }
            Object.entries(cursor).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    params.set(key, String(value));
                }
            });
        }

        let payload: any;
        try {
            payload = await fetchJson(
                RateLimiters.blockscout,
                `${this.#base}/api/v2/addresses/${address}/nft?${params}`,
            );
        } catch (error) {
            logger.log('Blockscout: NFTs unavailable', error);
            return { nfts: [], pagination: null };
        }

        const items: any[] = payload?.items ?? [];
        const nextPageParams = payload?.next_page_params ?? null;
        this.#cursors.set(`${cursorKey}:${page + 1}`, nextPageParams);

        const searchLower = search.trim().toLowerCase();
        const collections = new Map<string, NFTList>();

        items.forEach(item => {
            const token = item?.token ?? {};
            const contractAddress = (token.address ?? token.address_hash ?? '').toLowerCase();

            if (!contractAddress) {
                return;
            }

            const collectionName = token.name ?? 'Unknown Collection';
            const nftName =
                item?.metadata?.name ?? `${collectionName} #${item?.id ?? ''}`;

            if (
                searchLower &&
                !collectionName.toLowerCase().includes(searchLower) &&
                !String(nftName).toLowerCase().includes(searchLower)
            ) {
                return;
            }

            const imageUrl = item?.image_url ?? item?.metadata?.image ?? '';

            const nft: NFT = {
                _id: `${contractAddress}:${item?.id ?? ''}`,
                wallet_address: address.toLowerCase(),
                contract: { type: token.type ?? 'ERC-721', name: collectionName },
                contract_address: contractAddress,
                current_usd_value: 0,
                image_url: imageUrl,
                token_id: String(item?.id ?? ''),
                nft_collection: {
                    _id: contractAddress,
                    collection_id: contractAddress,
                    floor_price: 0,
                    image_url: imageUrl,
                    marketplace_pages: [],
                    name: collectionName,
                    spam_score: 0,
                },
                name: String(nftName),
                description: item?.metadata?.description ?? '',
                previews: {
                    blurhash: '',
                    image_medium_url: imageUrl,
                    image_small_url: imageUrl,
                },
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

        return {
            nfts: Array.from(collections.values()),
            pagination: makePagination(page, items.length, Boolean(nextPageParams)),
        };
    }
}
