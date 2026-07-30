import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useHistory } from 'react-router-dom';
import { ENVIRONMENT_TYPE_FULLSCREEN } from '../../shared/constants/app';
import {
    ASSET_COIN_DETAIL_ROUTE,
    ASSET_NFT_DETAIL_ROUTE,
    COIN_DETAIL_ROUTE,
    DEFAULT_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
    SEND_ASSET_ROUTE,
    SWAP_ROUTE,
    TX_CONFIRMATION_ROUTE,
} from '../../shared/constants/routes';
import { ChainData } from '../../shared/types/Chain';
import { ExploreTabCoinData } from '../../shared/types/Home';
import {
    Coin,
    ChillyAccount,
    MarketCoinPrice,
    NFT,
    NFTCollection,
    PlatformCoin,
    SendAssetData,
} from '../../shared/types/Wallet';
import { getEnvironmentType } from '../../shared/utils/utils';
import { updateCoinPricesFromBackground } from '../../store/actions/uiActions';
import {
    useActiveTab,
    useCurrentAccount,
    useFirstPermissionRequest,
    useFirstUnapprovedMessage,
    useIsUnlocked,
} from '../../store/selectors';
import {
    useFirstWalletSendCallsApprovalRequest,
    useFirstWalletShowCallsStatusApprovalRequest,
} from '../../store/selectors/eip5792';
import { useFirstUnapprovedNetworkRequest } from '../../store/selectors/network';
import { useFirstUnapprovedTx } from '../../store/selectors/transactions';
import { useCurrentPlatformId } from '../../store/selectors/wallet';
import { getConnectedAccountsForTab } from '../../store/selectorUtils';
import { ReduxDispatch, useAppDispatch } from '../../store/store';

type GasOptionsProps = {
    isCustomGasLimit: boolean;
    newGasLimit: number;
    custom: boolean;
    customData: any;
    fromWCV2: boolean;
    fromLimitSell: boolean;
    network: ChainData | null;
};

export type RoutesContextType = {
    sendAssetInitData?: SendAssetData;
    sendAssetViewData?: SendAssetData;
    coin?: MarketCoinPrice;
    onMarketCoinPress: (coin: MarketCoinPrice) => void;
    onAssetNFTPress: (nft: NFT, isAAWallet: boolean) => void;
    onNFTSendPress: (nft: NFT, isAAWallet: boolean) => void;
    onAssetCoinPress: (coin: Coin, isAAWallet: boolean) => void;
    onCoinSendPress: (coin?: Coin, isAAWallet?: boolean) => void;
    onCoinSwapPress: (coin?: PlatformCoin) => void;
    onUnlockSuccess: () => void;
    onForgotPinCode: () => void;
    prefilledCoinsToSwap?: { fromCoin?: PlatformCoin; toCoin?: PlatformCoin };
    setPrefilledCoinsToSwap: (value?: { fromCoin?: PlatformCoin; toCoin?: PlatformCoin }) => void;
    homeTabIndex: number;
    subTabIndex: number;
    setHomeTabIndex: (value: number) => void;
    setSubTabIndex: (value: number) => void;
    isAAWallet: boolean;
    setIsAAWallet: (value: boolean) => void;
    selectedNFTCollection: NFTCollection | null;
    setSelectedNFTCollection: (value: NFTCollection) => void;
    showHiddenNFTs: boolean;
    setShowHiddenNFTs: (value: boolean) => void;
    showSpamNft: boolean;
    setShowSpamNft: (value: boolean) => void;
    coinSearchText: string;
    setCoinSearchText: (value: string) => void;
    exploreCoinData: ExploreTabCoinData;
    setExploreCoinData: (value: ExploreTabCoinData) => void;
    isFavorite: boolean;
    setIsFavorite: (value: boolean) => void;
    exploreTabIndex: number;
    setExploreTabIndex: (value: number) => void;
    gasOptionsProps?: GasOptionsProps;
    setGasOptionsProps?: (value: GasOptionsProps) => void;
    connectedAccounts: ChillyAccount[];
    isShowNotConnectedModal: boolean;
    setIsShowNotConnectedModal: (value: boolean) => void;
    dispatch: ReduxDispatch;
};

