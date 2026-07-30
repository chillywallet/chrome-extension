import { InternalAccount } from '@metamask/keyring-api';
import { TransactionRequest } from 'ethers';
import { Chain, ChainData } from './Chain';

export type Pagination = {
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    size: number;
    totalCount: number;
    totalPages: number;
};

export interface AccountMetadata {
    importTime: number;
    lastSelected?: number;
    name: string;
    avatar?: null | string;
    smartAvatar?: null | string;
    keyring: { type: string };
    creatingSmartAccount?: boolean;
    status?: WalletStatus['status'];
    isDefault?: boolean;
    verifying?: boolean;
    deleted?: boolean;
}

export type ChillyWallet = {
    id: string;
    name: string;
    importTime: number;
    lastSelected?: number;
};

export interface ChillyAccount extends InternalAccount {
    smartAddress?: string;
    metadata: AccountMetadata;
}

export type HoldingWallet = {
    walletName: string;
    walletAddress: string;
};

export type Coin = Omit<CoinHoldingGroup, 'items'> & {
    coin_price?: number;
    coin_balance?: number;
    decimals?: number;
};

type NFTMarketplace = {
    marketplace_name: string;
    collection_url: string;
};

type NFTFloorPriceMarketplace = {
    marketplace_id: string;
    marketplace_name: string;
    value: number;
};

type NFTModelExtraMetadataAttributes = {
    trait_type: string;
    value: string;
};

type NFTModelExtraMetadata = {
    attributes: NFTModelExtraMetadataAttributes[];
    image_original_url: string;
    animation_original_url: string;
};

export type NFTCollection = {
    _id: string;
    collection_id: string;
    floor_price: number;
    image_url: string;
    items: NFT[];
    marketplace_pages: NFTMarketplace[];
    name: string;
    platform_id: number;
    spamThreshold?: number;
    spam_score: number;
    total_price: number;
    chain: string;
};

export type NFT = {
    _id: string;
    wallet_address: string;
    contract: {
        type: string;
        name: string;
    };
    contract_address: string;
    current_usd_value: number;
    image_url: string;
    token_id: string;
    nft_collection: {
        _id: string;
        collection_id: string;
        floor_price: number;
        floor_prices?: NFTFloorPriceMarketplace[];
        image_url: string;
        description?: string;
        marketplace_pages: NFTMarketplace[];
        name: string;
        spam_score: number;
        external_url?: string;
        spamThreshold?: number;
    };
    estimate_eth_price?: number;
    name: string;
    description?: string;
    previews: {
        blurhash: string;
        image_medium_url: string;
        image_small_url: string;
    };
    video_url: string | null;
    audio_url: string | null;
    chain: Chain;
    status?: string;

    // Additional Fields
    extra_metadata?: NFTModelExtraMetadata;
    platform_id?: number;
    spamThreshold?: number;
};

export type SingleNFTDetail = {
    _id: string;
    name: string;
    address: string;
    platform_id: number;
    integration_type: string;
    nftDetails: NFT;
};

export type NFTList = {
    _id: string;
    name: string;
    address: string;
    platform_id: number;
    integration_type: string;
    spamThreshold: number;
    nftDetails: NFT[];
};

export type HandledNFTs = {
    collections: any[];
    wallets: any[];
    chains: any[];
    individuals: any[];
    all: any[];
};

export type MarketCoinPrice = {
    id: number;
    description: string;
    coinId: string;
    latest: {
        price: number;
        fully_diluted_market_cap: number;
        percent_change_7d: number;
        percent_change_24h: number;
        percent_change_30d: number;
        volume_24h: number;
    };
    logo: string;
    logo_lrg: string;
    max_supply: number;
    name: string;
    platformId: number;
    rank: number;
    symbol: string;
};

export type Transaction = {
    _id: string;
    type: string;
    method: string;
    timestamp: string;
    wallet_address: string;
    platform_id: number;
    currency: string;
    fee: string;
    fee_usd: number;
    success: boolean;
    from: string;
    to: string;
    additional_properties: BlockProperties;
    tokens: TxToken[];
    transfers: TxTransfer[];
};

export type BlockProperties = {
    transaction_hash: string;
    block: number;
};

export type TxToken = {
    token_id: string;
    symbol: string;
    address: string;
    in: boolean;
    value: string;
    usd_value: number;
    is_nft: boolean;
    nft_name: string;
};

export type TxTransfer = {
    from_address: string;
    coin_id: string | null;
    to_address: string;
    token_address: string;
    token_amount: string;
    token_amount_formatted: string;
    token_symbol: string;
    token_id: string | null;
    type: string;
    method: string;
    token_meta: TokenMeta | null;
};

export type TokenMeta = {
    decimals: number;
    logo: string;
    name: string;
};

export type TxtToken = {
    token_id: string;
    symbol?: string;
    icon?: string;
    is_nft: boolean;
    name?: string;
};

export type TxtStatus = 'sending' | 'sent' | 'failed';

export type PendingTransaction = {
    id: string;
    type:
        | 'transfer'
        | 'approve'
        | 'swap'
        | 'stake'
        | 'liquid-staking'
        | 'request-withdrawal'
        | 'unstake'
        | 'cancel-claim-request'
        | 'bridge'
        | 'claim-commission';
    txHash: string;
    sender: string;
    receiver: string;
    amount: number;
    gasInfo: GasInfo;
    asset?: Asset;
    network: ChainData;
    tokens: TxtToken[];
    status?: TxtStatus;
    cancelling?: boolean;
    trackData?: any;
    createdAt?: number;
};

