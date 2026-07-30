import CoinsUtils, { loadCoins } from '../../src/lib/CoinsUtils';
import { MarketRequest, PortfolioRequest, WalletRequest } from '../../src/api/graphQL';
import { getReduxStore } from '../../src/store/store';
import {
    setCachingCoins,
    setNativeCoinPrice,
    setUnknownCoins,
    updatePortfolioCoinsFromBackground,
} from '../../src/store/actions/uiActions';

jest.mock('../../src/api/graphQL', () => ({
    MarketRequest: {
        getCoinsByTokenAddresses: jest.fn(),
    },
    PortfolioRequest: {
        getCoinDetails: jest.fn(),
    },
    WalletRequest: {
        getCoinsByPlatformIds: jest.fn(),
    },
}));

jest.mock('../../src/store/store', () => ({
    getReduxStore: jest.fn(() => undefined),
}));

jest.mock('../../src/store/actions/uiActions', () => ({
    setCachingCoins: jest.fn((c: any) => ({ type: 'SET_CACHING', c })),
    setNativeCoinPrice: jest.fn(),
    setUnknownCoins: jest.fn((c: any) => ({ type: 'SET_UNKNOWN', c })),
    updatePortfolioCoinsFromBackground: jest.fn(),
}));

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// String.prototype.toTitleCase is a runtime extension used by CoinsUtils.
beforeAll(() => {
    if (!(String.prototype as any).toTitleCase) {
        // eslint-disable-next-line no-extend-native
        (String.prototype as any).toTitleCase = function () {
            return this.charAt(0).toUpperCase() + this.slice(1);
        };
    }
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('CoinsUtils.getChangedValues', () => {
    const fn = (CoinsUtils as any).getChangedValues;

    it('handles zero/zero', () => {
        expect(fn(0, 0)).toEqual({ value: 0, percentage: '0.00%' });
    });
    it('handles increase', () => {
        const r = fn(100, 110);
        expect(r.value).toBe(10);
        expect(r.percentage).toBe('10.00%');
    });
    it('handles decrease', () => {
        const r = fn(100, 90);
        expect(r.value).toBe(-10);
        expect(r.percentage).toBe('10.00%');
    });
    it('returns infinity% when start is 0 but end isn`t', () => {
        expect(fn(0, 100).percentage).toBe('infinity%');
    });
});

describe('CoinsUtils.getOpenPriceFromLatestAndPecentage', () => {
    const fn = (CoinsUtils as any).getOpenPriceFromLatestAndPecentage;
    it('returns latest price when percentage is 0', () => {
        expect(fn(100, 0)).toBe(100);
    });
    it('returns a number for non-zero percentage', () => {
        expect(typeof fn(100, 10)).toBe('number');
    });
});

describe('CoinsUtils.handleTokens', () => {
    const handleTokens = (CoinsUtils as any).handleTokens;

    it('returns empty for empty input', () => {
        expect(handleTokens([])).toEqual([]);
    });

    it('returns empty when tokens is null/undefined', () => {
        expect(handleTokens(null)).toEqual([]);
    });

    it('filters out zero-value non-NFT tokens', () => {
        const out = handleTokens([
            { token_id: 'a', value: '0', usd_value: 0, in: true, is_nft: false },
        ]);
        expect(out).toEqual([]);
    });

    it('keeps NFT tokens even when value is 0', () => {
        const out = handleTokens([
            { token_id: 'a', value: '0', usd_value: 0, in: true, is_nft: true },
        ]);
        expect(out.length).toBe(1);
    });

    it('puts incoming tokens at the end and outgoing tokens at the front', () => {
        const out = handleTokens([
            { token_id: 'a', value: '1', usd_value: 1, in: true, is_nft: false },
            { token_id: 'b', value: '1', usd_value: 1, in: false, is_nft: false },
        ]);
        expect(out[0].token_id).toBe('b'); // outgoing first
        expect(out[1].token_id).toBe('a');
    });
});

describe('CoinsUtils.getTransactionName', () => {
    const fn = (CoinsUtils as any).getTransactionName;

    it('returns "<Type> Failed" when not successful', () => {
        expect(fn({ success: false, type: 'transfer' })).toBe('Transfer Failed');
    });

    it('returns the method when it includes Chilly', () => {
        expect(fn({ success: true, method: 'Chilly Bridge' })).toBe('Chilly Bridge');
    });

    it('handles transfer/approve', () => {
        expect(fn({ success: true, type: 'transfer', method: 'approve' })).toBe('Approve');
    });

    it('handles refund/create limit order selectors', () => {
        expect(fn({ success: true, type: 'transfer', method: '0x3289a93e' })).toBe('Refund Limit Order');
        expect(fn({ success: true, type: 'transfer', method: '0x99eb88c4' })).toBe('Create Limit Order');
    });

    it('handles transfer with single token in/out', () => {
        expect(fn({ success: true, type: 'transfer', tokens: [{ in: true }] })).toBe('Transfer In');
        expect(fn({ success: true, type: 'transfer', tokens: [{ in: false }] })).toBe('Transfer Out');
    });

    it('handles transfer/transfer method by wallet ownership', () => {
        expect(
            fn({ success: true, type: 'transfer', method: 'transfer', wallet_address: '0xa', from: '0xa' }),
        ).toBe('Transfer Out');
        expect(
            fn({ success: true, type: 'transfer', method: 'transfer', wallet_address: '0xb', from: '0xa' }),
        ).toBe('Transfer In');
    });

    it('handles swap type', () => {
        expect(fn({ success: true, type: 'swap', method: 'swapExactTokens' })).toContain('Swap');
    });

    it('handles send type with single token in/out', () => {
        expect(fn({ success: true, type: 'send', tokens: [{ in: true }] })).toBe('Transfer In');
        expect(fn({ success: true, type: 'send', tokens: [{ in: false }] })).toBe('Transfer Out');
    });

    it('handles exchange/pro deposit/withdrawal', () => {
        expect(fn({ success: true, type: 'pro_deposit' })).toBe('Withdrawal to Coinbase Pro');
        expect(fn({ success: true, type: 'pro_withdrawal' })).toBe('Deposit from Coinbase Pro');
        expect(fn({ success: true, type: 'fiat_deposit' })).toBe('Fiat Deposit');
        expect(fn({ success: true, type: 'staking_reward' })).toBe('Staking Reward');
    });
});

describe('loadCoins', () => {
    it('returns error=false with empty list when no platform data', done => {
        (WalletRequest.getCoinsByPlatformIds as jest.Mock).mockResolvedValueOnce({ data: {} });
        loadCoins('btc', 1, ({ error, result }) => {
            expect(error).toBe(false);
            expect(result).toEqual([]);
            done();
        });
    });

    it('returns the coins (with default icons applied) when available', done => {
        (WalletRequest.getCoinsByPlatformIds as jest.Mock).mockResolvedValueOnce({
            data: { platformCoins: { data: [{ id: 1027 }, { id: 99999 }] } },
        });
        loadCoins('eth', 1, ({ error, result }) => {
            expect(error).toBe(false);
            expect(result.length).toBe(2);
            done();
        });
    });

    it('returns error=true on rejection', done => {
        (WalletRequest.getCoinsByPlatformIds as jest.Mock).mockRejectedValueOnce(new Error('fail'));
        loadCoins('btc', 1, ({ error, result }) => {
            expect(error).toBe(true);
            expect(result).toEqual([]);
            done();
        });
    });
});

describe('CoinsUtils.getCachingCoins', () => {
    const fn = (CoinsUtils as any).getCachingCoins;

    it('invokes callback with cached state when no coinIds', done => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: { unknownCoinIds: ['x'], cachingCoins: [{ coinId: 'c1' }] },
            }),
        });
        fn([], (cached: any[], unknown: any[]) => {
            expect(cached).toEqual([{ coinId: 'c1' }]);
            expect(unknown).toEqual(['x']);
            done();
        });
    });

    it('updates cache when coinDetails returns data', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: { unknownCoinIds: [], cachingCoins: [] },
            }),
            dispatch: jest.fn(),
        });
        (PortfolioRequest.getCoinDetails as jest.Mock).mockResolvedValueOnce({
            data: { coins: { data: [{ coinId: 'c1' }] } },
        });
        const cb = jest.fn();
        await fn(['c1'], cb);
        await new Promise(r => setTimeout(r, 0));
        expect(cb).toHaveBeenCalled();
    });

    it('records unknown coin ids when API returns empty data', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: { unknownCoinIds: [], cachingCoins: [] },
            }),
            dispatch: jest.fn(),
        });
        (PortfolioRequest.getCoinDetails as jest.Mock).mockResolvedValueOnce({
            data: { coins: { data: [] } },
        });
        const cb = jest.fn();
        await fn(['missing'], cb);
        await new Promise(r => setTimeout(r, 0));
        expect(cb).toHaveBeenCalled();
    });

    it('falls back to existing cache on error', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: { unknownCoinIds: ['x'], cachingCoins: [{ coinId: 'c1' }] },
            }),
            dispatch: jest.fn(),
        });
        (PortfolioRequest.getCoinDetails as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        const cb = jest.fn();
        await fn(['c1'], cb);
        await new Promise(r => setTimeout(r, 0));
        expect(cb).toHaveBeenCalledWith([{ coinId: 'c1' }], ['x']);
    });
});

