import { EVM_NATIVE_TOKEN_ADDRESS } from '../shared/constants/network';
import {
    EARN_PARTNERS,
    EarnCoin,
    EarnListItem,
    EarnType,
    StakingType,
} from '../shared/types/Earn';
import { GasPriceSetting, RemoteData } from '../shared/types/Global';

/**
 * App-wide static defaults. This file replaces Firebase Remote Config: every
 * value the wallet previously fetched remotely now has a committed default
 * here (or was removed together with its feature).
 */

/**
 * Default selected chain: Ethereum. Ethereum is Blockscout-backed, so a fresh
 * install works with no API key at all (see getDataProviderPresets in chains.ts).
 */
export const DEFAULT_CHAIN_ID = 1;

/**
 * NNS (nad.domains) name-service metadata. Previously `nns_metadata_chrome`
 * remote-config; resolves .nad names on Monad via api.nad.domains.
 */
export const NNS_METADATA = {
    label: 'nad',
    chain_id: 143,
};

/**
 * Per-chain gas-price settings. Empty = every chain uses on-chain
 * `getFeeData()` estimation (type 'default'). A `type: 'custom'` entry with a
 * `url_pattern` pointing at an Etherscan-style gas oracle can be added per
 * chain here.
 */
export const GAS_PRICE_SETTINGS: GasPriceSetting[] = [];

/**
 * Static feature flags. Previously email-whitelist gates in remote config.
 * - enableCluster is off because Clusters name resolution requires an API key
 *   that shipped with the old backend build.
 */
export const FEATURE_FLAGS = {
    enableCluster: false,
    enableAllDomains: true, // on-chain resolution via @onsol/tldparser
    enableChangeIcon: true,
    addCustomNFTEnabled: true,
    // Fiat on/off-ramp. Off: the provider integration is not currently wired up,
    // so the Buy/Sell actions render disabled with a "Coming Soon" tooltip.
    buyEnabled: false,
    sellEnabled: false,
};

/**
 * Static Earn catalogue: on-chain liquid staking on Monad. Previously the
 * `earn_page_chrome` remote config; the backend-driven Yield vaults are gone.
 * The staked (share) token address is the ERC-4626-style vault contract itself
 * (see src/lib/liquid-staking/*).
 */
const MONAD_PLATFORM_ID = 143; // platform ids are unified with chain ids

const MON_COIN: EarnCoin = {
    name: 'Monad',
    symbol: 'MON',
    imageUrl: '',
    tokenAddress: EVM_NATIVE_TOKEN_ADDRESS,
    decimals: 18,
};

function makeStakingItem(params: {
    type: EarnType;
    name: string;
    partnerName: string;
    description: string;
    contractAddress: string;
    shareSymbol: string;
    requestsMerged: boolean;
}): EarnListItem {
    const partner = EARN_PARTNERS.find(p => p.name === params.partnerName);
    const toCoin: EarnCoin = {
        name: params.shareSymbol,
        symbol: params.shareSymbol,
        imageUrl: partner?.imageUrl ?? '',
        tokenAddress: params.contractAddress,
        decimals: 18,
    };

    return {
        enabled: true,
        name: params.name,
        imageUrl: partner?.imageUrl ?? '',
        platformId: MONAD_PLATFORM_ID,
        stakingType: StakingType.Staking,
        tokenAddress: params.contractAddress,
        decimals: 18,
        partner_name: params.partnerName,
        partner,
        fromCoin: MON_COIN,
        toCoin,
        data: [
            {
                type: params.type,
                name: params.name,
                description: params.description,
                platformId: MONAD_PLATFORM_ID,
                fromCoin: MON_COIN,
                toCoin,
                partner_name: params.partnerName,
                partner,
                requestsMerged: params.requestsMerged,
                enabled: true,
            },
        ],
    };
}

export const STATIC_EARN_LIST: EarnListItem[] = [
    makeStakingItem({
        type: EarnType.aPriori,
        name: 'aPriori Liquid Staking',
        partnerName: 'aPriori',
        description:
            'Stake MON with aPriori, the MEV-powered liquid staking protocol on Monad, and receive aprMON.',
        contractAddress: '0xb2f82D0f38dc453D596Ad40A37799446Cc89274A',
        shareSymbol: 'aprMON',
        requestsMerged: false,
    }),
    makeStakingItem({
        type: EarnType.Kintsu,
        name: 'Kintsu Liquid Staking',
        partnerName: 'Kintsu',
        description:
            'Stake MON with Kintsu, the composable liquid staking protocol on Monad, and receive sMON.',
        contractAddress: '0xA3227C5969757783154C60bF0bC1944180ed81B9',
        shareSymbol: 'sMON',
        requestsMerged: false,
    }),
    makeStakingItem({
        type: EarnType.FastLane,
        name: 'shMonad Liquid Staking',
        partnerName: 'FastLane',
        description:
            'Stake MON with shMonad by FastLane Labs and receive shMON while earning staking rewards.',
        contractAddress: '0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c',
        shareSymbol: 'shMON',
        requestsMerged: true,
    }),
];

/**
 * The static replacement for the remote-config payload that FirebaseHandler
 * used to dispatch. Shape-compatible with `setRemoteData` so all downstream
 * preference plumbing is unchanged.
 */
export const STATIC_REMOTE_DATA: RemoteData = {
    enableCluster: FEATURE_FLAGS.enableCluster,
    enableAllDomains: FEATURE_FLAGS.enableAllDomains,
    enableChangeIcon: FEATURE_FLAGS.enableChangeIcon,
    nnsMetadata: NNS_METADATA,
    gasPrice: GAS_PRICE_SETTINGS,
    addCustomNFTEnabled: FEATURE_FLAGS.addCustomNFTEnabled,
    earnEnabled: true,
    buyEnabled: FEATURE_FLAGS.buyEnabled,
    sellEnabled: FEATURE_FLAGS.sellEnabled,
    earnList: STATIC_EARN_LIST,
    bridgeUrl: '',
    defaultChainId: DEFAULT_CHAIN_ID,
    rpcUrls: {},
};
