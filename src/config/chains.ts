import {
    abstract as abstractChain,
    apeChain,
    arbitrum,
    aurora,
    avalanche,
    base,
    baseSepolia,
    berachain,
    blast,
    bob,
    bsc,
    celo,
    degen,
    gnosis,
    hyperEvm,
    ink,
    katana,
    linea,
    lisk,
    mainnet,
    mantle,
    metis,
    mode,
    monad,
    monadTestnet,
    moonbeam,
    moonriver,
    opBNB,
    optimism,
    plasma,
    plumeMainnet,
    polygon,
    polygonAmoy,
    scroll,
    sei,
    sepolia,
    soneium,
    sonic,
    taiko,
    unichain,
    worldchain,
    xdc,
    zksync,
    zora,
} from 'viem/chains';
import { EVM_NATIVE_TOKEN_ADDRESS } from '../shared/constants/network';
import { Chain, GasPriceType } from '../shared/types/Chain';
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

// ---------------------------------------------------------------------------
// The wider EVM mainnet set
//
// These follow the same rules as the hand-written entries above, but there are
// enough of them that spelling each one out in full would bury the differences
// that actually matter. One row per chain, expanded by `buildChain` below.
//
// Every field was verified against the provider before being committed:
//   - rpcUrls        eth_chainId returns the expected id
//   - gasPriceType   derived from whether the latest block carries baseFeePerGas
//   - dataProvider   Blockscout instances answer /api/v2/addresses/{a}/token-balances;
//                    the Etherscan V2 ones appear in api.etherscan.io/v2/chainlist
//   - llamaSlug      present in coins.llama.fi/chains
//   - swapSlug       OpenOcean v4 answers /{slug}/tokenList; omitted where it 400s,
//                    which is what leaves swapSupport false for a chain
//
// Blockscout is preferred wherever a public instance exists, because it needs no
// key; the rest fall back to Etherscan V2, which the user's one free key covers.
// ---------------------------------------------------------------------------

type ChainRow = {
    key: Chain;
    id: number;
    name: string;
    short: string;
    /** Native gas coin, e.g. ['ETH', 'Ethereum']. */
    coin: [symbol: string, name: string];
    viem: any;
    explorer: [url: string, name: string];
    icon: string;
    rpcUrls: string[];
    /** Blockscout API root, or 'etherscan' to use the shared Etherscan V2 endpoint. */
    data: string;
    /** DefiLlama chain slug for token prices. */
    llamaSlug: string;
    /** CoinGecko id of the native gas coin — often not the chain's headline token. */
    nativeCoingeckoId: string;
    coingeckoPlatform?: string;
    /** OpenOcean slug; absent means the chain has no swap support. */
    swapSlug?: string;
    /** Set for the chains whose blocks carry no baseFeePerGas. */
    legacyGas?: boolean;
};