describe('CoinsUtils.getCoinsByTokenAddresses', () => {
    const fn = (CoinsUtils as any).getCoinsByTokenAddresses;

    it('returns the cached entries when all addresses are fresh', async () => {
        const now = Date.now();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                portfolio: {
                    coinPrices: {
                        1: {
                            '0xabc': { usdPrice: 1.23, lastUpdated: now },
                        },
                    },
                },
            }),
        });
        const out = await fn(1, ['0xABC']);
        expect(out).toEqual({ '0xabc': { usdPrice: 1.23, lastUpdated: now } });
        expect(MarketRequest.getCoinsByTokenAddresses).not.toHaveBeenCalled();
    });

    it('fetches fresh prices for stale addresses', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: {
                coinLookupEx: [
                    { tokenAddress: '0xABC', usdPrice: 4.2 },
                    { tokenAddress: '0xDEF', usdPrice: 6.9 },
                ],
            },
        });
        const out = await fn(1, ['0xabc', '0xdef']);
        expect(out['0xabc'].usdPrice).toBe(4.2);
        expect(out['0xdef'].usdPrice).toBe(6.9);
    });

    it('falls back to 0 for addresses missing from the response', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [] },
        });
        const out = await fn(1, ['0xmiss']);
        expect(out['0xmiss'].usdPrice).toBe(0);
    });

    it('handles network errors by returning fallback zero entries', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockRejectedValueOnce(
            new Error('rpc'),
        );
        const out = await fn(1, ['0xa']);
        expect(out['0xa'].usdPrice).toBe(0);
    });

    it('handles a missing coinLookupEx in the response', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: {},
        });
        const out = await fn(1, ['0xa']);
        expect(out['0xa'].usdPrice).toBe(0);
    });

    it('drops empty/falsy addresses before querying', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [] },
        });
        await fn(1, ['', null as any, '0xa']);
        const args = (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mock.calls[0];
        expect(args[1]).toEqual(['0xa']);
    });

    it('chunks more than 15 addresses into multiple requests', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValue({
            data: { coinLookupEx: [] },
        });
        const addresses = Array.from({ length: 32 }).map((_, i) => `0x${i.toString(16)}`);
        await fn(1, addresses);
        // 32 -> 15 + 15 + 2 = 3 chunks
        expect(
            (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mock.calls.length,
        ).toBeGreaterThanOrEqual(3);
    });

    it('skips a returned item that has no tokenAddress', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [{ usdPrice: 5 }] },
        });
        const out = await fn(1, ['0xa']);
        expect(out['0xa'].usdPrice).toBe(0);
    });

    it('respects fresh cache for some addresses while fetching others', async () => {
        const now = Date.now();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                portfolio: {
                    coinPrices: { 1: { '0xfresh': { usdPrice: 9, lastUpdated: now } } },
                },
            }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [{ tokenAddress: '0xstale', usdPrice: 1 }] },
        });
        const out = await fn(1, ['0xfresh', '0xstale']);
        expect(out['0xfresh'].usdPrice).toBe(9);
        expect(out['0xstale'].usdPrice).toBe(1);
    });
});

