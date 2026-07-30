import {
    arbitrum,
    avalanche,
    base,
    baseSepolia,
    bsc,
    mainnet,
    monad,
    monadTestnet,
    polygon,
    polygonAmoy,
    sepolia,
} from 'viem/chains';
import { EVM_NATIVE_TOKEN_ADDRESS } from '../shared/constants/network';
import { GasPriceType } from '../shared/types/Chain';
import { Images } from '../shared/utils/Images';
import { ChainConfig, DataProviderConfig } from './types';

/**
 * The committed chain registry: chainId -> { rpc, dataProvider, priceProvider, swapProvider }.
 *
 * This file is the single source of truth for chain configuration. All RPC
 * endpoints are public and free; data providers are free APIs (some need a
 * free user-supplied key, see `apiKeyRef` / src/config/apiKeys.ts).
 *
 * To switch a chain to a different data provider, edit its `dataProvider`
 * entry here (or override it at runtime via preferences.customNetworks).
 */

const ETHERSCAN_V2_BASE_URL = 'https://api.etherscan.io/v2/api';

export const CHAIN_CONFIG_MONAD: ChainConfig = {
    name: 'Monad',
    short_name: 'Monad',
    native_coin_symbol: 'MON',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Monad',
    chain: 'Monad',
    chain_id: 143,
    platform_id: 143, // unified with chain_id
    chain_key: 'monad',
    explorer_url: 'https://monadexplorer.com',
    explorer_name: 'Monad Explorer',
    icon: Images.monadLogo,
    gasPriceType: GasPriceType.BaseAndPriority,
    testnet: false,
    swapSupport: true,
    smartWalletSupport: false,
    viemChain: monad,
    usdcTokenAddress: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    gasPadding: 105, // 5% padding for Monad

    rpcUrls: ['https://rpc.monad.xyz', 'https://monad.drpc.org'],
    rpcUrl: 'https://rpc.monad.xyz',
    // Etherscan V2 covers Monad as chainid=143 (this is the monadscan backend), so the
    // one free Etherscan key also unlocks BSC/Amoy/etc. BlockVision remains available as
    // an opt-in alternative with better NFT data — see DATA_PROVIDER_PRESETS.
    dataProvider: { kind: 'etherscan', baseUrl: ETHERSCAN_V2_BASE_URL, apiKeyRef: 'etherscan' },
    priceProvider: { kind: 'defillama', llamaSlug: 'monad' },
    swapProvider: { kind: 'openocean', providerChainSlug: 'monad' },
};

export const CHAIN_CONFIG_BASE: ChainConfig = {
    name: 'Base',
    short_name: 'Base',
    native_coin_symbol: 'ETH',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Ethereum',
    chain: 'Base',
    chain_id: 8453,
    platform_id: 8453, // unified with chain_id
    chain_key: 'base',
    explorer_url: 'https://basescan.org',
    explorer_name: 'BaseScan',
    icon: Images.coinBase,
    gasPriceType: GasPriceType.BaseAndPriority,
    testnet: false,
    swapSupport: true,
    smartWalletSupport: false,
    viemChain: base,
    usdcTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',

    rpcUrls: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    rpcUrl: 'https://mainnet.base.org',
    dataProvider: { kind: 'blockscout', baseUrl: 'https://base.blockscout.com' },
    priceProvider: { kind: 'defillama', llamaSlug: 'base', coingeckoPlatform: 'base' },
    swapProvider: { kind: 'openocean', providerChainSlug: 'base' },
};

export const CHAIN_CONFIG_POLYGON: ChainConfig = {
    name: 'Polygon',
    short_name: 'Polygon',
    native_coin_symbol: 'POL',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Polygon',
    chain: 'Polygon',
    chain_id: 137,
    platform_id: 137, // unified with chain_id
    chain_key: 'polygon',
    opensea_name: 'matic',
    magiceden_name: 'polygon',
    explorer_url: 'https://polygonscan.com',
    explorer_name: 'PolygonScan',
    icon: Images.coinMATIC,
    gasPriceType: GasPriceType.BaseAndPriority,
    swapSupport: true,
    smartWalletSupport: false,
    viemChain: polygon,
    usdcTokenAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',

    // polygon-rpc.com stopped responding; publicnode is the verified primary.
    rpcUrls: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org'],
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    dataProvider: { kind: 'blockscout', baseUrl: 'https://polygon.blockscout.com' },
    priceProvider: { kind: 'defillama', llamaSlug: 'polygon', coingeckoPlatform: 'polygon-pos' },
    swapProvider: { kind: 'openocean', providerChainSlug: 'polygon' },
};