const CHAIN_ROWS: ChainRow[] = [
    {
        key: 'optimism',
        id: 10,
        name: 'OP Mainnet',
        short: 'Optimism',
        coin: ['ETH', 'Ethereum'],
        viem: optimism,
        explorer: ['https://optimistic.etherscan.io', 'Optimistic Etherscan'],
        icon: Images.chainOptimism,
        rpcUrls: ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com'],
        data: 'https://explorer.optimism.io',
        llamaSlug: 'optimism',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'optimistic-ethereum',
        swapSlug: 'optimism',
    },
    {
        key: 'zksync',
        id: 324,
        name: 'ZKsync Era',
        short: 'ZKsync',
        coin: ['ETH', 'Ethereum'],
        viem: zksync,
        explorer: ['https://era.zksync.network', 'ZKsync Era Explorer'],
        icon: Images.chainZksync,
        rpcUrls: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org'],
        data: 'https://zksync.blockscout.com',
        llamaSlug: 'era',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'zksync',
        swapSlug: 'zksync',
    },
    {
        key: 'scroll',
        id: 534352,
        name: 'Scroll',
        short: 'Scroll',
        coin: ['ETH', 'Ethereum'],
        viem: scroll,
        explorer: ['https://scrollscan.com', 'Scrollscan'],
        icon: Images.chainScroll,
        rpcUrls: ['https://rpc.scroll.io', 'https://scroll-rpc.publicnode.com'],
        // scroll.blockscout.com 301s cross-host to scrollscan.com, which is what
        // actually serves the Blockscout v2 API — so point at it directly.
        data: 'https://scrollscan.com',
        llamaSlug: 'scroll',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'scroll',
        swapSlug: 'scroll',
    },
    {
        key: 'zora',
        id: 7777777,
        name: 'Zora',
        short: 'Zora',
        coin: ['ETH', 'Ethereum'],
        viem: zora,
        explorer: ['https://explorer.zora.energy', 'Zora Explorer'],
        icon: Images.chainZora,
        rpcUrls: ['https://rpc.zora.energy', 'https://zora.drpc.org'],
        data: 'https://explorer.zora.energy',
        llamaSlug: 'zora',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'zora-network',
    },
    {
        key: 'mode',
        id: 34443,
        name: 'Mode',
        short: 'Mode',
        coin: ['ETH', 'Ethereum'],
        viem: mode,
        explorer: ['https://modescan.io', 'Modescan'],
        icon: Images.chainMode,
        rpcUrls: ['https://mainnet.mode.network', 'https://mode.drpc.org'],
        data: 'https://explorer.mode.network',
        llamaSlug: 'mode',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'mode',
        swapSlug: 'mode',
    },
    {
        key: 'metis',
        id: 1088,
        name: 'Metis Andromeda',
        short: 'Metis',
        coin: ['METIS', 'Metis'],
        viem: metis,
        explorer: ['https://explorer.metis.io', 'Metis Explorer'],
        icon: Images.chainMetis,
        rpcUrls: ['https://andromeda.metis.io/?owner=1088', 'https://metis.drpc.org'],
        data: 'https://andromeda-explorer.metis.io',
        llamaSlug: 'metis',
        nativeCoingeckoId: 'metis-token',
        coingeckoPlatform: 'metis-andromeda',
        swapSlug: 'metis',
        legacyGas: true,
    },
    {
        key: 'ink',
        id: 57073,
        name: 'Ink',
        short: 'Ink',
        coin: ['ETH', 'Ethereum'],
        viem: ink,
        explorer: ['https://explorer.inkonchain.com', 'Ink Explorer'],
        icon: Images.chainInk,
        rpcUrls: ['https://rpc-gel.inkonchain.com', 'https://ink.drpc.org'],
        data: 'https://explorer.inkonchain.com',
        llamaSlug: 'ink',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'ink',
    },
    {
        key: 'soneium',
        id: 1868,
        name: 'Soneium',
        short: 'Soneium',
        coin: ['ETH', 'Ethereum'],
        viem: soneium,
        explorer: ['https://soneium.blockscout.com', 'Soneium Explorer'],
        icon: Images.chainSoneium,
        rpcUrls: ['https://rpc.soneium.org', 'https://soneium.drpc.org'],
        data: 'https://soneium.blockscout.com',
        llamaSlug: 'soneium',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'soneium',
    },
    {
        key: 'lisk',
        id: 1135,
        name: 'Lisk',
        short: 'Lisk',
        coin: ['ETH', 'Ethereum'],
        viem: lisk,
        explorer: ['https://blockscout.lisk.com', 'Lisk Explorer'],
        icon: Images.chainLisk,
        rpcUrls: ['https://rpc.api.lisk.com', 'https://lisk.drpc.org'],
        data: 'https://blockscout.lisk.com',
        llamaSlug: 'lisk',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'lisk',
    },
    {
        key: 'aurora',
        id: 1313161554,
        name: 'Aurora',
        short: 'Aurora',
        coin: ['ETH', 'Ethereum'],
        viem: aurora,
        explorer: ['https://explorer.aurora.dev', 'Aurora Explorer'],
        icon: Images.chainAurora,
        rpcUrls: ['https://mainnet.aurora.dev', 'https://aurora.drpc.org'],
        data: 'https://explorer.aurora.dev',
        llamaSlug: 'aurora',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'aurora',
        swapSlug: 'aurora',
        legacyGas: true,
    },
    {
        key: 'gnosis',
        id: 100,
        name: 'Gnosis',
        short: 'Gnosis',
        coin: ['XDAI', 'xDAI'],
        viem: gnosis,
        explorer: ['https://gnosisscan.io', 'Gnosisscan'],
        icon: Images.chainGnosis,
        rpcUrls: ['https://rpc.gnosischain.com', 'https://gnosis-rpc.publicnode.com'],
        data: 'https://gnosis.blockscout.com',
        llamaSlug: 'xdai',
        nativeCoingeckoId: 'xdai',
        coingeckoPlatform: 'xdai',
        swapSlug: 'xdai',
    },
    {
        key: 'celo',
        id: 42220,
        name: 'Celo',
        short: 'Celo',
        coin: ['CELO', 'Celo'],
        viem: celo,
        explorer: ['https://celoscan.io', 'Celoscan'],
        icon: Images.chainCelo,
        rpcUrls: ['https://forno.celo.org', 'https://celo-rpc.publicnode.com'],
        data: 'https://celo.blockscout.com',
        llamaSlug: 'celo',
        nativeCoingeckoId: 'celo',
        coingeckoPlatform: 'celo',
        swapSlug: 'celo',
    },
    {
        key: 'unichain',
        id: 130,
        name: 'Unichain',
        short: 'Unichain',
        coin: ['ETH', 'Ethereum'],
        viem: unichain,
        explorer: ['https://uniscan.xyz', 'Uniscan'],
        icon: Images.chainUnichain,
        rpcUrls: ['https://mainnet.unichain.org', 'https://unichain-rpc.publicnode.com'],
        data: 'https://unichain.blockscout.com',
        llamaSlug: 'unichain',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'unichain',
    },
    {
        key: 'bob',
        id: 60808,
        name: 'BOB',
        short: 'BOB',
        coin: ['ETH', 'Ethereum'],
        viem: bob,
        explorer: ['https://explorer.gobob.xyz', 'BOB Explorer'],
        icon: Images.chainBob,
        rpcUrls: ['https://rpc.gobob.xyz', 'https://bob.drpc.org'],
        data: 'https://explorer.gobob.xyz',
        llamaSlug: 'bob',
        nativeCoingeckoId: 'ethereum',
    },
    {
        key: 'degen',
        id: 666666666,
        name: 'Degen Chain',
        short: 'Degen',
        coin: ['DEGEN', 'Degen'],
        viem: degen,
        explorer: ['https://explorer.degen.tips', 'Degen Explorer'],
        icon: Images.chainDegen,
        rpcUrls: ['https://rpc.degen.tips'],
        data: 'https://explorer.degen.tips',
        llamaSlug: 'degen',
        nativeCoingeckoId: 'degen-base',
        coingeckoPlatform: 'degen',
    },
    {
        key: 'plume',
        id: 98866,
        name: 'Plume',
        short: 'Plume',
        coin: ['PLUME', 'Plume'],
        viem: plumeMainnet,
        explorer: ['https://explorer.plume.org', 'Plume Explorer'],
        icon: Images.chainPlume,
        rpcUrls: ['https://rpc.plume.org'],
        data: 'https://explorer.plume.org',
        llamaSlug: 'plume_mainnet',
        nativeCoingeckoId: 'plume',
        coingeckoPlatform: 'plume-network',
        swapSlug: 'plume',
    },
    {
        key: 'taiko',
        id: 167000,
        name: 'Taiko',
        short: 'Taiko',
        coin: ['ETH', 'Ethereum'],
        viem: taiko,
        explorer: ['https://taikoscan.io', 'Taikoscan'],
        icon: Images.chainTaiko,
        rpcUrls: ['https://rpc.mainnet.taiko.xyz', 'https://taiko-rpc.publicnode.com'],
        data: 'https://blockscoutapi.mainnet.taiko.xyz',
        llamaSlug: 'taiko',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'taiko',
    },
    {
        key: 'worldchain',
        id: 480,
        name: 'World Chain',
        short: 'World',
        coin: ['ETH', 'Ethereum'],
        viem: worldchain,
        explorer: ['https://worldscan.org', 'Worldscan'],
        icon: Images.chainWorldchain,
        rpcUrls: ['https://worldchain-mainnet.g.alchemy.com/public'],
        data: 'https://worldchain-mainnet.explorer.alchemy.com',
        llamaSlug: 'wc',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'world-chain',
    },
    {
        key: 'linea',
        id: 59144,
        name: 'Linea',
        short: 'Linea',
        coin: ['ETH', 'Ethereum'],
        viem: linea,
        explorer: ['https://lineascan.build', 'Lineascan'],
        icon: Images.chainLinea,
        rpcUrls: ['https://rpc.linea.build', 'https://linea-rpc.publicnode.com'],
        data: 'etherscan',
        llamaSlug: 'linea',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'linea',
        swapSlug: 'linea',
    },
    {
        key: 'blast',
        id: 81457,
        name: 'Blast',
        short: 'Blast',
        coin: ['ETH', 'Ethereum'],
        viem: blast,
        explorer: ['https://blastscan.io', 'Blastscan'],
        icon: Images.chainBlast,
        rpcUrls: ['https://rpc.blast.io', 'https://blast-rpc.publicnode.com'],
        data: 'etherscan',
        llamaSlug: 'blast',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'blast',
        swapSlug: 'blast',
    },
    {
        key: 'mantle',
        id: 5000,
        name: 'Mantle',
        short: 'Mantle',
        coin: ['MNT', 'Mantle'],
        viem: mantle,
        explorer: ['https://mantlescan.xyz', 'Mantlescan'],
        icon: Images.chainMantle,
        rpcUrls: ['https://rpc.mantle.xyz', 'https://mantle-rpc.publicnode.com'],
        data: 'etherscan',
        llamaSlug: 'mantle',
        nativeCoingeckoId: 'mantle',
        coingeckoPlatform: 'mantle',
        swapSlug: 'mantle',
    },
    {
        key: 'opbnb',
        id: 204,
        name: 'opBNB',
        short: 'opBNB',
        coin: ['BNB', 'BNB'],
        viem: opBNB,
        explorer: ['https://opbnb.bscscan.com', 'opBNBScan'],
        icon: Images.chainOpbnb,
        rpcUrls: ['https://opbnb-mainnet-rpc.bnbchain.org', 'https://opbnb-rpc.publicnode.com'],
        data: 'etherscan',
        llamaSlug: 'op_bnb',
        nativeCoingeckoId: 'binancecoin',
        coingeckoPlatform: 'opbnb',
        swapSlug: 'opbnb',
    },
    {
        key: 'sonic',
        id: 146,
        name: 'Sonic',
        short: 'Sonic',
        coin: ['S', 'Sonic'],
        viem: sonic,
        explorer: ['https://sonicscan.org', 'Sonicscan'],
        icon: Images.chainSonic,
        rpcUrls: ['https://rpc.soniclabs.com', 'https://sonic-rpc.publicnode.com'],
        data: 'etherscan',
        llamaSlug: 'sonic',
        nativeCoingeckoId: 'sonic-3',
        coingeckoPlatform: 'sonic',
        swapSlug: 'sonic',
    },
    {
        key: 'berachain',
        id: 80094,
        name: 'Berachain',
        short: 'Berachain',
        coin: ['BERA', 'Bera'],
        viem: berachain,
        explorer: ['https://berascan.com', 'Berascan'],
        icon: Images.chainBerachain,
        rpcUrls: ['https://rpc.berachain.com', 'https://berachain-rpc.publicnode.com'],
        data: 'etherscan',
        llamaSlug: 'berachain',
        nativeCoingeckoId: 'berachain-bera',
        coingeckoPlatform: 'berachain',
        swapSlug: 'bera',
    },
    {
        key: 'sei',
        id: 1329,
        name: 'Sei Network',
        short: 'Sei',
        coin: ['SEI', 'Sei'],
        viem: sei,
        explorer: ['https://seitrace.com', 'Seitrace'],
        icon: Images.chainSei,
        rpcUrls: ['https://evm-rpc.sei-apis.com', 'https://sei-evm-rpc.publicnode.com'],
        data: 'etherscan',
        llamaSlug: 'sei',
        nativeCoingeckoId: 'sei-network',
        coingeckoPlatform: 'sei-v2',
        swapSlug: 'sei',
    },
    {
        key: 'apechain',
        id: 33139,
        name: 'ApeChain',
        short: 'ApeChain',
        coin: ['APE', 'ApeCoin'],
        viem: apeChain,
        explorer: ['https://apescan.io', 'Apescan'],
        icon: Images.chainApechain,
        rpcUrls: ['https://rpc.apechain.com', 'https://apechain.drpc.org'],
        data: 'etherscan',
        llamaSlug: 'apechain',
        nativeCoingeckoId: 'apecoin',
        coingeckoPlatform: 'apechain',
    },
    {
        key: 'hyperevm',
        id: 999,
        name: 'HyperEVM',
        short: 'HyperEVM',
        coin: ['HYPE', 'Hyperliquid'],
        viem: hyperEvm,
        explorer: ['https://hyperevmscan.io', 'HyperEVMScan'],
        icon: Images.chainHyperevm,
        rpcUrls: ['https://rpc.hyperliquid.xyz/evm', 'https://hyperliquid.drpc.org'],
        data: 'etherscan',
        llamaSlug: 'hyperliquid',
        nativeCoingeckoId: 'hyperliquid',
        coingeckoPlatform: 'hyperevm',
    },
    {
        key: 'katana',
        id: 747474,
        name: 'Katana',
        short: 'Katana',
        coin: ['ETH', 'Ethereum'],
        viem: katana,
        explorer: ['https://katanascan.com', 'Katanascan'],
        icon: Images.chainKatana,
        rpcUrls: ['https://rpc.katana.network', 'https://katana.drpc.org'],
        data: 'etherscan',
        llamaSlug: 'katana',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'katana',
    },
    {
        key: 'plasma',
        id: 9745,
        name: 'Plasma',
        short: 'Plasma',
        coin: ['XPL', 'Plasma'],
        viem: plasma,
        explorer: ['https://plasmascan.to', 'Plasmascan'],
        icon: Images.chainPlasma,
        rpcUrls: ['https://rpc.plasma.to', 'https://plasma.drpc.org'],
        data: 'etherscan',
        llamaSlug: 'plasma',
        nativeCoingeckoId: 'plasma',
        coingeckoPlatform: 'plasma',
    },
    {
        key: 'abstract',
        id: 2741,
        name: 'Abstract',
        short: 'Abstract',
        coin: ['ETH', 'Ethereum'],
        viem: abstractChain,
        explorer: ['https://abscan.org', 'Abscan'],
        icon: Images.chainAbstract,
        rpcUrls: ['https://api.mainnet.abs.xyz', 'https://abstract.drpc.org'],
        data: 'etherscan',
        llamaSlug: 'abstract',
        nativeCoingeckoId: 'ethereum',
        coingeckoPlatform: 'abstract',
    },
    {
        key: 'moonbeam',
        id: 1284,
        name: 'Moonbeam',
        short: 'Moonbeam',
        coin: ['GLMR', 'Glimmer'],
        viem: moonbeam,
        explorer: ['https://moonscan.io', 'Moonscan'],
        icon: Images.chainMoonbeam,
        rpcUrls: ['https://rpc.api.moonbeam.network', 'https://moonbeam-rpc.publicnode.com'],
        data: 'etherscan',
        llamaSlug: 'moonbeam',
        nativeCoingeckoId: 'moonbeam',
        coingeckoPlatform: 'moonbeam',
    },
    {
        key: 'moonriver',
        id: 1285,
        name: 'Moonriver',
        short: 'Moonriver',
        coin: ['MOVR', 'Moonriver'],
        viem: moonriver,
        explorer: ['https://moonriver.moonscan.io', 'Moonscan'],
        icon: Images.chainMoonriver,
        rpcUrls: [
            'https://rpc.api.moonriver.moonbeam.network',
            'https://moonriver-rpc.publicnode.com',
        ],
        data: 'etherscan',
        llamaSlug: 'moonriver',
        nativeCoingeckoId: 'moonriver',
        coingeckoPlatform: 'moonriver',
        swapSlug: 'moonriver',
    },
    {
        key: 'xdc',
        id: 50,
        name: 'XDC Network',
        short: 'XDC',
        coin: ['XDC', 'XDC'],
        viem: xdc,
        explorer: ['https://xdcscan.com', 'XDCScan'],
        icon: Images.chainXdc,
        rpcUrls: ['https://rpc.xdc.org', 'https://rpc.xdcrpc.com'],
        data: 'etherscan',
        llamaSlug: 'xdc',
        nativeCoingeckoId: 'xdce-crowd-sale',
        coingeckoPlatform: 'xdc-network',
    },
];

