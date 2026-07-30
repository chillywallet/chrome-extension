/* eslint-disable import/no-anonymous-default-export */
import * as coingecko from '../../lib/priceproviders/coingecko';
import * as defillama from '../../lib/priceproviders/defillama';
import { ChartFilterType } from '../../shared/types/Chart';

/**
 * Market data facade. Historically this was a GraphQL client for the
 * proprietary price service; it now serves the same response envelopes from
 * free public APIs (CoinGecko for listings/search, DefiLlama for token
 * charts), so the consuming pages did not have to change.
 *
 * Coin ids ("coinId"):
 * - `cg:{coingecko-id}`         -> CoinGecko-listed market coins (Explore/search)
 * - `{chainId}:{tokenAddress}`  -> on-chain tokens from wallet holdings
 */

function marketEnvelope(coins: coingecko.MarketCoinResult[], page: number, last: number) {
    return {
        data: {
            coins: {
                data: coins,
                pagination: [{ page, last }],
            },
        },
    };
}

function chartEnvelope(points: Array<{ price: number; timestamp: number }>) {
    return {
        data: {
            quotes: [
                {
                    quotes: points.map(point => ({
                        price: point.price,
                        last_updated: new Date(point.timestamp * 1000).toISOString(),
                    })),
                },
            ],
        },
    };
}

const DAYS_BY_FILTER: Record<ChartFilterType, number | 'all'> = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
    all: 'all',
    custom: 30,
};

export default {
    async getCoins(name: string, limit: number, offset: number, _showError: boolean = true) {
        const coins = await coingecko.getMarkets(name, limit, offset);
        const page = Math.floor(offset / Math.max(limit, 1)) + 1;
        // CoinGecko lists thousands of coins; report "one more page" while full.
        const last = coins.length >= limit ? page + 1 : page;
        return marketEnvelope(coins, page, last);
    },

    async getCoinsByIds(coinIds: string[], _showError: boolean = true) {
        const cgIds = coinIds.filter(coingecko.isCoinGeckoId).map(coingecko.coinGeckoId);
        const coins = await coingecko.getMarketsByIds(cgIds);
        return marketEnvelope(coins, 1, 1);
    },

    async getCoinsByTokenAddresses(
        platformId: number,
        tokenAddresses: string[],
        _showError: boolean = true,
    ) {
        const prices = await defillama.getCurrentPrices(platformId, tokenAddresses);

        return {
            data: {
                coinLookupEx: Object.entries(prices).map(([tokenAddress, price]) => ({
                    tokenAddress,
                    usdPrice: price.usdPrice,
                })),
            },
        };
    },

    async getCoinChartData(coinId: string, type: ChartFilterType) {
        const days = DAYS_BY_FILTER[type] ?? 30;

        if (coingecko.isCoinGeckoId(coinId)) {
            const points = await coingecko.getChart(
                coingecko.coinGeckoId(coinId),
                days === 'all' ? 'max' : days,
            );
            return chartEnvelope(points);
        }

        // `${chainId}:${tokenAddress}`
        const [chainIdRaw, tokenAddress] = (coinId ?? '').split(':');
        const chainId = Number(chainIdRaw);

        if (!chainId || !tokenAddress) {
            return chartEnvelope([]);
        }

        const points = await defillama.getChart(chainId, tokenAddress, days);
        return chartEnvelope(points);
    },
};
