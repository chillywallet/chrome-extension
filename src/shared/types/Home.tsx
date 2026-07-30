import { MarketCoinPrice } from './Wallet';

export enum HomeTabType {
    Explore = 'Explore',
    LegacyWallet = 'Wallet',
    SmartWallet = 'Smart Wallet',
    Schedule = 'Schedule',
}

export enum ExploreTabType {
    Main = 'Explore',
    Coin = 'Coin',
}

export type ExploreTabCoinData = {
    data: MarketCoinPrice[];
    offset: number;
    hasMore: boolean;
};

export type FavoriteLink = {
    name: string;
    link: string;
    logo: string;
    darkLogo?: string;
    type?: 'in-app' | 'external';
    category?: string;
};
