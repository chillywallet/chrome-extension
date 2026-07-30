import { CoinHolding, NFTList, Pagination, Transaction } from '../../shared/types/Wallet';

/** A page of wallet transactions in the UI's Transaction shape. */
export type TxPage = {
    data: Transaction[];
    pagination: Pagination;
};

export type NftPage = {
    nfts: NFTList[];
    pagination: Pagination | null;
};

/**
 * Provider-neutral raw shapes. Each adapter normalizes its API responses into
 * these, and the shared builders below convert them into the UI types.
 */
export type RawTokenBalance = {
    tokenAddress: string;
    name: string;
    symbol: string;
    decimals: number;
    /** Balance in token units (already divided by decimals). */
    balance: number;
    logo?: string;
    verified?: boolean;
    /** ERC-20 | ERC-721 | ERC-1155 (only ERC-20 becomes a coin holding) */
    type?: string;
};

export type RawTransfer = {
    from: string;
    to: string;
    tokenAddress: string;
    symbol: string;
    decimals: number;
    /** Amount in token units (already divided by decimals). */
    amount: number;
    isNft?: boolean;
    tokenId?: string | null;
    nftName?: string;
    logo?: string;
    name?: string;
};

export type RawTransaction = {
    hash: string;
    from: string;
    to: string;
    /** Native value in coin units. */
    value: number;
    /** Fee in native coin units. */
    fee: number;
    success: boolean;
    /** Unix seconds or ISO string. */
    timestamp: number | string;
    block: number;
    /** 4-byte selector or decoded method name when the provider knows it. */
    method?: string;
    /** Token transfers that happened inside this transaction. */
    transfers: RawTransfer[];
    /** True when the tx has calldata (contract interaction). */
    hasData?: boolean;
};

export type RawNft = {
    contractAddress: string;
    contractType: string; // ERC-721 | ERC-1155
    collectionName: string;
    tokenId: string;
    name: string;
    imageUrl: string;
    description?: string;
};

export function makePagination(page: number, size: number, hasNextPage: boolean): Pagination {
    return {
        page,
        size,
        hasNextPage,
        hasPrevPage: page > 1,
        totalCount: 0,
        totalPages: 0,
    };
}

export function emptyTxPage(page: number = 1): TxPage {
    return { data: [], pagination: makePagination(page, 0, false) };
}

/** Synthetic coin id used across the app in place of the old backend `coinId`. */
export function syntheticCoinId(chainId: number, tokenAddress: string): string {
    return `${chainId}:${(tokenAddress ?? '').toLowerCase()}`;
}
