import { activeTab, globalState, platform, remoteFavoriteLinks } from '../../../src/store/reducers/globalReducer';
import {
    SET_FAVORITE_LIST,
    SET_GLOBAL_STATE,
    SET_MOONPAY_IP_CHECKING_RESULT,
    SET_PORTFOLIO_NFTS,
    SET_PORTFOLIO_TRANSACTIONS,
    SET_TOP_COINS_BY_NETWORK,
    setFavoriteList,
    setGlobalState,
    setMoonPayIpCheckingResult,
    setPortfolioNfts,
    setPortfolioTransactions,
    setTopCoinsByNetwork,
} from '../../../src/store/actions/globalActions';

jest.mock('../../../src/lib/ExtensionPlatform', () => {
    return jest.fn().mockImplementation(() => ({ name: 'extension-platform' }));
});

describe('globalState reducer', () => {
    it('returns initial state for unknown action', () => {
        const state = globalState(undefined as any, { type: 'unknown' });
        expect(state).toHaveProperty('isInitialized');
        expect(state).toHaveProperty('isUnlocked');
    });

    it('SET_GLOBAL_STATE merges into state', () => {
        const state = globalState(undefined as any, {
            type: SET_GLOBAL_STATE,
            state: { isUnlocked: true } as any,
        });
        expect(state.isUnlocked).toBe(true);
    });
});

describe('remoteFavoriteLinks reducer', () => {
    it('returns initial empty list for unknown action', () => {
        expect(remoteFavoriteLinks(undefined as any, { type: 'unknown' } as any)).toEqual([]);
    });

    it('SET_FAVORITE_LIST sets state', () => {
        const next: any = [{ key: 'a' }];
        expect(
            remoteFavoriteLinks([], { type: SET_FAVORITE_LIST, state: next }),
        ).toEqual(next);
    });
});

describe('activeTab reducer', () => {
    it('returns initial null state for unknown action', () => {
        expect(activeTab(undefined as any, { type: 'unknown' })).toBeNull();
    });
});

describe('platform reducer', () => {
    it('returns a platform instance', () => {
        expect(platform()).toBeDefined();
    });
});

describe('globalActions thunks', () => {
    it('setGlobalState dispatches SET_GLOBAL_STATE', () => {
        const dispatch = jest.fn();
        setGlobalState({ isUnlocked: true } as any)(dispatch);
        expect(dispatch).toHaveBeenCalledWith({
            type: SET_GLOBAL_STATE,
            state: { isUnlocked: true },
        });
    });

    it('setFavoriteList dispatches SET_FAVORITE_LIST', () => {
        const dispatch = jest.fn();
        const links: any = [{ key: 'a' }];
        setFavoriteList(links)(dispatch);
        expect(dispatch).toHaveBeenCalledWith({
            type: SET_FAVORITE_LIST,
            state: links,
        });
    });

    it('setPortfolioTransactions dispatches SET_PORTFOLIO_TRANSACTIONS and lowercases address', () => {
        const dispatch = jest.fn();
        const txs: any = [{ id: 't1' }];
        setPortfolioTransactions('0xABCDEF', 1, txs)(dispatch);
        expect(dispatch).toHaveBeenCalledWith({
            type: SET_PORTFOLIO_TRANSACTIONS,
            address: '0xabcdef',
            platform_id: 1,
            transactions: txs,
        });
    });

    it('setPortfolioNfts dispatches SET_PORTFOLIO_NFTS and lowercases address', () => {
        const dispatch = jest.fn();
        const nfts: any = [{ _id: 'n1' }];
        setPortfolioNfts('0xABC', 2, nfts)(dispatch);
        expect(dispatch).toHaveBeenCalledWith({
            type: SET_PORTFOLIO_NFTS,
            address: '0xabc',
            platform_id: 2,
            nfts,
        });
    });

    it('setTopCoinsByNetwork dispatches SET_TOP_COINS_BY_NETWORK', () => {
        const dispatch = jest.fn();
        const coins: any = [{ id: 'c1' }];
        setTopCoinsByNetwork(3, coins)(dispatch);
        expect(dispatch).toHaveBeenCalledWith({
            type: SET_TOP_COINS_BY_NETWORK,
            platform_id: 3,
            coins,
        });
    });


});
