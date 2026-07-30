import type { ReduxDispatch } from '../../../../../src/store/store';
import type { RoutesContextType } from '../../../../../src/ui/pages/RoutesProvider';

const noopDispatch = (() => {}) as unknown as ReduxDispatch;

export function sendRoutesContextFixture(
    overrides: Partial<RoutesContextType> = {},
): RoutesContextType {
    return {
        onMarketCoinPress: () => {},
        onAssetNFTPress: () => {},
        onNFTSendPress: () => {},
        onAssetCoinPress: () => {},
        onCoinSendPress: () => {},
        onCoinSwapPress: () => {},
        onUnlockSuccess: () => {},
        onForgotPinCode: () => {},
        prefilledCoinsToSwap: undefined,
        setPrefilledCoinsToSwap: () => {},
        homeTabIndex: 0,
        subTabIndex: 0,
        setHomeTabIndex: () => {},
        setSubTabIndex: () => {},
        isAAWallet: false,
        setIsAAWallet: () => {},
        selectedNFTCollection: null,
        setSelectedNFTCollection: () => {},
        showHiddenNFTs: false,
        setShowHiddenNFTs: () => {},
        showSpamNft: false,
        setShowSpamNft: () => {},
        coinSearchText: '',
        setCoinSearchText: () => {},
        exploreCoinData: { data: [], offset: 0, hasMore: false },
        setExploreCoinData: () => {},
        isFavorite: false,
        setIsFavorite: () => {},
        exploreTabIndex: 0,
        setExploreTabIndex: () => {},
        referralTabIndex: 0,
        setReferralTabIndex: () => {},
        gasOptionsProps: undefined,
        setGasOptionsProps: () => {},
        connectedAccounts: [],
        isShowNotConnectedModal: false,
        setIsShowNotConnectedModal: () => {},
        dispatch: noopDispatch,
        ...overrides,
    };
}
