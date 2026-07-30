import { buildHomeReduxState } from './homeHarness';

/** Handles `submitRequestToBackground` calls from ui thunks in UI tests (no real extension background). */
export function submitRequestToBackgroundTestDouble(method: string, _args?: unknown[]) {
    const base = buildHomeReduxState();

    switch (method) {
        case 'getState':
            return Promise.resolve(base.globalState);
        case 'getCurrentPortfolioCoins':
            return Promise.resolve([]);
        case 'getCurrentCoinPrices':
            return Promise.resolve({});
        case 'getTokenBalance':
            return Promise.resolve({ balance: 0n, decimals: 18, error: false });
        case 'getNativeTokenBalance':
            return Promise.resolve(0n);
        default:
            return Promise.resolve(undefined);
    }
}