export const CHAIN_CONFIG_ETHEREUM: ChainConfig = {
    name: 'Ethereum Mainnet',
    short_name: 'Ethereum',
    native_coin_symbol: 'ETH',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Ethereum',
    chain: 'ETH',
    chain_id: 1,
    platform_id: 1, // unified with chain_id
    chain_key: 'ethereum',
    opensea_name: 'ethereum',
    magiceden_name: 'eth',
    explorer_url: 'https://etherscan.io',
    explorer_name: 'Etherscan',
    icon: Images.coinETH,
    ensSupport: true,
    gasPriceType: GasPriceType.BaseAndPriority,
    swapSupport: true,
    smartWalletSupport: false,
    viemChain: mainnet,
    usdcTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',

    // eth.llamarpc.com stopped responding and was dropped.
    rpcUrls: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    dataProvider: { kind: 'blockscout', baseUrl: 'https://eth.blockscout.com' },
    priceProvider: { kind: 'defillama', llamaSlug: 'ethereum', coingeckoPlatform: 'ethereum' },
    swapProvider: { kind: 'openocean', providerChainSlug: 'eth' },
};

export const CHAIN_CONFIG_BSC: ChainConfig = {
    name: 'BNB Chain (BEP20)',
    short_name: 'BSC',
    native_coin_symbol: 'BNB',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'BNB',
    chain: 'BSC',
    chain_id: 56,
    platform_id: 56, // unified with chain_id
    chain_key: 'bsc',
    explorer_url: 'https://bscscan.com',
    explorer_name: 'BscScan',
    icon: Images.coinBNB,
    gasPriceType: GasPriceType.GasPrice,
    swapSupport: true,
    smartWalletSupport: false,
    viemChain: bsc,
    usdcTokenAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',

    rpcUrls: ['https://bsc-dataseed.bnbchain.org', 'https://bsc-rpc.publicnode.com'],
    rpcUrl: 'https://bsc-dataseed.bnbchain.org',
    dataProvider: { kind: 'etherscan', baseUrl: ETHERSCAN_V2_BASE_URL, apiKeyRef: 'etherscan' },
    priceProvider: { kind: 'defillama', llamaSlug: 'bsc', coingeckoPlatform: 'binance-smart-chain' },
    swapProvider: { kind: 'openocean', providerChainSlug: 'bsc' },
};

export const CHAIN_CONFIG_ARBITRUM: ChainConfig = {
    name: 'Arbitrum One',
    short_name: 'Arbitrum',
    native_coin_symbol: 'ETH',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Ethereum',
    chain: 'Arbitrum',
    chain_id: 42161,
    platform_id: 42161, // unified with chain_id
    chain_key: 'arbitrum',
    explorer_url: 'https://arbiscan.io',
    explorer_name: 'Arbiscan',
    icon: Images.coinArbitrum,
    gasPriceType: GasPriceType.BaseAndPriority,
    swapSupport: true,
    smartWalletSupport: false,
    viemChain: arbitrum,
    usdcTokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',

    rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'],
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    dataProvider: { kind: 'blockscout', baseUrl: 'https://arbitrum.blockscout.com' },
    priceProvider: { kind: 'defillama', llamaSlug: 'arbitrum', coingeckoPlatform: 'arbitrum-one' },
    swapProvider: { kind: 'openocean', providerChainSlug: 'arbitrum' },
};

export const CHAIN_CONFIG_AVALANCHE: ChainConfig = {
    name: 'Avalanche (C-Chain)',
    short_name: 'Avalanche',
    native_coin_symbol: 'AVAX',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Avalanche',
    chain: 'AVAX',
    chain_id: 43114,
    platform_id: 43114, // unified with chain_id
    chain_key: 'avalanche',
    explorer_url: 'https://snowtrace.io',
    explorer_name: 'Snowtrace',
    icon: Images.coinAVAX,
    gasPriceType: GasPriceType.BaseAndPriority,
    swapSupport: true,
    smartWalletSupport: false,
    viemChain: avalanche,
    usdcTokenAddress: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',

    rpcUrls: [
        'https://api.avax.network/ext/bc/C/rpc',
        'https://avalanche-c-chain-rpc.publicnode.com',
    ],
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    // Routescan's Etherscan-compatible API for Avalanche is free without a key
    dataProvider: {
        kind: 'etherscan',
        baseUrl: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api',
    },
    priceProvider: { kind: 'defillama', llamaSlug: 'avax', coingeckoPlatform: 'avalanche' },
    swapProvider: { kind: 'openocean', providerChainSlug: 'avax' },
};

