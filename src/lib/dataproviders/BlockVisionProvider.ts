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
    TxPage,
    emptyTxPage,
    makePagination,
} from './types';

/**
 * BlockVision Monad indexer adapter (free API key required, ~2 QPS).
 *
 * Endpoints (Monad Indexing API):
 * - GET /account/tokens?address=…&pageIndex=…       → token balances w/ metadata
 * - GET /account/transactions?address=…&cursor=…    → transaction history
 * - GET /account/nfts?address=…&pageIndex=…         → NFT holdings by collection
 *
 * All responses are wrapped as { code, reason, message, result: { data, nextPageCursor|nextPageIndex, total } }.
 */
export class BlockVisionProvider implements DataProvider {
    readonly kind = 'blockvision';

    #context: ProviderContext;
    /** address -> cursor for the NEXT page of transactions. */
    #txCursors = new Map<string, string | null>();

    constructor(context: ProviderContext) {
        this.#context = context;
    }

    async #call(path: string, params: Record<string, string | number>): Promise<any> {
        if (this.#context.config.apiKeyRef && !this.#context.apiKey) {
            throw new MissingApiKeyError(this.#context.config.apiKeyRef);
        }

        const base = this.#context.config.baseUrl.replace(/\/$/, '');
        const search = new URLSearchParams(
            Object.fromEntries(
                Object.entries(params).map(([key, value]) => [key, String(value)]),
            ),
        );

        const payload = await fetchJson(RateLimiters.blockvision, `${base}${path}?${search}`, {
            headers: {
                accept: 'application/json',
                'x-api-key': this.#context.apiKey,
            },
        });

        if (payload?.code !== 0 && payload?.code !== 200 && payload?.code !== undefined) {
            throw new Error(`BlockVision error: ${payload?.reason ?? payload?.message ?? payload?.code}`);
        }

        return payload?.result ?? payload;
    }

    async getTokenHoldings(address: string): Promise<CoinHolding[]> {
        const chain = this.#context.chain;
        const holdings: CoinHolding[] = [];
        let nativeIncluded = false;

        try {
            const result = await this.#call('/account/tokens', {
                address,
                pageIndex: 1,
                pageSize: 50,
            });

            const entries: any[] = result?.data ?? [];

