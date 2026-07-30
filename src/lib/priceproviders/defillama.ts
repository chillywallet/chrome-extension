import { resolveChainConfig } from '../../config';
import logger from '../../shared/utils/logger';
import { RateLimiters } from '../../shared/utils/rateLimiter';
import { fetchJson } from '../dataproviders/http';

/**
 * DefiLlama price API (free, no key): https://coins.llama.fi
 *
 * Coins are keyed as `${llamaSlug}:${tokenAddress}` for on-chain tokens and
 * `coingecko:${id}` for native coins.
 */

const BASE_URL = 'https://coins.llama.fi';

/** CoinGecko ids for native coins, used for the `coingecko:` llama keys. */
const NATIVE_COINGECKO_IDS: Record<number, string> = {
    1: 'ethereum',
    11155111: 'ethereum',
    8453: 'ethereum',
    84532: 'ethereum',
    42161: 'ethereum',
    56: 'binancecoin',
    137: 'polygon-ecosystem-token',
    80002: 'polygon-ecosystem-token',
    43114: 'avalanche-2',
    143: 'monad',
    10143: 'monad',
};

export function isNativeAddress(chainId: number, tokenAddress: string): boolean {
    const chain = resolveChainConfig(chainId);
    return (
        !!chain &&
        chain.native_coin_address.toLowerCase() === (tokenAddress ?? '').toLowerCase()
    );
}

/** DefiLlama coin key for a (chainId, tokenAddress) pair, or null when unsupported. */
export function llamaKey(chainId: number, tokenAddress: string): string | null {
    const chain = resolveChainConfig(chainId);

    if (!chain || chain.priceProvider.kind === 'none') {
        return null;
    }

    if (isNativeAddress(chainId, tokenAddress)) {
        const coingeckoId = NATIVE_COINGECKO_IDS[chainId];
        return coingeckoId ? `coingecko:${coingeckoId}` : null;
    }

    const slug = chain.priceProvider.llamaSlug;
    return slug ? `${slug}:${tokenAddress.toLowerCase()}` : null;
}

export type LlamaPrice = { usdPrice: number; change24h?: number };

/**
 * Current USD prices for tokens on one chain.
 * Returns a map keyed by lowercase token address.
 */
export async function getCurrentPrices(
    chainId: number,
    tokenAddresses: string[],
): Promise<Record<string, LlamaPrice>> {
    const keys: string[] = [];
    const keyToAddress = new Map<string, string>();

    tokenAddresses.forEach(address => {
        const key = llamaKey(chainId, address);

        if (key) {
            keys.push(key);
            keyToAddress.set(key.toLowerCase(), address.toLowerCase());
        }
    });

    if (keys.length === 0) {
        return {};
    }

    const url = `${BASE_URL}/prices/current/${keys.map(encodeURIComponent).join(',')}`;

    try {
        const payload = await fetchJson(RateLimiters.defillama, url);
        const coins = payload?.coins ?? {};
        const result: Record<string, LlamaPrice> = {};

        Object.entries(coins).forEach(([key, value]: [string, any]) => {
            const address = keyToAddress.get(key.toLowerCase());

            if (address) {
                result[address] = { usdPrice: Number(value?.price ?? 0) };
            }
        });

        return result;
    } catch (error) {
        logger.log('💰 DefiLlama prices unavailable', error);
        return {};
    }
}

export type ChartPoint = { price: number; timestamp: number };

/**
 * Historical price chart for one coin.
 * span/period map roughly to the UI's day/week/month/year/all filters.
 */
export async function getChart(
    chainId: number,
    tokenAddress: string,
    days: number | 'all',
): Promise<ChartPoint[]> {
    const key = llamaKey(chainId, tokenAddress);

    if (!key) {
        return [];
    }

    // ~120 points per chart; DefiLlama caps span at 500ish
    const config =
        days === 'all'
            ? { period: '1d', span: 365 }
            : days <= 1
              ? { period: '15m', span: 96 }
              : days <= 7
                ? { period: '2h', span: 84 }
                : days <= 30
                  ? { period: '6h', span: 120 }
                  : { period: '1d', span: Math.min(days, 365) };

    const url =
        `${BASE_URL}/chart/${encodeURIComponent(key)}` +
        `?period=${config.period}&span=${config.span}`;

    try {
        const payload = await fetchJson(RateLimiters.defillama, url);
        const coins = payload?.coins ?? {};
        const entry: any = Object.values(coins)[0];
        const prices: any[] = entry?.prices ?? [];

        return prices.map(point => ({
            price: Number(point?.price ?? 0),
            timestamp: Number(point?.timestamp ?? 0),
        }));
    } catch (error) {
        logger.log('💰 DefiLlama chart unavailable', error);
        return [];
    }
}