// ---------------------------------------------------------------------------
// Testnets
// ---------------------------------------------------------------------------

export const CHAIN_CONFIG_MONAD_TESTNET: ChainConfig = {
    name: 'Monad Testnet',
    short_name: 'Monad Testnet',
    native_coin_symbol: 'MON',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Monad',
    chain: 'Monad',
    chain_id: 10143,
    platform_id: 10143, // unified with chain_id
    chain_key: 'monad_testnet',
    explorer_url: 'https://testnet.monadexplorer.com',
    explorer_name: 'Monad Explorer',
    icon: Images.monadLogo,
    gasPriceType: GasPriceType.BaseAndPriority,
    testnet: true,
    swapSupport: false,
    smartWalletSupport: false,
    viemChain: monadTestnet,

    rpcUrls: ['https://testnet-rpc.monad.xyz'],
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    // Etherscan V2 chainid=10143; see the note on CHAIN_CONFIG_MONAD.
    dataProvider: { kind: 'etherscan', baseUrl: ETHERSCAN_V2_BASE_URL, apiKeyRef: 'etherscan' },
    priceProvider: { kind: 'none' },
    swapProvider: { kind: 'none' },
};

export const CHAIN_CONFIG_BASE_SEPOLIA: ChainConfig = {
    name: 'Base Sepolia',
    short_name: 'Base Sepolia',
    native_coin_symbol: 'ETH',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Ethereum',
    chain: 'Base',
    chain_id: 84532,
    platform_id: 84532, // unified with chain_id
    chain_key: 'base_sepolia',
    explorer_url: 'https://sepolia.basescan.org',
    explorer_name: 'BaseScan (Sepolia)',
    icon: Images.coinBaseSepolia,
    gasPriceType: GasPriceType.BaseAndPriority,
    testnet: true,
    swapSupport: false,
    smartWalletSupport: false,
    viemChain: baseSepolia,

    rpcUrls: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
    rpcUrl: 'https://sepolia.base.org',
    dataProvider: { kind: 'blockscout', baseUrl: 'https://base-sepolia.blockscout.com' },
    priceProvider: { kind: 'none' },
    swapProvider: { kind: 'none' },
};

export const CHAIN_CONFIG_SEPOLIA: ChainConfig = {
    name: 'Sepolia (ETH)',
    short_name: 'Sepolia',
    native_coin_symbol: 'ETH',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Ethereum',
    chain: 'ETH',
    chain_id: 11155111,
    platform_id: 11155111, // unified with chain_id
    chain_key: 'ethereum_sepolia',
    explorer_url: 'https://sepolia.etherscan.io',
    explorer_name: 'Etherscan',
    icon: Images.coinETH,
    gasPriceType: GasPriceType.BaseAndPriority,
    testnet: true,
    swapSupport: false,
    smartWalletSupport: false,
    viemChain: sepolia,

    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.org'],
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    dataProvider: { kind: 'blockscout', baseUrl: 'https://eth-sepolia.blockscout.com' },
    priceProvider: { kind: 'none' },
    swapProvider: { kind: 'none' },
};

export const CHAIN_CONFIG_AMOY: ChainConfig = {
    name: 'Amoy (Polygon)',
    short_name: 'Amoy',
    native_coin_symbol: 'POL',
    native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
    native_coin_name: 'Polygon',
    chain: 'Polygon',
    chain_id: 80002,
    platform_id: 80002, // unified with chain_id
    chain_key: 'polygon_amoy',
    explorer_url: 'https://amoy.polygonscan.com',
    explorer_name: 'PolygonScan',
    icon: Images.coinMATIC,
    gasPriceType: GasPriceType.GasPrice,
    testnet: true,
    swapSupport: false,
    smartWalletSupport: false,
    viemChain: polygonAmoy,

    // rpc-amoy.polygon.technology stopped responding; publicnode is the verified primary.
    rpcUrls: ['https://polygon-amoy-bor-rpc.publicnode.com', 'https://polygon-amoy.drpc.org'],
    rpcUrl: 'https://polygon-amoy-bor-rpc.publicnode.com',
    dataProvider: { kind: 'etherscan', baseUrl: ETHERSCAN_V2_BASE_URL, apiKeyRef: 'etherscan' },
    priceProvider: { kind: 'none' },
    swapProvider: { kind: 'none' },
};