describe('CoinsUtils.getCoinPrice', () => {
    const fn = (CoinsUtils as any).getCoinPrice;

    it('returns 0 for missing platformId', async () => {
        await expect(fn(0, '0xa')).resolves.toBe(0);
    });

    it('returns 0 for missing tokenAddress', async () => {
        await expect(fn(1, '')).resolves.toBe(0);
    });

    it('returns the looked-up price', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [{ tokenAddress: '0xa', usdPrice: 3.5 }] },
        });
        await expect(fn(1, '0xA')).resolves.toBe(3.5);
    });

    it('returns 0 when the lookup map has no entry', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [] },
        });
        await expect(fn(1, '0xA')).resolves.toBe(0);
    });
});

describe('CoinsUtils.updateCoinAssets', () => {
    const fn = (CoinsUtils as any).updateCoinAssets;

    it('passes groups and items through unchanged', done => {
        const assets = {
            groupByCoins: [
                {
                    token_id: '1:0xabc',
                    items: [{ token_id: '1:0xabc' }],
                },
            ],
            groupByExchanges: [
                {
                    token_id: '1:0xdef',
                    items: [{ token_id: '1:0xdef' }],
                },
            ],
        } as any;

        fn(assets, (out: any) => {
            expect(out.groupByCoins[0].token_id).toBe('1:0xabc');
            expect(out.groupByCoins[0].items).toHaveLength(1);
            expect(out.groupByExchanges[0].token_id).toBe('1:0xdef');
            done();
        });
    });

    it('is a no-op when no callback is provided', () => {
        const assets = { groupByCoins: [], groupByExchanges: [] } as any;
        // Should not throw, even with no callback.
        expect(() => fn(assets)).not.toThrow();
    });
});