export enum AssetType {
    native = 'native',
    nft = 'nft',
    token = 'token',
}

export type Asset = {
    id: string;
    type: AssetType;
    address: string;
    name: string;
    symbol?: string;
    decimals?: number;
    nftType?: string;
};

export interface NewTransaction {
    data?: string;
    amount: string;
    asset: Asset;
    from: string;
    gasLimit: TransactionRequest['gasLimit'];
    maxFeePerGas?: TransactionRequest['maxFeePerGas'];
    maxPriorityFeePerGas?: TransactionRequest['maxPriorityFeePerGas'];
    gasPrice?: TransactionRequest['gasPrice'];
    to: string;
}

export type TransactionDetailsReturned = {
    data?: TransactionRequest['data'];
    from?: TransactionRequest['from'];
    gasLimit: string | undefined;
    to?: TransactionRequest['to'];
    value?: TransactionRequest['value'];
    maxFeePerGas?: TransactionRequest['maxFeePerGas'];
    maxPriorityFeePerGas?: TransactionRequest['maxPriorityFeePerGas'];
    gasPrice?: TransactionRequest['gasPrice'];
    amount?: string | undefined;
};

export type GasInfo = {
    priorityFee?: bigint;
    maxFeePerGas?: bigint;
    baseFee?: bigint;
    gasPrice?: bigint;
};

export type GasOptionsData = {
    low: GasInfo;
    medium: GasInfo;
    high: GasInfo;
    currentBaseFee?: bigint;
};

export type HandledGasData = { gasInfo: GasInfo; gasPrice: bigint };

export interface TransactionRequestParam {
    transaction: TransactionRequest;
}

export type Receiver = {
    walletAddress: string;
    name: string;
    avatar?: string | null;
};

export enum RepeatType {
    OneTime = 'One Time',
    Repeating = 'Repeating',
}

export enum GasType {
    Low = 'LOW',
    Medium = 'MEDIUM',
    High = 'HIGH',
    Custom = 'CUSTOM',
    Suggest = 'SUGGEST',
}
export const GasTypeName = {
    LOW: '🐢  Low',
    MEDIUM: '🐿️  Medium',
    HIGH: '🐆  Fast',
    CUSTOM: '⚙️  Custom',
    SUGGEST: '📱 From Dapp',
};

export const GasTypeNameIcon = {
    LOW: {
        icon: '🐢',
        name: 'Low',
    },
    MEDIUM: {
        icon: '🐿️',
        name: 'Medium',
    },
    HIGH: {
        icon: '🐆',
        name: 'Fast',
    },
    CUSTOM: {
        icon: '⚙️',
        name: 'Custom',
    },
    SUGGEST: {
        icon: '📱',
        name: 'Dapp',
    },
};

export type PlatformCoin = {
    id: number;
    name: string;
    symbol: string;
    logo: string;
    logo_lrg: string;
    platformId: number;
    rank: number;
    coinId: string;
    coinAddress: string;
    icon?: string;
    is_verified: boolean | null;
    latest: {
        price: number;
        percent_change_24h: number;
    };
};

export type CustomPlatformCoin = PlatformCoin & { balance?: number; usdValue?: number };

export type CoinHolding = {
    wallet_address: string;
    wallet_name: string;
    token_id: string;
    token_address: string;
    balance: number;
    balance_usd: number;
    platform_id: number;
    integration_type: string;
    avatar: null | string;

    coin_name: string;
    logo: string;
    logo_lrg?: string;
    symbol: string;

    is_custom: boolean;
    is_hidden: boolean | null;
    is_verified: boolean;
};

export type CoinHoldingGroup = CoinHolding & {
    id: string;
    name: string;
    type: 'coin' | 'exchange';
    total: number;
    totalUSD: number;
    color: string;
    multiple_chains?: boolean;
    items: CoinHoldingGroupItem[];

    // CoinInfo
    coinId?: string;
    icon?: string;
    prominentColors?: {
        light: string;
        dark: string;
    };
    exchangeColors?: {
        light: string;
        dark: string;
    };
};

export type CoinHoldingGroupItem = CoinHolding & {
    name: string;
    type: 'coin' | 'exchange';

    // CoinInfo
    coinId?: string;
    icon?: string;
    prominentColors?: {
        light: string;
        dark: string;
    };
};

export type CoinAssets = {
    groupByExchanges: CoinHoldingGroup[];
    groupByCoins: CoinHoldingGroup[];
};

export type PortfolioCoinHoldings = {
    empty: boolean;
    total: number;
    assets: CoinAssets;
    wallets: HoldingWallet[];
};

export type SelectedCoinData = {
    decimals: number;
    loading: boolean;
    balance: bigint;
};

export type SendAssetData = {
    nftToSend?: NFT;
    coinToSend?: Coin;
    isAAWallet: boolean;
};

export type CachingCoin = {
    name: string;
    symbol: string;
    logo: string;
    logo_lrg: string;
    coinId: string;
};

export type ResolvedName = {
    provider: string;
    name: string;
    color: string;
};

export type ResolvedAddress = {
    provider: string;
    walletAddress: string;
    domainName: string;
    color: string;
};

export type WalletStatus = {
    address: string;
    status: 'IMPORTED' | 'CONNECTED' | 'ALREADY_OWNED' | 'NOT_IMPORTED';
    isDefault: boolean;
};

export type CoinPrice = Record<string, { usdPrice: number; lastUpdated: number }>;

export type CoinPrices = Record<number, CoinPrice>;