            entries.forEach(entry => {
                const tokenAddress = (entry?.contractAddress ?? '').toLowerCase();
                const decimals = Number(entry?.decimal ?? entry?.decimals ?? 18);
                // BlockVision returns formatted balances for Monad tokens
                const balance = Number(entry?.balance ?? 0);

                // Native MON is reported with a zero/placeholder contract address
                if (
                    !tokenAddress ||
                    tokenAddress === '0x0000000000000000000000000000000000000000' ||
                    tokenAddress === chain.native_coin_address.toLowerCase()
                ) {
                    holdings.unshift(buildNativeHolding(chain, address, balance));
                    nativeIncluded = true;
                    return;
                }

                holdings.push(
                    buildTokenHolding(chain, address, {
                        tokenAddress,
                        name: entry?.name ?? entry?.symbol ?? '',
                        symbol: entry?.symbol ?? '',
                        decimals,
                        balance,
                        logo: entry?.imageURL ?? '',
                        verified: Boolean(entry?.verified),
                    }),
                );
            });
        } catch (error) {
            if (error instanceof MissingApiKeyError) {
                throw error;
            }
            logger.log('BlockVision: token balances unavailable', error);
        }

        if (!nativeIncluded) {
            // Always show the native row; live balance is refreshed on-chain.
            holdings.unshift(buildNativeHolding(chain, address, 0));
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
        const cursorKey = `${address.toLowerCase()}:${tokenAddress ?? ''}`;

        try {
            const params: Record<string, string | number> = {
                address,
                limit: size,
                ascendingOrder: 'false',
            };

            if (page > 1) {
                const cursor = this.#txCursors.get(`${cursorKey}:${page}`);
                if (!cursor) {
                    return emptyTxPage(page);
                }
                params.cursor = cursor;
            }

            const result = await this.#call('/account/transactions', params);
            const entries: any[] = result?.data ?? [];
            const nextCursor: string | null = result?.nextPageCursor ?? null;
            this.#txCursors.set(`${cursorKey}:${page + 1}`, nextCursor || null);

            const nativeDecimals = chain.native_coin_decimals ?? 18;

            let rawTxs: RawTransaction[] = entries.map(entry => {
                const valueRaw = entry?.value ?? entry?.amount ?? 0;
                // Values may come formatted or in wei depending on endpoint version.
                const value =
                    typeof valueRaw === 'string' && valueRaw.length > 15
                        ? Number(valueRaw) / 10 ** nativeDecimals
                        : Number(valueRaw);

                return {
                    hash: entry?.hash ?? entry?.txHash ?? '',
                    from: entry?.from ?? '',
                    to: entry?.to ?? '',
                    value,
                    fee: Number(entry?.transactionFee ?? 0),
                    success: entry?.status === undefined ? true : Number(entry.status) === 1,
                    timestamp:
                        typeof entry?.timestamp === 'number' && entry.timestamp > 10 ** 12
                            ? Math.floor(entry.timestamp / 1000)
                            : Number(entry?.timestamp ?? 0),
                    block: Number(entry?.blockNumber ?? 0),
                    method: entry?.methodName ?? entry?.methodID ?? '',
                    hasData: Boolean(entry?.methodID && entry.methodID !== '0x'),
                    transfers: [],
                };
            });

            if (tokenAddress) {
                // BlockVision has no per-token history filter on this endpoint;
                // fall back to filtering client-side.
                rawTxs = rawTxs.filter(
                    raw =>
                        raw.transfers.some(
                            transfer =>
                                transfer.tokenAddress.toLowerCase() ===
                                tokenAddress.toLowerCase(),
                        ) || raw.to.toLowerCase() === tokenAddress.toLowerCase(),
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
                pagination: makePagination(page, size, Boolean(nextCursor)),
            };
        } catch (error) {
            if (error instanceof MissingApiKeyError) {
                throw error;
            }
            logger.log('BlockVision: transactions unavailable', error);
            return emptyTxPage(page);
        }
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
            const result = await this.#call('/account/nfts', {
                address,
                pageIndex: page,
            });

            const entries: any[] = result?.data ?? [];
            const searchLower = search.trim().toLowerCase();
            const collections: NFTList[] = [];

            entries.forEach(collection => {
                const contractAddress = (collection?.contractAddress ?? '').toLowerCase();
                const collectionName = collection?.name ?? 'Unknown Collection';

                if (!contractAddress) {
                    return;
                }

                if (searchLower && !collectionName.toLowerCase().includes(searchLower)) {
                    return;
                }

                const items: any[] = collection?.items ?? [];

                const nftDetails: NFT[] = items.map(item => {
                    const imageUrl = item?.imageURL ?? item?.image ?? '';
                    const tokenId = String(item?.tokenId ?? '');

                    return {
                        _id: `${contractAddress}:${tokenId}`,
                        wallet_address: wallet,
                        contract: {
                            type: collection?.ercStandard ?? 'ERC-721',
                            name: collectionName,
                        },
                        contract_address: contractAddress,
                        current_usd_value: 0,
                        image_url: imageUrl,
                        token_id: tokenId,
                        nft_collection: {
                            _id: contractAddress,
                            collection_id: contractAddress,
                            floor_price: 0,
                            image_url: collection?.imageURL ?? imageUrl,
                            marketplace_pages: [],
                            name: collectionName,
                            spam_score: collection?.verified ? 0 : 50,
                        },
                        name: item?.name ?? `${collectionName} #${tokenId}`,
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
                });

                if (nftDetails.length > 0) {
                    collections.push({
                        _id: contractAddress,
                        name: collectionName,
                        address: contractAddress,
                        platform_id: chain.platform_id,
                        integration_type: 'wallet',
                        spamThreshold: 100,
                        nftDetails,
                    });
                }
            });

            const hasNextPage = Boolean(result?.nextPageIndex) || entries.length >= size;

            return {
                nfts: collections,
                pagination: makePagination(page, size, hasNextPage),
            };
        } catch (error) {
            if (error instanceof MissingApiKeyError) {
                throw error;
            }
            logger.log('BlockVision: NFTs unavailable', error);
            return { nfts: [], pagination: null };
        }
    }
}