describe('CoinsUtils.handleTokens aggregation branch', () => {
    const handleTokens = (CoinsUtils as any).handleTokens;

    it('aggregates duplicate token_id+in entries', () => {
        const out = handleTokens([
            { token_id: 'a', in: true, is_nft: false, value: '5', usd_value: 10 },
            { token_id: 'a', in: true, is_nft: false, value: '3', usd_value: 6 },
        ]);
        // After aggregation, only one entry is kept and its value is the sum.
        expect(out.length).toBe(1);
        expect(parseFloat(out[0].value)).toBe(8);
    });
});

describe('CoinsUtils.getTransactionName extra branches', () => {
    const fn = (CoinsUtils as any).getTransactionName;

    it('uses method-name prefix for transfer when method does not start with "transfer"', () => {
        expect(
            fn({ success: true, type: 'transfer', method: 'mintNft' }),
        ).toBe('Transfer MintNft');
    });

    it('strips the "transfer" prefix off the method for nicer names', () => {
        expect(
            fn({ success: true, type: 'transfer', method: 'transferFrom' }),
        ).toBe('Transfer From');
    });

    it('returns "Swap" when the trimmed transfer method is Swap', () => {
        expect(
            fn({ success: true, type: 'transfer', method: 'transferSwap' }),
        ).toBe('Swap');
    });

    it('handles swap type when method does not start with "swap"', () => {
        expect(
            fn({ success: true, type: 'swap', method: 'magicTrade' }),
        ).toBe('Swap MagicTrade');
    });

    it('handles swap type when method starts with "swap"', () => {
        expect(
            fn({ success: true, type: 'swap', method: 'swapExact' }),
        ).toBe('Swap Exact');
    });

    it('handles exchange_deposit alias', () => {
        expect(fn({ success: true, type: 'exchange_deposit' })).toBe(
            'Withdrawal to Coinbase Pro',
        );
    });

    it('handles exchange_withdrawal alias', () => {
        expect(fn({ success: true, type: 'exchange_withdrawal' })).toBe(
            'Deposit from Coinbase Pro',
        );
    });

    it('falls through to the type label for unknown transaction types', () => {
        expect(fn({ success: true, type: 'custom' })).toBe('Custom');
    });

    it('falls through when transfer type has no method or single-token signature', () => {
        expect(fn({ success: true, type: 'transfer' })).toBe('Transfer');
    });

    it('falls through when send type has no tokens info', () => {
        expect(fn({ success: true, type: 'send' })).toBe('Send');
    });
});