function buildChain(row: ChainRow): ChainConfig {
    const [symbol, coinName] = row.coin;
    const [explorerUrl, explorerName] = row.explorer;

    return {
        name: row.name,
        short_name: row.short,
        native_coin_symbol: symbol,
        native_coin_address: EVM_NATIVE_TOKEN_ADDRESS,
        native_coin_name: coinName,
        chain: row.short,
        chain_id: row.id,
        platform_id: row.id, // unified with chain_id
        chain_key: row.key,
        explorer_url: explorerUrl,
        explorer_name: explorerName,
        icon: row.icon,
        gasPriceType: row.legacyGas ? GasPriceType.GasPrice : GasPriceType.BaseAndPriority,
        testnet: false,
        swapSupport: !!row.swapSlug,
        smartWalletSupport: false,
        viemChain: row.viem,

        rpcUrls: row.rpcUrls,
        rpcUrl: row.rpcUrls[0],
        dataProvider:
            row.data === 'etherscan'
                ? {
                      kind: 'etherscan',
                      baseUrl: ETHERSCAN_V2_BASE_URL,
                      apiKeyRef: 'etherscan',
                  }
                : { kind: 'blockscout', baseUrl: row.data },
        priceProvider: {
            kind: 'defillama',
            llamaSlug: row.llamaSlug,
            coingeckoPlatform: row.coingeckoPlatform,
            nativeCoingeckoId: row.nativeCoingeckoId,
        },
        swapProvider: row.swapSlug
            ? { kind: 'openocean', providerChainSlug: row.swapSlug }
            : { kind: 'none' },
    };
}

/** The table above, expanded into full configs. */
export const ADDITIONAL_CHAINS: ChainConfig[] = CHAIN_ROWS.map(buildChain);

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
    ...ADDITIONAL_CHAINS,

    // Testnet
    CHAIN_CONFIG_MONAD_TESTNET,
    CHAIN_CONFIG_BASE_SEPOLIA,
    CHAIN_CONFIG_SEPOLIA,
    CHAIN_CONFIG_AMOY,
];
