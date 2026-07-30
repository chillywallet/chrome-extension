import { Coin, CoinPrice, NFTList, PlatformCoin, Transaction } from '../../shared/types/Wallet';
import {
    SET_COIN_PRICES,
    SET_PORTFOLIO_COINS,
    SET_PORTFOLIO_NFTS,
    SET_PORTFOLIO_TRANSACTIONS,
    SET_TOP_COINS_BY_NETWORK,
} from '../actions/globalActions';

export type PortfolioState = {
    transactions: Record<string, Record<number, Transaction[]>>;
    nfts: Record<string, Record<number, NFTList[]>>;
    topCoinsByNetwork: Record<number, PlatformCoin[]>;
    portfolioCoins: Record<string, Record<number, Coin[]>>;
    coinPrices: Record<number, CoinPrice>;
};

const initPortfolioState: PortfolioState = {
    transactions: {},
    nfts: {},
    topCoinsByNetwork: {},
    portfolioCoins: {},
    coinPrices: {},
};

export const portfolio = (
    state: PortfolioState = initPortfolioState,
    action: {
        type: string;
        address?: string;
        platform_id?: number;
        transactions?: Transaction[];
        nfts?: NFTList[];
        coins?: PlatformCoin[];
        portfolioCoins?: Coin[];
        coinPrices?: CoinPrice;
    },
) => {
    switch (action.type) {
        case SET_PORTFOLIO_TRANSACTIONS:
            if (action.address && action.platform_id !== undefined && action.transactions) {
                const normalizedAddress = action.address.toLowerCase();
                return {
                    ...state,
                    transactions: {
                        ...state.transactions,
                        [normalizedAddress]: {
                            ...(state.transactions[normalizedAddress] || {}),
                            [action.platform_id]: action.transactions,
                        },
                    },
                };
            }
            return state;

        case SET_PORTFOLIO_NFTS:
            if (action.address && action.platform_id !== undefined && action.nfts) {
                const normalizedAddress = action.address.toLowerCase();
                return {
                    ...state,
                    nfts: {
                        ...state.nfts,
                        [normalizedAddress]: {
                            ...(state.nfts[normalizedAddress] || {}),
                            [action.platform_id]: action.nfts,
                        },
                    },
                };
            }
            return state;

        case SET_TOP_COINS_BY_NETWORK:
            if (action.platform_id !== undefined && action.coins) {
                return {
                    ...state,
                    topCoinsByNetwork: {
                        ...state.topCoinsByNetwork,
                        [action.platform_id]: action.coins,
                    },
                };
            }
            return state;

        case SET_PORTFOLIO_COINS:
            if (action.address && action.platform_id !== undefined && action.portfolioCoins) {
                const normalizedAddress = action.address.toLowerCase();
                return {
                    ...state,
                    portfolioCoins: {
                        ...state.portfolioCoins,
                        [normalizedAddress]: {
                            ...state.portfolioCoins[normalizedAddress],
                            [action.platform_id]: action.portfolioCoins,
                        },
                    },
                };
            }

            return state;

        case SET_COIN_PRICES:
            if (action.platform_id !== undefined && action.coinPrices) {
                return {
                    ...state,
                    coinPrices: {
                        ...state.coinPrices,
                        [action.platform_id]: {
                            ...state.coinPrices[action.platform_id],
                            ...action.coinPrices,
                        },
                    },
                };
            }

            return state;
        default:
            return state;
    }
};