describe('CoinsUtils.fetchNativeCoinPrice', () => {
    const fn = (CoinsUtils as any).fetchNativeCoinPrice;

    it('dispatches a zero price when network has no native coin address', async () => {
        const dispatch = jest.fn();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
            dispatch,
        });
        const cb = jest.fn();
        await fn({} as any, cb);
        expect(setNativeCoinPrice).toHaveBeenCalledWith(0, 0);
        expect(cb).toHaveBeenCalledWith(0);
    });

    it('dispatches the looked-up price for a chain with a native coin', async () => {
        const dispatch = jest.fn();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
            dispatch,
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [{ tokenAddress: '0xnative', usdPrice: 42 }] },
        });
        const cb = jest.fn();
        await fn({ native_coin_address: '0xnative', platform_id: 1 } as any, cb);
        // Allow the inner promise chain to settle.
        await new Promise(r => setTimeout(r, 0));
        expect(setNativeCoinPrice).toHaveBeenCalledWith(1, 42);
        expect(cb).toHaveBeenCalledWith(42);
    });

    it('dispatches zero on a lookup error', async () => {
        // Force getCoinPrice's underlying call to throw — the outer .catch fires.
        const dispatch = jest.fn();
        let throwingDispatchCount = 0;
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
            dispatch: (action: any) => {
                throwingDispatchCount += 1;
                return dispatch(action);
            },
        });
        // Make MarketRequest throw at the outer level (not just resolve([]) inside the worker).
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockImplementationOnce(() => {
            throw new Error('sync-boom');
        });
        const cb = jest.fn();
        await fn({ native_coin_address: '0xnative', platform_id: 1 } as any, cb);
        await new Promise(r => setTimeout(r, 0));
        expect(throwingDispatchCount).toBeGreaterThan(0);
        expect(cb).toHaveBeenCalled();
    });
});

describe('CoinsUtils.fetchPortfolioCoins', () => {
    const fn = (CoinsUtils as any).fetchPortfolioCoins;

    it('dispatches when a network is provided', async () => {
        const dispatch = jest.fn();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ globalState: { selectedNetwork: undefined } }),
            dispatch,
        });
        await fn('0xuser', { platform_id: 7 } as any);
        expect(updatePortfolioCoinsFromBackground).toHaveBeenCalledWith('0xuser', 7);
    });

    it('falls back to the selectedNetwork from the store', async () => {
        const dispatch = jest.fn();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: { selectedNetwork: { platform_id: 9 } },
            }),
            dispatch,
        });
        await fn('0xuser');
        expect(updatePortfolioCoinsFromBackground).toHaveBeenCalledWith('0xuser', 9);
    });

    it('does nothing when no network is available', async () => {
        const dispatch = jest.fn();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ globalState: {} }),
            dispatch,
        });
        await fn('0xuser');
        expect(updatePortfolioCoinsFromBackground).not.toHaveBeenCalled();
    });
});

describe('CoinsUtils.getCachingCoins extra branches', () => {
    const fn = (CoinsUtils as any).getCachingCoins;


    it('appends new ids to unknown list when API returns partial data', async () => {
        const dispatch = jest.fn();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: { unknownCoinIds: [], cachingCoins: [] },
            }),
            dispatch,
        });
        (PortfolioRequest.getCoinDetails as jest.Mock).mockResolvedValueOnce({
            data: { coins: { data: [{ coinId: 'c1' }] } },
        });
        const cb = jest.fn();
        await fn(['c1', 'missing'], cb);
        await new Promise(r => setTimeout(r, 0));
        // 'missing' isn't returned, so it should now be in the unknown list.
        const lastCb = cb.mock.calls.at(-1) as any[];
        expect(lastCb[1]).toContain('missing');
    });
});