/**
 * BlockVision indexer endpoints, kept as an opt-in alternative for the Monad chains.
 * Not a committed default: it needs its own key, whereas Etherscan V2 reuses the one
 * key that already covers every other chain here.
 */
const BLOCKVISION_BASE_URLS: Record<number, string> = {
    143: 'https://api.blockvision.org/v2/monad',
    10143: 'https://api.blockvision.org/v2/monad-testnet',
};

/** A selectable data-provider option for a chain, rendered by the Developer Settings picker. */
export type DataProviderPreset = DataProviderConfig & {
    /** Stable identifier for the picker (`kind:baseUrl`). */
    id: string;
    label: string;
    /** Short tradeoff note shown under the label. */
    note?: string;
    /** True when this is the committed default for the chain. */
    isDefault?: boolean;
};

function presetId(config: DataProviderConfig): string {
    return `${config.kind}:${config.baseUrl}`;
}

function labelFor(config: DataProviderConfig): string {
    if (config.kind === 'blockscout') return 'Blockscout';
    if (config.kind === 'blockvision') return 'BlockVision';
    if (config.kind === 'etherscan') {
        return config.baseUrl.includes('routescan') ? 'Routescan' : 'Etherscan V2';
    }
    return 'None';
}

function noteFor(config: DataProviderConfig): string {
    if (config.kind === 'blockvision') return 'Dedicated indexer — best NFT data. Needs its own key.';
    if (config.kind === 'blockscout') return 'Free, no API key required.';
    if (config.kind === 'etherscan') {
        return config.apiKeyRef
            ? 'One free key covers every supported chain. NFTs derived from transfer history.'
            : 'Etherscan-compatible, free without a key.';
    }
    return 'Disable holdings, history and NFTs for this chain.';
}

/**
 * The data providers a user may choose from for a chain: the committed default first,
 * then any known-good alternatives, then 'none'.
 *
 * Every chain in this registry is present in the Etherscan V2 chain list
 * (https://api.etherscan.io/v2/chainlist), so Etherscan V2 is always offered.
 */
export function getDataProviderPresets(chainId: number): DataProviderPreset[] {
    const chain = CHAINS.find(entry => entry.chain_id === chainId);

    if (!chain) {
        return [];
    }

    const configs: DataProviderConfig[] = [chain.dataProvider];

    const etherscan: DataProviderConfig = {
        kind: 'etherscan',
        baseUrl: ETHERSCAN_V2_BASE_URL,
        apiKeyRef: 'etherscan',
    };
    if (!configs.some(config => presetId(config) === presetId(etherscan))) {
        configs.push(etherscan);
    }

    const blockvisionBaseUrl = BLOCKVISION_BASE_URLS[chainId];
    if (blockvisionBaseUrl) {
        configs.push({
            kind: 'blockvision',
            baseUrl: blockvisionBaseUrl,
            apiKeyRef: 'blockvision',
        });
    }

    configs.push({ kind: 'none', baseUrl: '' });

    return configs.map((config, index) => ({
        ...config,
        id: presetId(config),
        label: labelFor(config),
        note: noteFor(config),
        isDefault: index === 0,
    }));
}

/** Ordered chain registry: mainnets first (Ethereum is the default chain), then testnets. */
export const CHAINS: ChainConfig[] = [
    CHAIN_CONFIG_ETHEREUM,
    CHAIN_CONFIG_MONAD,
    CHAIN_CONFIG_BASE,
    CHAIN_CONFIG_POLYGON,
    CHAIN_CONFIG_BSC,
    CHAIN_CONFIG_ARBITRUM,
    CHAIN_CONFIG_AVALANCHE,

    // Testnet
    CHAIN_CONFIG_MONAD_TESTNET,
    CHAIN_CONFIG_BASE_SEPOLIA,
    CHAIN_CONFIG_SEPOLIA,
    CHAIN_CONFIG_AMOY,
];
