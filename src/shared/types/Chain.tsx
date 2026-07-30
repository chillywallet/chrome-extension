export enum PlatformId {
    Bitcoin = 1,
    Ethereum = 1027,
    Sepolia = -1027,
    BSC = 1839,
    Polygon = 3890,
    Amoy = -3890,
    Solana = 5426,
    Arbitrum = 11841,
    Avalanche = 5805,
    Base = 27716,
    BaseSepolia = -27716,
    MonadTestnet = -10143,
    Monad = 30495,
}

export type Chain =
    | 'bitcoin'
    | 'bsc'
    | 'ethereum'
    | 'ethereum_sepolia'
    | 'goerli'
    | 'polygon'
    | 'polygon_amoy'
    | 'solana'
    | 'optimism'
    | 'arbitrum'
    | 'avalanche'
    | 'monad_testnet'
    | 'base'
    | 'base_sepolia'
    | 'monad';

export enum GasPriceType {
    GasPrice,
    BaseAndPriority,
}

export type ChainRemoteConfig = {
    name: string;
    short_name: string;
    native_coin_symbol: string;
    native_coin_address: string;
    chain: string;
    chain_id: number;
    platform_id: number;
    rpcUrl: string;
    bundlerUrl: string;
    explorer_url: string;
    explorer_name: string;
    testnet: boolean;
    smartWalletSupport: boolean;
    swapSupport: boolean;
    version: string;
};

export type ChainData = {
    name: string;
    short_name: string;
    native_coin_symbol: string;
    native_coin_address: string;
    native_coin_name: string;
    /** Decimals of the native coin; defaults to 18 when omitted. */
    native_coin_decimals?: number;
    native_coin_id?: string;
    chain: string;
    chain_id: number;
    platform_id: number;
    explorer_url: string;
    explorer_name: string;
    chain_key: Chain;
    icon: string;
    opensea_name?: string;
    magiceden_name?: string;
    ensSupport?: boolean;
    limitOrderContractAddress?: string;
    rpcUrl?: string;
    dev?: boolean;
    gasPriceType: GasPriceType;
    testnet?: boolean;
    swapSupport: boolean;
    smartWalletSupport: boolean;
    bundlerUrl?: string;
    viemChain?: any;
    version?: string;
    usdcTokenAddress?: string;
    yieldBridgeSupport?: boolean;
    gasPadding?: number; // padding factor for gas limit
};
