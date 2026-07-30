import { FavoriteLink } from '../../shared/types/Home';
import { NFTList, PlatformCoin, Transaction } from '../../shared/types/Wallet';
import { ReduxState } from '../store';

export const SET_GLOBAL_STATE = 'SET_GLOBAL_STATE';
export const SET_FAVORITE_LIST = 'SET_FAVORITE_LIST';
export const SET_PORTFOLIO_TRANSACTIONS = 'SET_PORTFOLIO_TRANSACTIONS';
export const SET_PORTFOLIO_COINS = 'SET_PORTFOLIO_COINS';
export const SET_PORTFOLIO_NFTS = 'SET_PORTFOLIO_NFTS';
export const SET_TOP_COINS_BY_NETWORK = 'SET_TOP_COINS_BY_NETWORK';
export const SET_COIN_PRICES = 'SET_COIN_PRICES';

export const setGlobalState = (state: ReduxState['globalState']) => (dispatch: Function) => {
    dispatch({
        type: SET_GLOBAL_STATE,
        state,
    });
};

export const setFavoriteList = (state: FavoriteLink[]) => (dispatch: Function) => {
    dispatch({
        type: SET_FAVORITE_LIST,
        state,
    });
};

export const setPortfolioTransactions =
    (address: string, platform_id: number, transactions: Transaction[]) => (dispatch: Function) => {
        dispatch({
            type: SET_PORTFOLIO_TRANSACTIONS,
            address: address.toLowerCase(),
            platform_id,
            transactions,
        });
    };

export const setPortfolioNfts =
    (address: string, platform_id: number, nfts: NFTList[]) => (dispatch: Function) => {
        dispatch({
            type: SET_PORTFOLIO_NFTS,
            address: address.toLowerCase(),
            platform_id,
            nfts,
        });
    };

export const setTopCoinsByNetwork =
    (platform_id: number, coins: PlatformCoin[]) => (dispatch: Function) => {
        dispatch({
            type: SET_TOP_COINS_BY_NETWORK,
            platform_id,
            coins,
        });
    };