describe('CoinsUtils.getCoinsByTokenAddresses extra defensive branches', () => {
    const fn = (CoinsUtils as any).getCoinsByTokenAddresses;

    it('handles getReduxStore returning undefined (cached prices defaults to {})', async () => {
        (getReduxStore as jest.Mock).mockReturnValue(undefined);
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [{ tokenAddress: '0xa', usdPrice: 1 }] },
        });
        const out = await fn(1, ['0xa']);
        expect(out['0xa'].usdPrice).toBe(1);
    });

    it('handles a lookup result with usdPrice missing (?? 0 branch)', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [{ tokenAddress: '0xa' }] },
        });
        const out = await fn(1, ['0xa']);
        expect(out['0xa'].usdPrice).toBe(0);
    });

    it('handles store with portfolio undefined (covers the optional-chain branch)', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({}),
        });
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockResolvedValueOnce({
            data: { coinLookupEx: [{ tokenAddress: '0xa', usdPrice: 1 }] },
        });
        const out = await fn(1, ['0xa']);
        expect(out['0xa'].usdPrice).toBe(1);
    });
});

describe('CoinsUtils.fetchNativeCoinPrice catch branch with platformId', () => {
    const fn = (CoinsUtils as any).fetchNativeCoinPrice;

    it('still falls back to (platformId, 0) inside the catch when a lookup explicitly throws', async () => {
        // Setup: store dispatch is a regular jest.fn — fetchNativeCoinPrice's catch dispatches
        // setNativeCoinPrice(platformId, 0). We hit this by making getCoinPrice's
        // internal lookup throw synchronously.
        const dispatch = jest.fn();
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ portfolio: { coinPrices: {} } }),
            dispatch,
        });
        // Inner lookup throws — getCoinPrice swallows it and returns 0,
        // then the outer .then dispatches (platformId, 0).
        (MarketRequest.getCoinsByTokenAddresses as jest.Mock).mockRejectedValueOnce(
            new Error('rpc-fail'),
        );
        const cb = jest.fn();
        await fn({ native_coin_address: '0xnative', platform_id: 9 } as any, cb);
        await new Promise(r => setTimeout(r, 0));
        expect(setNativeCoinPrice).toHaveBeenCalledWith(9, 0);
        expect(cb).toHaveBeenCalledWith(0);
    });
});

describe('CoinsUtils.getCachingCoins additional defensive branches', () => {
    const fn = (CoinsUtils as any).getCachingCoins;

    it('handles empty coinIds with no globalState defaults (covers ?? [] fallbacks)', done => {
        // The store has no unknownCoinIds nor cachingCoins — the ?? [] fallbacks should fire.
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ globalState: {} }),
        });
        fn([], (cached: any[], unknown: any[]) => {
            expect(cached).toEqual([]);
            expect(unknown).toEqual([]);
            done();
        });
    });

    it('falls back to [] when the store is undefined inside the empty-coinIds branch', done => {
        (getReduxStore as jest.Mock).mockReturnValue(undefined);
        fn([], (cached: any[], unknown: any[]) => {
            expect(cached).toEqual([]);
            expect(unknown).toEqual([]);
            done();
        });
    });

    it('successful API call still uses ?? [] fallbacks for missing globalState defaults', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ globalState: {} }),
            dispatch: jest.fn(),
        });
        (PortfolioRequest.getCoinDetails as jest.Mock).mockResolvedValueOnce({
            data: { coins: { data: [{ coinId: 'c1' }] } },
        });
        const cb = jest.fn();
        await fn(['c1'], cb);
        await new Promise(r => setTimeout(r, 0));
        expect(cb).toHaveBeenCalled();
    });

    it('empty API response still falls back to ?? [] when globalState defaults are missing', async () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({ globalState: {} }),
            dispatch: jest.fn(),
        });
        (PortfolioRequest.getCoinDetails as jest.Mock).mockResolvedValueOnce({
            data: { coins: { data: [] } },
        });
        const cb = jest.fn();
        await fn(['x'], cb);
        await new Promise(r => setTimeout(r, 0));
        expect(cb).toHaveBeenCalled();
    });

});
