import { portfolio } from '../../../src/store/reducers/portfolioReducer';
import {
    SET_COIN_PRICES,
    SET_PORTFOLIO_COINS,
    SET_PORTFOLIO_NFTS,
    SET_PORTFOLIO_TRANSACTIONS,
    SET_TOP_COINS_BY_NETWORK,
} from '../../../src/store/actions/globalActions';

describe('portfolio reducer', () => {
    const init = () =>
        portfolio(undefined as any, { type: 'unknown' });

    it('returns initial state for unknown action', () => {
        expect(init()).toEqual({
            transactions: {},
            nfts: {},
            topCoinsByNetwork: {},
            portfolioCoins: {},
            coinPrices: {},
        });
    });

    it('SET_PORTFOLIO_TRANSACTIONS stores transactions under lowercase address', () => {
        const result = portfolio(init() as any, {
            type: SET_PORTFOLIO_TRANSACTIONS,
            address: '0xABC',
            platform_id: 1,
            transactions: [{ id: 'tx1' } as any],
        });
        expect(result.transactions['0xabc'][1]).toEqual([{ id: 'tx1' }]);
    });

    it('SET_PORTFOLIO_TRANSACTIONS returns unchanged state for missing fields', () => {
        const state = init();
        expect(
            portfolio(state as any, {
                type: SET_PORTFOLIO_TRANSACTIONS,
            }),
        ).toBe(state);
    });

    it('SET_PORTFOLIO_NFTS stores nfts under address', () => {
        const result = portfolio(init() as any, {
            type: SET_PORTFOLIO_NFTS,
            address: '0xABC',
            platform_id: 1,
            nfts: [{ name: 'n' } as any],
        });
        expect(result.nfts['0xabc'][1]).toEqual([{ name: 'n' }]);
    });

    it('SET_TOP_COINS_BY_NETWORK', () => {
        const result = portfolio(init() as any, {
            type: SET_TOP_COINS_BY_NETWORK,
            platform_id: 137,
            coins: [{ symbol: 'MATIC' } as any],
        });
        expect(result.topCoinsByNetwork[137]).toEqual([{ symbol: 'MATIC' }]);
    });

    it('SET_PORTFOLIO_COINS stores under address/platform', () => {
        const result = portfolio(init() as any, {
            type: SET_PORTFOLIO_COINS,
            address: '0xABC',
            platform_id: 1,
            portfolioCoins: [{ symbol: 'X' } as any],
        });
        expect(result.portfolioCoins['0xabc'][1]).toEqual([{ symbol: 'X' }]);
    });

    it('SET_COIN_PRICES merges per platform', () => {
        const result = portfolio(init() as any, {
            type: SET_COIN_PRICES,
            platform_id: 1,
            coinPrices: { '0xtoken': { usdPrice: 1, lastUpdated: 0 } } as any,
        });
        expect(result.coinPrices[1]['0xtoken'].usdPrice).toBe(1);
    });

    it('returns state unchanged when SET_COIN_PRICES is missing data', () => {
        const state = init();
        expect(portfolio(state as any, { type: SET_COIN_PRICES })).toBe(state);
    });

    it('SET_PORTFOLIO_NFTS returns unchanged state for missing fields', () => {
        const state = init();
        expect(portfolio(state as any, { type: SET_PORTFOLIO_NFTS })).toBe(state);
    });

    it('SET_TOP_COINS_BY_NETWORK returns unchanged state for missing fields', () => {
        const state = init();
        expect(portfolio(state as any, { type: SET_TOP_COINS_BY_NETWORK })).toBe(state);
    });

    it('SET_PORTFOLIO_COINS returns unchanged state for missing fields', () => {
        const state = init();
        expect(portfolio(state as any, { type: SET_PORTFOLIO_COINS })).toBe(state);
    });
});
