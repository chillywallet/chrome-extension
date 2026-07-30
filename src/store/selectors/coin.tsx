import { useSelector } from 'react-redux';
import { ChainData } from '../../shared/types/Chain';
import { PlatformCoin } from '../../shared/types/Wallet';
import { ReduxState } from '../store';
import { useCurrentPlatformId } from './wallet';

const defaultTopCoinsByCurrentNetwork: PlatformCoin[] = [];

export const useTopCoinsByNetwork = (network?: ChainData) => {
    let platformId = useCurrentPlatformId();

    if (network) {
        platformId = network.platform_id;
    }

    const data = useSelector((state: ReduxState) => state.portfolio?.topCoinsByNetwork || {});
    const result = data && data[platformId] ? data[platformId] : defaultTopCoinsByCurrentNetwork;
    return result;
};

export const useCachingCoins = () => {
    return useSelector((state: ReduxState) => state.globalState.cachingCoins);
};

export const useUnknownCoinIds = () => {
    return useSelector((state: ReduxState) => state.globalState.unknownCoinIds);
};
