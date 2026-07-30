import PortfolioController from '../../src/controller/PortfolioController';

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn() },
}));

function buildMessaging() {
    return {
        registerActionHandler: jest.fn(),
        publish: jest.fn(),
    } as any;
}

function build(state: any = {}) {
    return new PortfolioController({
        state,
        getProviderByPlatformId: jest.fn(),
        verifyTransaction: jest.fn(() => Promise.resolve({ data: { verifyTransaction: true } })),
        messagingSystem: buildMessaging(),
    });
}

describe('PortfolioController', () => {
    it('starts with empty maps', () => {
        const c = build();
        const state = c.store.getState();
        expect(state.portfolioCoins).toEqual({});
        expect(state.coinPrices).toEqual({});
        expect(state.pendingTransactions).toEqual({});
    });

    it('clearState resets to defaults', () => {
        const c = build({ unknownCoinIds: ['x'] });
        c.clearState();
        expect(c.store.getState().unknownCoinIds).toEqual([]);
    });

    it('setUnknownCoins stores list', () => {
        const c = build();
        c.setUnknownCoins(['a', 'b']);
        expect(c.store.getState().unknownCoinIds).toEqual(['a', 'b']);
    });

    it('setCachingCoins stores list', () => {
        const c = build();
        const list = [{ id: 'c1' } as any];
        c.setCachingCoins(list);
        expect(c.store.getState().cachingCoins).toBe(list);
    });

    it('setNativeCoinPrice stores per-platform value', () => {
        const c = build();
        c.setNativeCoinPrice(1, 100);
        expect(c.store.getState().nativeCoinPrices[1]).toBe(100);
    });

    it('setPortfolioCoins publishes newAddress on first insert and stores coins', () => {
        const messaging = buildMessaging();
        const c = new PortfolioController({
            state: {} as any,
            getProviderByPlatformId: jest.fn(),
            verifyTransaction: jest.fn(),
            messagingSystem: messaging,
        });
        c.setPortfolioCoins('0xabc', 1, [{ token_address: '0x1' } as any]);
        expect(messaging.publish).toHaveBeenCalledWith(
            'PortfolioController:newAddress',
            '0xabc',
        );
    });

    it('setPortfolioCoins merges balances from existing entries', () => {
        const c = build();
        c.setPortfolioCoins('0xa', 1, [
            { token_address: '0x1', coin_balance: 10, coin_price: 5 } as any,
        ]);
        c.setPortfolioCoins('0xa', 1, [
            { token_address: '0x1' } as any,
        ]);
        const coin = c.store.getState().portfolioCoins['0xa'][1][0];
        expect(coin.coin_balance).toBe(10);
        expect(coin.coin_price).toBe(5);
    });

    it('getCoinByTokenAddress returns the coin (case-insensitive)', () => {
        const c = build();
        c.setPortfolioCoins('0xa', 1, [{ token_address: '0xToken' } as any]);
        const out = c.getCoinByTokenAddress('0xA', 1, '0xtoken');
        expect(out?.token_address).toBe('0xToken');
    });

    it('setCoinPrices merges per-platform prices', () => {
        const c = build();
        c.setCoinPrices(1, { btc: 50000 } as any);
        c.setCoinPrices(1, { eth: 3000 } as any);
        const prices = c.getCurrentCoinPrices(1);
        expect(prices.btc).toBe(50000);
        expect(prices.eth).toBe(3000);
    });

    it('addPendingTransaction prepends to the list per address+platform', () => {
        const c = build();
        c.addPendingTransaction(1, {
            id: 't1',
            sender: '0xABC',
            txHash: 'h1',
        } as any);
        c.addPendingTransaction(1, {
            id: 't2',
            sender: '0xABC',
            txHash: 'h2',
        } as any);
        const list = c.store.getState().pendingTransactions['0xabc'][1];
        expect(list.map(t => t.id)).toEqual(['t2', 't1']);
    });

    it('removePendingTransactions filters by id', () => {
        const c = build();
        c.setPendingTransactions('0xa', 1, [
            { id: 't1' } as any,
            { id: 't2' } as any,
        ]);
        c.removePendingTransactions('0xa', 1, ['t1']);
        expect(
            c.store.getState().pendingTransactions['0xa'][1].map(t => t.id),
        ).toEqual(['t2']);
    });

    it('removeCompletedTransactions drops sent and failed entries', () => {
        const c = build();
        c.setPendingTransactions('0xa', 1, [
            { id: 't1', status: 'sent' } as any,
            { id: 't2', status: 'sending' } as any,
            { id: 't3', status: 'failed' } as any,
        ]);
        c.removeCompletedTransactions('0xa', 1);
        expect(
            c.store.getState().pendingTransactions['0xa'][1].map(t => t.id),
        ).toEqual(['t2']);
    });

    it('updatePendingTransaction replaces matching id', async () => {
        const c = build();
        c.setPendingTransactions('0xa', 1, [
            { id: 't1', txHash: 'h1' } as any,
        ]);
        await c.updatePendingTransaction(1, {
            id: 't1',
            sender: '0xA',
            txHash: 'updated',
        } as any);
        expect(c.store.getState().pendingTransactions['0xa'][1][0].txHash).toBe('updated');
    });

    it('getPortfolioCoins returns the full nested map', () => {
        const c = build();
        c.setPortfolioCoins('0xa', 1, [{ token_address: '0x1' } as any]);
        expect(c.getPortfolioCoins()).toEqual({
            '0xa': { 1: [{ token_address: '0x1' }] },
        });
    });

    it('getCurrentPortfolioCoins returns an empty list when nothing stored', () => {
        const c = build();
        expect(c.getCurrentPortfolioCoins('0xnone', 99)).toEqual([]);
    });

    it('getCoinByTokenAddress returns undefined when there are no coins', () => {
        const c = build();
        expect(c.getCoinByTokenAddress('0xnone', 1, '0xtoken')).toBeUndefined();
    });

    it('getCoinByTokenAddress returns undefined when tokenAddress is empty', () => {
        const c = build();
        c.setPortfolioCoins('0xa', 1, [{ token_address: '0xtoken' } as any]);
        expect(c.getCoinByTokenAddress('0xa', 1, '')).toBeUndefined();
    });

    it('setPortfolioCoins keeps new coins not present in cache and resets balances if missing', () => {
        const c = build();
        c.setPortfolioCoins('0xa', 1, [
            { token_address: '0xexisting', coin_balance: 99, coin_price: 50 } as any,
        ]);
        c.setPortfolioCoins('0xa', 1, [
            { token_address: '0xnew', coin_balance: 5, coin_price: 1 } as any,
        ]);
        const coins = c.store.getState().portfolioCoins['0xa'][1];
        expect(coins).toHaveLength(1);
        expect(coins[0].token_address).toBe('0xnew');
    });

    it('updatePortfolioCoins updates the matching coin\'s price/balance and leaves the rest alone', () => {
        const c = build();
        c.setPortfolioCoins('0xa', 1, [
            {
                wallet_address: '0xa',
                token_address: '0xtoken',
                platform_id: 1,
                coin_balance: 1,
                coin_price: 2,
            } as any,
            {
                wallet_address: '0xa',
                token_address: '0xother',
                platform_id: 1,
                coin_balance: 9,
                coin_price: 7,
            } as any,
        ]);
        c.updatePortfolioCoins('0xa', 1, [
            {
                wallet_address: '0xa',
                token_address: '0xtoken',
                platform_id: 1,
                coin_balance: 10,
                coin_price: 20,
            } as any,
        ]);
        const list = c.store.getState().portfolioCoins['0xa'][1];
        expect(list[0].coin_balance).toBe(10);
        expect(list[0].coin_price).toBe(20);
        expect(list[1].coin_balance).toBe(9);
    });

    it('updatePortfolioCoins is a no-op when nothing exists for the address', () => {
        const c = build();
        c.updatePortfolioCoins('0xa', 1, [{ token_address: '0xtoken' } as any]);
        expect(c.store.getState().portfolioCoins).toEqual({});
    });


    it('updatePendingTransactionStatus marks tx as failed when receipt status is 0', async () => {
        const provider = {
            getTransactionReceipt: jest.fn().mockResolvedValue({ status: 0 }),
        };
        const c = new PortfolioController({
            state: {} as any,
            getProviderByPlatformId: jest.fn(() => provider as any),
            verifyTransaction: jest.fn(() => Promise.reject(new Error('boom'))),
            messagingSystem: buildMessaging(),
        });
        c.setPendingTransactions('0xa', 1, [
            { id: 't2', sender: '0xA', txHash: '0xfail', status: 'sending' } as any,
        ]);
        const status = await c.updatePendingTransactionStatus(1, {
            id: 't2',
            sender: '0xA',
            txHash: '0xfail',
        } as any);
        expect(status).toBe('failed');
    });

    it('updatePendingTransactionStatus dedupes concurrent requests by key', async () => {
        const provider = {
            getTransactionReceipt: jest.fn().mockResolvedValue({ status: 1 }),
        };
        const c = new PortfolioController({
            state: {} as any,
            getProviderByPlatformId: jest.fn(() => provider as any),
            verifyTransaction: jest.fn(() => Promise.resolve({ data: { verifyTransaction: true } })),
            messagingSystem: buildMessaging(),
        });
        c.setPendingTransactions('0xa', 1, [
            { id: 'dup', sender: '0xA', txHash: '0xsame', status: 'sending' } as any,
        ]);

        const first = c.updatePendingTransactionStatus(1, {
            id: 'dup',
            sender: '0xA',
            txHash: '0xsame',
        } as any);
        const second = c.updatePendingTransactionStatus(1, {
            id: 'dup',
            sender: '0xA',
            txHash: '0xsame',
        } as any);
        expect(await first).toBe('sent');
        expect(await second).toBe('sent');
        expect(provider.getTransactionReceipt).toHaveBeenCalledTimes(1);
    });

    describe('additional defensive branches', () => {
        it('getCurrentCoinPrices returns {} when no entry for that platform', () => {
            const c = build();
            expect(c.getCurrentCoinPrices(123)).toEqual({});
        });

        it('setPortfolioCoins merges entries that have no token_address gracefully', () => {
            const c = build();
            // Seed with a cached coin that has NO token_address (covers the truthy-guard branch).
            c.setPortfolioCoins('0xa', 1, [
                { coin_balance: 5, coin_price: 2 } as any,
            ]);
            // Re-set with another coin: incoming with no token_address → cache lookup yields '' key.
            c.setPortfolioCoins('0xa', 1, [
                { coin_balance: 8 } as any,
            ]);
            const coins = c.store.getState().portfolioCoins['0xa'][1];
            // The incoming coin is kept (no match), and existing coin lacking address is replaced
            // since setPortfolioCoins always replaces the list with the new merged list.
            expect(coins.length).toBe(1);
        });

        it('setPortfolioCoins preserves cached coin_balance/coin_price when incoming has neither', () => {
            const c = build();
            // First seed with full balance/price data.
            c.setPortfolioCoins('0xa', 1, [
                {
                    token_address: '0xt',
                    coin_balance: 100,
                    coin_price: 50,
                } as any,
            ]);
            // Update with the same coin but explicit nulls — cached values should be kept.
            c.setPortfolioCoins('0xa', 1, [
                {
                    token_address: '0xt',
                    coin_balance: null,
                    coin_price: null,
                } as any,
            ]);
            const coin = c.store.getState().portfolioCoins['0xa'][1][0];
            expect(coin.coin_balance).toBe(100);
            expect(coin.coin_price).toBe(50);
        });

        it('setPortfolioCoins keeps the incoming balance/price when they are explicitly provided', () => {
            const c = build();
            c.setPortfolioCoins('0xa', 1, [
                {
                    token_address: '0xt',
                    coin_balance: 1,
                    coin_price: 2,
                } as any,
            ]);
            c.setPortfolioCoins('0xa', 1, [
                {
                    token_address: '0xt',
                    coin_balance: 9,
                    coin_price: 8,
                } as any,
            ]);
            const coin = c.store.getState().portfolioCoins['0xa'][1][0];
            expect(coin.coin_balance).toBe(9);
            expect(coin.coin_price).toBe(8);
        });

        it('updatePortfolioCoins falls back to existing balance/price when the update is missing them', () => {
            const c = build();
            c.setPortfolioCoins('0xa', 1, [
                {
                    wallet_address: '0xa',
                    token_address: '0xt',
                    platform_id: 1,
                    coin_balance: 10,
                    coin_price: 20,
                } as any,
            ]);
            c.updatePortfolioCoins('0xa', 1, [
                {
                    wallet_address: '0xa',
                    token_address: '0xt',
                    platform_id: 1,
                    coin_balance: undefined as any,
                    coin_price: undefined as any,
                } as any,
            ]);
            const coin = c.store.getState().portfolioCoins['0xa'][1][0];
            expect(coin.coin_balance).toBe(10);
            expect(coin.coin_price).toBe(20);
        });

        it('updatePendingTransactionStatus uses transaction.id when no txHash is given', async () => {
            const provider = {
                getTransactionReceipt: jest.fn().mockResolvedValue({ status: 1 }),
            };
            const c = new PortfolioController({
                state: {} as any,
                getProviderByPlatformId: jest.fn(() => provider as any),
                verifyTransaction: jest.fn(() =>
                    Promise.resolve({ data: { verifyTransaction: true } }),
                ),
                messagingSystem: buildMessaging(),
            });
            c.setPendingTransactions('0xa', 1, [
                { id: 'nohash', sender: '0xA' } as any,
            ]);
            const status = await c.updatePendingTransactionStatus(1, {
                id: 'nohash',
                sender: '0xA',
            } as any);
            // Receipt returns status:1 → 'sent'.
            expect(status).toBe('sent');
        });

        it('updatePendingTransactionStatus retries when receipt is initially null', async () => {
            // First call returns null, second returns a status:1 receipt — covers the `if (receipt)` false branch.
            const provider = {
                getTransactionReceipt: jest
                    .fn()
                    .mockResolvedValueOnce(null)
                    .mockResolvedValueOnce({ status: 1 }),
            };
            const c = new PortfolioController({
                state: {} as any,
                getProviderByPlatformId: jest.fn(() => provider as any),
                verifyTransaction: jest.fn(() =>
                    Promise.resolve({ data: { verifyTransaction: true } }),
                ),
                messagingSystem: buildMessaging(),
            });
            c.setPendingTransactions('0xa', 1, [
                { id: 'retry', sender: '0xA', txHash: '0xh', status: 'sending' } as any,
            ]);
            // Speed up the inner sleep so the retry happens quickly.
            jest.useFakeTimers();
            const p = c.updatePendingTransactionStatus(1, {
                id: 'retry',
                sender: '0xA',
                txHash: '0xh',
            } as any);
            await Promise.resolve();
            // Advance through the 1 second sleep so the retry loop continues.
            jest.advanceTimersByTime(1500);
            jest.useRealTimers();
            // Then let the retry complete.
            const status = await p;
            expect(status).toBe('sent');
            expect(provider.getTransactionReceipt).toHaveBeenCalledTimes(2);
        });

        it('updatePendingTransaction is a no-op when no matching id exists', async () => {
            const c = build();
            c.setPendingTransactions('0xa', 1, [
                { id: 'keep', txHash: 'keep' } as any,
            ]);
            await c.updatePendingTransaction(1, {
                id: 'missing',
                sender: '0xA',
                txHash: 'should-not-apply',
            } as any);
            const list = c.store.getState().pendingTransactions['0xa'][1];
            // Only the original entry remains, untouched.
            expect(list).toHaveLength(1);
            expect(list[0].id).toBe('keep');
        });
    });
});
