import { RateLimiter } from '../../shared/utils/rateLimiter';

/**
 * Small rate-limited JSON fetch helper shared by the data/price providers.
 */
export async function fetchJson<T = any>(
    limiter: RateLimiter,
    url: string,
    init?: RequestInit,
): Promise<T> {
    return limiter.execute(async () => {
        const response = await fetch(url, init);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${url.split('?')[0]}`);
        }

        return (await response.json()) as T;
    });
}
