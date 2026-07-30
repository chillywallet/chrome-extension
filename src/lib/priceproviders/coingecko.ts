import logger from '../../shared/utils/logger';
import { RateLimiters } from '../../shared/utils/rateLimiter';
import { fetchJson } from '../dataproviders/http';
import { ChartPoint } from './defillama';

/**
 * CoinGecko free API: top-coins lists, search and charts for coins that have
 * a CoinGecko listing. Used for the Explore tab and market coin pages.
 *
 * Coins coming from this provider carry synthetic ids of the form `cg:{id}`.
 */

const BASE_URL = 'https://api.coingecko.com/api/v3';

export const COINGECKO_ID_PREFIX = 'cg:';

export function isCoinGeckoId(id: string | undefined | null): boolean {
    return Boolean(id && id.startsWith(COINGECKO_ID_PREFIX));
}

export function coinGeckoId(id: string): string {
    return id.slice(COINGECKO_ID_PREFIX.length);
}

export type MarketCoinResult = {
    id: number;
    coinId: string; // `cg:{coingecko-id}`
    name: string;
    symbol: string;
    description: string;
    logo: string;
    logo_lrg: string;
    rank: number;
    max_supply: number;
    platformId: number;
    coinAddress: string;
    is_verified: boolean;
    latest: {
        price: number;
        fully_diluted_market_cap: number;
        percent_change_7d: number;
        percent_change_24h: number;
        percent_change_30d: number;
        volume_24h: number;
    };
};

function mapMarket(entry: any, index: number): MarketCoinResult {
    return {
        id: index + 1,
        coinId: `${COINGECKO_ID_PREFIX}${entry?.id ?? ''}`,
        name: entry?.name ?? '',
        symbol: (entry?.symbol ?? '').toUpperCase(),
        description: '',
        logo: entry?.image ?? '',
        logo_lrg: entry?.image ?? '',
        rank: Number(entry?.market_cap_rank ?? index + 1),
        max_supply: Number(entry?.max_supply ?? 0),
        platformId: 0,
        coinAddress: '',
        is_verified: true,
        latest: {
            price: Number(entry?.current_price ?? 0),
            fully_diluted_market_cap: Number(entry?.fully_diluted_valuation ?? 0),
            percent_change_7d: 0,
            percent_change_24h: Number(entry?.price_change_percentage_24h ?? 0),
            percent_change_30d: 0,
            volume_24h: Number(entry?.total_volume ?? 0),
        },
    };
}

/** Top coins by market cap, optionally filtered by a search query. */
export async function getMarkets(
    query: string,
    limit: number,
    offset: number,
): Promise<MarketCoinResult[]> {
    try {
        if (query.trim()) {
            // Search first, then hydrate the top matches with market data.
            const search = await fetchJson(
                RateLimiters.coingecko,
                `${BASE_URL}/search?query=${encodeURIComponent(query.trim())}`,
            );
            const ids: string[] = (search?.coins ?? [])
                .slice(0, Math.min(limit, 25))
                .map((coin: any) => coin.id);

            if (ids.length === 0) {
                return [];
            }

            const markets = await fetchJson<any[]>(
                RateLimiters.coingecko,
                `${BASE_URL}/coins/markets?vs_currency=usd&ids=${ids.join(',')}` +
                    `&order=market_cap_desc&per_page=${ids.length}&page=1`,
            );

            return (markets ?? []).map(mapMarket);
        }

        const page = Math.floor(offset / limit) + 1;
        const markets = await fetchJson<any[]>(
            RateLimiters.coingecko,
            `${BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc` +
                `&per_page=${limit}&page=${page}&price_change_percentage=24h`,
        );

        return (markets ?? []).map((entry, index) => mapMarket(entry, offset + index));
    } catch (error) {
        logger.log('💰 CoinGecko markets unavailable', error);
        return [];
    }
}

/** Market data for specific CoinGecko ids. */
export async function getMarketsByIds(cgIds: string[]): Promise<MarketCoinResult[]> {
    if (cgIds.length === 0) {
        return [];
    }

    try {
        const markets = await fetchJson<any[]>(
            RateLimiters.coingecko,
            `${BASE_URL}/coins/markets?vs_currency=usd&ids=${cgIds.join(',')}` +
                `&order=market_cap_desc&per_page=${cgIds.length}&page=1` +
                `&price_change_percentage=24h`,
        );
        return (markets ?? []).map(mapMarket);
    } catch (error) {
        logger.log('💰 CoinGecko markets-by-id unavailable', error);
        return [];
    }
}

/** Price chart for a CoinGecko-listed coin. */
export async function getChart(cgId: string, days: number | 'max'): Promise<ChartPoint[]> {
    try {
        const payload = await fetchJson(
            RateLimiters.coingecko,
            `${BASE_URL}/coins/${encodeURIComponent(cgId)}/market_chart` +
                `?vs_currency=usd&days=${days}`,
        );
        const prices: any[] = payload?.prices ?? [];

        return prices.map(point => ({
            timestamp: Math.floor(Number(point?.[0] ?? 0) / 1000),
            price: Number(point?.[1] ?? 0),
        }));
    } catch (error) {
        logger.log('💰 CoinGecko chart unavailable', error);
        return [];
    }
}
