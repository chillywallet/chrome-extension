import { configureStore } from '@reduxjs/toolkit';
import _ from 'lodash';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { DEFAULT_CHAIN } from '../../../../../src/lib/ChainsUtils';
import type { RoutesContextType } from '../../../../../src/ui/pages/RoutesProvider';
import { RoutesContext } from '../../../../../src/ui/pages/RoutesProvider';
import { ExploreTabType } from '../../../../../src/shared/types/Home';
import type { ChillyAccount, ChillyWallet } from '../../../../../src/shared/types/Wallet';

const WALLET_ID = 'wallet-1';
const ACCOUNT_ID = 'account-1';

export function mockAccount(overrides: Partial<ChillyAccount> = {}): ChillyAccount {
    return {
        id: ACCOUNT_ID,
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        type: 'eip155:eoa',
        options: {},
        methods: [],
        metadata: {
            name: 'Test Account',
            importTime: 1,
            keyring: { type: 'HD Key Tree' },
            avatar: undefined,
            smartAvatar: undefined,
            creatingSmartAccount: undefined,
        },
        ...overrides,
    } as ChillyAccount;
}

export function mockWallet(overrides: Partial<ChillyWallet> = {}): ChillyWallet {
    return {
        id: WALLET_ID,
        name: 'Test Wallet',
        importTime: 1,
        ...overrides,
    };
}

/** Minimal Redux tree for Home-related screens; extend via deep merge in tests if selectors need more. */
export function buildHomeReduxState(overrides: Record<string, unknown> = {}) {
    const account = mockAccount();
    const wallet = mockWallet();

    const base = {
        globalState: {
            isInitialized: true,
            isUnlocked: true,
            keyrings: [],
            completedOnboarding: true,
            onboardingStep: 'none',
            internalWallets: {
                wallets: { [WALLET_ID]: wallet },
                selectedWallet: WALLET_ID,
            },
            internalAccounts: {
                accounts: { [ACCOUNT_ID]: account },
                selectedAccount: ACCOUNT_ID,
            },
            user: null,
            cognito: null,
            pushToken: null,
            xAuth: null,
            discordAuth: null,
            oAuth2Request: null,
            preferences: {
                darkMode: false,
                darkModeSystem: false,
                preferColorScheme: 'no-preference' as const,
                ignoreNotification: false,
                appIcon: 'default',
                defaultExploreTab: ExploreTabType.Main,
                favoriteCoins: [],
                useDefaultNetwork: true,
                joinedGuild: false,
                nftCollectionsHideStatus: {},
                nftsHideStatus: {},
                hideTestnetBadge: false,
                enableCluster: false,
                enableAllDomains: false,
                enableChangeIcon: false,
                nnsMetadata: {},
                gasPrice: [],
                addCustomNFTEnabled: false,
                smartWalletEnabled: true,
                priceServiceUrl: '',
                enableReferralProgram: true,
                earnEnabled: true,
                earnList: [{ platformId: DEFAULT_CHAIN.platform_id }] as any,
                bridgeUrl: '',
                referFriendsMessage: '',
                defaultChainId: DEFAULT_CHAIN.chain_id,
                exploreRedDot: false,
                exploreRedDotDate: '',
                xHandleStatus: false,
                customNetworks: [],
                rpcUrls: {},
                drakeConfig: undefined,
                customWalletServiceUrl: '',
                userFlagSet: {},
                gaslessTokens: {},
            },
            karma: {
                streaks: null,
                showKarmaMessage: false,
                multiplier: 1,
                point: 0,
            },
            contacts: [],
            recentContacts: [],
            selectedNetwork: DEFAULT_CHAIN,
            nativeCoinPrices: {},
            pendingTransactions: {},
            cachingCoins: [],
            unknownCoinIds: [],
            customGas: {},
            gasType: {},
            gasOptionsData: {},
            pendingApprovals: {},
            approvalFlows: [],
            subjectMetadata: {},
            subjects: {},
            unapprovedPersonalMsgs: {},
            unapprovedTypedMessages: {},
            rpcTransactions: [],
            nativeTokenBalance: {},
        },
        portfolio: {
            transactions: {},
            nfts: {},
            topCoinsByNetwork: {},
            portfolioCoins: {},
            coinPrices: {},
        },
        remoteFavoriteLinks: [],
        activeTab: null,
        uiState: { isShowLoading: false },
        onRamp: { moonPayIpCheckingResult: null },
        platform: {},
    };

    return _.merge({}, base, overrides) as any;
}

export const defaultRoutesValue: RoutesContextType = {
    sendAssetInitData: undefined,
    sendAssetViewData: undefined,
    coin: undefined,
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
    dispatch: (() => {}) as RoutesContextType['dispatch'],
};

export function renderWithHomeProviders(
    node: React.ReactElement,
    options: {
        state?: Record<string, unknown>;
        routes?: Partial<RoutesContextType>;
    } = {},
) {
    const initialState = buildHomeReduxState(options.state ?? {});
    const store = configureStore({
        reducer: (state = initialState) => state,
        middleware: getDefaultMiddleware =>
            getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
    });
    const routes: RoutesContextType = {
        ...defaultRoutesValue,
        dispatch: store.dispatch as RoutesContextType['dispatch'],
        ...(options.routes ?? {}),
    };

    return (
        <Provider store={store}>
            <MemoryRouter>
                <RoutesContext.Provider value={routes}>{node}</RoutesContext.Provider>
            </MemoryRouter>
        </Provider>
    );
}