export const RoutesContext = createContext<RoutesContextType>({
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
    gasOptionsProps: undefined,
    setGasOptionsProps: () => {},
    connectedAccounts: [],
    isShowNotConnectedModal: false,
    setIsShowNotConnectedModal: () => {},
    dispatch: (() => {}) as unknown as ReduxDispatch,
});

export const useRoutesData = () => {
    return useContext(RoutesContext);
};

type Props = {
    children: React.ReactNode;
};

export default function RoutesProvider(props: Props) {
    const history = useHistory();
    const firstpermissionRequest = useFirstPermissionRequest();
    const firstUnapproveMsg = useFirstUnapprovedMessage();
    const firstUnapproveTx = useFirstUnapprovedTx();
    const firstNetworkRequest = useFirstUnapprovedNetworkRequest();
    const firstSendCallsRequest = useFirstWalletSendCallsApprovalRequest();
    const firstShowCallsStatusRequest = useFirstWalletShowCallsStatusApprovalRequest();
    const isUnlocked = useIsUnlocked();
    const dispatch = useAppDispatch();
    const activeTab = useActiveTab();
    const currentAccount = useCurrentAccount();
    const platformId = useCurrentPlatformId();

    const [coin, setCoin] = useState<MarketCoinPrice | undefined>();
    const [prefilledCoinsToSwap, setPrefilledCoinsToSwap] = useState<
        { fromCoin?: PlatformCoin; toCoin?: PlatformCoin } | undefined
    >();
    const [sendAssetInitData, setSendAssetInitData] = useState<SendAssetData | undefined>();
    const [sendAssetViewData, setSendAssetViewData] = useState<SendAssetData | undefined>();
    const [homeTabIndex, setHomeTabIndex] = useState(1);
    const [subTabIndex, setSubTabIndex] = useState(0);
    const [exploreTabIndex, setExploreTabIndex] = useState(0);
    const [showSpamNft, setShowSpamNft] = useState(false);
    const [selectedNFTCollection, setSelectedNFTCollection] = useState<NFTCollection | null>(null);
    const [showHiddenNFTs, setShowHiddenNFTs] = useState(false);
    const [isAAWallet, setIsAAWallet] = useState(false);
    const [coinSearchText, setCoinSearchText] = useState('');
    const [exploreCoinData, setExploreCoinData] = useState<ExploreTabCoinData>({
        data: [],
        offset: 0,
        hasMore: false,
    });
    const [isFavorite, setIsFavorite] = useState(false);
    const [gasOptionsProps, setGasOptionsProps] = useState<GasOptionsProps>({
        isCustomGasLimit: false,
        newGasLimit: 0,
        custom: false,
        customData: {},
        fromWCV2: false,
        fromLimitSell: false,
        network: null,
    });
    const [connectedAccounts, setConnectedAccounts] = useState<ChillyAccount[]>([]);
    const [isShowNotConnectedModal, setIsShowNotConnectedModal] = useState(false);

    const onUnlockSuccess = useCallback(async () => {
        history.replace(DEFAULT_ROUTE);
    }, [history]);

    const onForgotPinCode = useCallback(() => {
        if (getEnvironmentType() === ENVIRONMENT_TYPE_FULLSCREEN) {
            history.push(FORGOT_CODE_RECOVER_CODE_ROUTE);
        } else {
            global.platform.openExtensionInBrowser(FORGOT_CODE_RECOVER_CODE_ROUTE);
        }
    }, [history]);

    const onAssetNFTPress = useCallback(
        (nft: NFT, isAAWallet: boolean) => {
            setSendAssetViewData({ nftToSend: nft, isAAWallet });
            history.push(ASSET_NFT_DETAIL_ROUTE);
        },
        [history],
    );

    const onNFTSendPress = useCallback(
        (nft: NFT, isAAWallet: boolean) => {
            setSendAssetInitData({ nftToSend: nft, isAAWallet });
            history.push(SEND_ASSET_ROUTE);
        },
        [history],
    );

    const onAssetCoinPress = useCallback(
        (coin: Coin, isAAWallet: boolean) => {
            setSendAssetViewData({ coinToSend: coin, isAAWallet });
            history.push(ASSET_COIN_DETAIL_ROUTE);
        },
        [history],
    );

    const onCoinSendPress = useCallback(
        (coin?: Coin, isAAWallet: boolean = false) => {
            setSendAssetInitData({ coinToSend: coin, isAAWallet });
            history.push(SEND_ASSET_ROUTE);
        },
        [history],
    );

    const onCoinSwapPress = useCallback(
        (coin?: PlatformCoin) => {
            setPrefilledCoinsToSwap(coin ? { fromCoin: coin } : undefined);
            history.push(SWAP_ROUTE);
        },
        [history],
    );

    const onMarketCoinPress = useCallback(
        (_coin?: MarketCoinPrice) => {
            setCoin(_coin);
            history.push(COIN_DETAIL_ROUTE);
        },
        [history],
    );

    useEffect(() => {
        const _connected = getConnectedAccountsForTab(activeTab?.origin);
        setConnectedAccounts(_connected);
    }, [activeTab?.origin, currentAccount?.address]);

    // Show a notice when the current account is not connected to the active dApp,
    // but the dApp is connected to other accounts.
    useEffect(() => {
        if (!currentAccount || !activeTab?.origin || !connectedAccounts.length) {
            setIsShowNotConnectedModal(false);
            return;
        }

        const isCurrentConnected = connectedAccounts.some(
            account => account.id === currentAccount.id,
        );

        if (isCurrentConnected) {
            setIsShowNotConnectedModal(false);
            return;
        }

        setIsShowNotConnectedModal(true);
    }, [activeTab, connectedAccounts, currentAccount]);

    useEffect(() => {
        if (
            isUnlocked &&
            getEnvironmentType() !== ENVIRONMENT_TYPE_FULLSCREEN &&
            (firstpermissionRequest ||
                firstUnapproveMsg !== null ||
                firstUnapproveTx !== null ||
                firstNetworkRequest !== null ||
                firstSendCallsRequest !== null ||
                firstShowCallsStatusRequest !== null)
        ) {
            history.push(TX_CONFIRMATION_ROUTE);
        }
    }, [
        firstpermissionRequest,
        history,
        firstUnapproveMsg,
        firstUnapproveTx,
        firstNetworkRequest,
        isUnlocked,
        firstSendCallsRequest,
        firstShowCallsStatusRequest,
    ]);

    useEffect(() => {
        dispatch(updateCoinPricesFromBackground(platformId));
    }, [platformId, dispatch]);

    return (
        <RoutesContext.Provider
            value={{
                coin,
                sendAssetInitData,
                sendAssetViewData,
                prefilledCoinsToSwap,
                setPrefilledCoinsToSwap,
                onMarketCoinPress,
                onAssetNFTPress,
                onNFTSendPress,
                onAssetCoinPress,
                onCoinSendPress,
                onCoinSwapPress,
                onForgotPinCode,
                onUnlockSuccess,
                homeTabIndex,
                subTabIndex,
                setHomeTabIndex,
                setSubTabIndex,
                isAAWallet,
                setIsAAWallet,
                selectedNFTCollection,
                setSelectedNFTCollection,
                showHiddenNFTs,
                setShowHiddenNFTs,
                showSpamNft,
                setShowSpamNft,
                coinSearchText,
                setCoinSearchText,
                exploreCoinData,
                setExploreCoinData,
                isFavorite,
                setIsFavorite,
                exploreTabIndex,
                setExploreTabIndex,
                gasOptionsProps,
                setGasOptionsProps,
                connectedAccounts,
                isShowNotConnectedModal,
                setIsShowNotConnectedModal,
                dispatch,
            }}>
            {props.children}
        </RoutesContext.Provider>
    );
}
