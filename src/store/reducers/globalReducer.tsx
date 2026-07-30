import {
    PermissionConstraint,
    PermissionControllerSubjects,
    SubjectMetadata,
} from '@metamask/permission-controller';
import { Contact } from '../../api/graphQL/Types';
import { ChainUserOverride } from '../../config/types';
import { ApprovalControllerState, ApprovalRequest } from '../../controller/ApprovalController';
import { KeyringObject } from '../../controller/KeyringController';
import { StateMessage } from '../../controller/SignatureController';
import { DEFAULT_CHAIN } from '../../lib/ChainsUtils';
import ExtensionPlatform from '../../lib/ExtensionPlatform';
import { ActiveTab } from '../../shared/types/BrowserTab';
import { ChainData } from '../../shared/types/Chain';
import { EarnListItem } from '../../shared/types/Earn';
import { GasPriceSetting } from '../../shared/types/Global';
import { ExploreTabType, FavoriteLink } from '../../shared/types/Home';
import { OnboardingStep } from '../../shared/types/Onboarding';
import { TransactionMeta } from '../../shared/types/Transaction';
import {
    CachingCoin,
    GasInfo,
    GasOptionsData,
    GasType,
    ChillyAccount,
    ChillyWallet,
    MarketCoinPrice,
    PendingTransaction,
} from '../../shared/types/Wallet';
import { SET_FAVORITE_LIST, SET_GLOBAL_STATE } from '../actions/globalActions';

export type GlobalState = {
    isInitialized: boolean;
    isUnlocked: boolean;
    keyrings: KeyringObject[];
    completedOnboarding: boolean;
    onboardingStep: OnboardingStep;
    internalWallets: {
        wallets: Record<string, ChillyWallet>;
        selectedWallet: string;
    };
    internalAccounts: {
        accounts: Record<string, ChillyAccount>;
        selectedAccount: string;
    };
    preferences: {
        darkMode: boolean;
        darkModeSystem: boolean;
        preferColorScheme: 'no-preference' | 'light' | 'dark';
        ignoreNotification: boolean;
        appIcon: string;
        defaultExploreTab: ExploreTabType;
        favoriteCoins: MarketCoinPrice[];
        useDefaultNetwork: boolean;
        nftCollectionsHideStatus: { [key: string]: boolean };
        nftsHideStatus: { [key: string]: boolean };
        hideTestnetBadge: boolean;

        // Beta features
        enableCluster: boolean;
        enableAllDomains: boolean;
        enableChangeIcon: boolean;
        nnsMetadata: {
            label?: string;
            chain_id?: number;
        };
        gasPrice: GasPriceSetting[];
        addCustomNFTEnabled: boolean;
        earnEnabled: boolean;
        buyEnabled: boolean;
        sellEnabled: boolean;
        earnList: EarnListItem[];
        bridgeUrl: string;
        defaultChainId: number;

        // Highlight UIs
        exploreRedDot: boolean;
        exploreRedDotDate: string;

        // Custom networks (per-chain rpcUrl and/or dataProvider overrides)
        customNetworks: ChainUserOverride[];

        // Remote RPC URLs (optional, keyed by chain_id as string)
        rpcUrls: { [chain_id: string]: string };

        // Data-provider API keys, keyed by apiKeyRef (see src/config/apiKeys.ts)
        apiKeys?: Record<string, string>;

    };
    contacts: Contact[];
    recentContacts: Contact[];
    selectedNetwork: ChainData;
    nativeCoinPrices: Record<number, number>;
    pendingTransactions: Record<string, Record<number, PendingTransaction[]>>;
    cachingCoins: CachingCoin[];
    unknownCoinIds: string[];
    customGas: Record<number, GasInfo>;
    gasType: Record<number, GasType>;
    gasOptionsData: Record<number, GasOptionsData>;
    pendingApprovals: Record<string, ApprovalRequest<Record<string, any>>>;
    approvalFlows: ApprovalControllerState['approvalFlows'];
    subjectMetadata: Record<string, SubjectMetadata>;
    subjects: PermissionControllerSubjects<PermissionConstraint>;
    unapprovedPersonalMsgs: Record<string, StateMessage>;
    unapprovedTypedMessages: Record<string, StateMessage>;
    rpcTransactions: TransactionMeta[];
    nativeTokenBalance: { [key: string]: { [key: string]: string } };
};

const initGlobalState: GlobalState = {
    isInitialized: false,

    // Keyring controller
    isUnlocked: false,
    keyrings: [],

    // Onboarding controller
    completedOnboarding: false,
    onboardingStep: 'none',

    // Accounts controller
    internalWallets: {
        wallets: {},
        selectedWallet: '',
    },
    internalAccounts: {
        accounts: {},
        selectedAccount: '',
    },

    // Preferences controller
    preferences: {
        darkMode: false,
        darkModeSystem: true,
        preferColorScheme: 'no-preference',
        ignoreNotification: false,
        appIcon: 'default',
        defaultExploreTab: ExploreTabType.Main,
        favoriteCoins: [],
        useDefaultNetwork: true,
        nftCollectionsHideStatus: {},
        nftsHideStatus: {},
        hideTestnetBadge: false,

        // Beta features
        enableCluster: true,
        enableAllDomains: true,
        enableChangeIcon: false,
        nnsMetadata: {},
        gasPrice: [],
        addCustomNFTEnabled: true,
        earnEnabled: true,
        buyEnabled: false,
        sellEnabled: false,
        earnList: [],
        bridgeUrl: '',
        defaultChainId: DEFAULT_CHAIN.chain_id,

        // Highlight UIs
        exploreRedDot: true,
        exploreRedDotDate: '',

        // Custom networks
        customNetworks: [],

        // Remote RPC URLs
        rpcUrls: {},

        // Data-provider API keys
        apiKeys: {},

    },

    // Contacts controller
    contacts: [],
    recentContacts: [],

    // Network controller
    selectedNetwork: DEFAULT_CHAIN,

    // Portfolio controller
    nativeCoinPrices: {},
    pendingTransactions: {},
    cachingCoins: [],
    unknownCoinIds: [],

    // Gas controller
    customGas: {},
    gasType: {},
    gasOptionsData: {},

    // Approval controller
    pendingApprovals: {},
    approvalFlows: [],

    // Permission controller
    subjectMetadata: {},
    subjects: {},

    // Signature controller
    unapprovedPersonalMsgs: {},
    unapprovedTypedMessages: {},

    // Transaction controler
    rpcTransactions: [],
    nativeTokenBalance: {},
};

const initActiveTab = null;

export const globalState = (
    state: GlobalState = initGlobalState,
    action: { type: string; state?: GlobalState },
) => {
    switch (action.type) {
        case SET_GLOBAL_STATE:
            return { ...state, ...action.state };

        default:
            return state;
    }
};

const initRemoteFavoriteLinksState: FavoriteLink[] = [];

export const remoteFavoriteLinks = (
    state: FavoriteLink[] = initRemoteFavoriteLinksState,
    action: { type: string; state: FavoriteLink[] },
) => {
    switch (action.type) {
        case SET_FAVORITE_LIST:
            return action.state;

        default:
            return state;
    }
};

export const activeTab = (
    state: ActiveTab | null = initActiveTab,
    action: { [key: string]: any },
) => {
    switch (action.type) {
        default:
            return state;
    }
};

const initPlatform = new ExtensionPlatform();

export const platform = () => {
    return initPlatform;
};
