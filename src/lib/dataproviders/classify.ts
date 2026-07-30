import { Transaction, TxToken, TxTransfer } from '../../shared/types/Wallet';
import { syntheticCoinId, RawTransaction, RawTransfer } from './types';

/**
 * Semantic transaction classification.
 *
 * The UI's icon/label logic (getTransactionIcon / getTransactionName in
 * src/shared/utils/portfolio.tsx) matches on the `type` / `method` strings the
 * old backend produced. This module reproduces a simplified version of that
 * classification from raw explorer data:
 *
 * - token flows in BOTH directions            → type 'swap'
 * - a single outgoing transfer from wallet    → type 'send'
 * - a single incoming transfer to wallet      → type 'transfer' (method 'transfer')
 * - approve selector                          → type 'transfer', method 'approve'
 * - anything else with calldata               → type 'transfer' + method (contract interaction)
 */

const APPROVE_SELECTOR = '0x095ea7b3';
const TRANSFER_SELECTOR = '0xa9059cbb';
const TRANSFER_FROM_SELECTOR = '0x23b872dd';

function isSameAddress(a: string | undefined, b: string | undefined): boolean {
    return (a ?? '').toLowerCase() === (b ?? '').toLowerCase() && !!a;
}

export function classifyTransaction(
    raw: RawTransaction,
    walletAddress: string,
): { type: string; method: string } {
    const method = (raw.method ?? '').toLowerCase();

    const hasIn = raw.transfers.some(t => isSameAddress(t.to, walletAddress));
    const hasOut = raw.transfers.some(t => isSameAddress(t.from, walletAddress));

    if (hasIn && hasOut) {
        return { type: 'swap', method: raw.method ?? 'swap' };
    }

    if (method === APPROVE_SELECTOR || method === 'approve') {
        return { type: 'transfer', method: 'approve' };
    }

    if (method.includes('swap')) {
        return { type: 'swap', method: raw.method ?? 'swap' };
    }

    if (raw.transfers.length > 0) {
        // Pure token movement in one direction
        if (
            method === '' ||
            method === TRANSFER_SELECTOR ||
            method === TRANSFER_FROM_SELECTOR ||
            method === 'transfer' ||
            method === 'transferfrom'
        ) {
            return { type: hasOut ? 'send' : 'transfer', method: 'transfer' };
        }
        return { type: 'transfer', method: raw.method ?? '' };
    }

    // Native transfer or plain contract interaction
    if (!raw.hasData) {
        return { type: 'send', method: '' };
    }

    return { type: 'transfer', method: raw.method ?? '' };
}

/** Builds the UI TxToken list from raw transfers + the native value. */
export function buildTxTokens(
    raw: RawTransaction,
    walletAddress: string,
    chainId: number,
    nativeSymbol: string,
    nativeAddress: string,
): TxToken[] {
    const tokens: TxToken[] = [];

    const pushToken = (params: {
        address: string;
        symbol: string;
        amount: number;
        incoming: boolean;
        isNft: boolean;
        nftName: string;
    }) => {
        tokens.push({
            token_id: syntheticCoinId(chainId, params.address),
            symbol: params.symbol,
            address: params.address,
            in: params.incoming,
            value: String(params.amount),
            usd_value: 0,
            is_nft: params.isNft,
            nft_name: params.nftName,
        });
    };

    if (raw.value > 0) {
        pushToken({
            address: nativeAddress,
            symbol: nativeSymbol,
            amount: raw.value,
            incoming: isSameAddress(raw.to, walletAddress),
            isNft: false,
            nftName: '',
        });
    }

    raw.transfers.forEach(transfer => {
        const incoming = isSameAddress(transfer.to, walletAddress);
        const outgoing = isSameAddress(transfer.from, walletAddress);

        if (!incoming && !outgoing) {
            return; // unrelated internal movement
        }

        pushToken({
            address: transfer.tokenAddress,
            symbol: transfer.symbol,
            amount: transfer.amount,
            incoming,
            isNft: Boolean(transfer.isNft),
            nftName: transfer.nftName ?? '',
        });
    });

    return tokens;
}

function buildTxTransfer(transfer: RawTransfer, chainId: number): TxTransfer {
    return {
        from_address: transfer.from,
        to_address: transfer.to,
        coin_id: syntheticCoinId(chainId, transfer.tokenAddress),
        token_address: transfer.tokenAddress,
        token_amount: String(transfer.amount),
        token_amount_formatted: String(transfer.amount),
        token_symbol: transfer.symbol,
        token_id: transfer.tokenId ?? null,
        type: 'transfer',
        method: 'transfer',
        token_meta: {
            decimals: transfer.decimals,
            logo: transfer.logo ?? '',
            name: transfer.name ?? transfer.symbol,
        },
    };
}

/** Converts a normalized raw transaction into the UI Transaction shape. */
export function buildTransaction(
    raw: RawTransaction,
    walletAddress: string,
    chainId: number,
    nativeSymbol: string,
    nativeAddress: string,
): Transaction {
    const { type, method } = classifyTransaction(raw, walletAddress);
    const timestamp =
        typeof raw.timestamp === 'number'
            ? new Date(raw.timestamp * 1000).toISOString()
            : raw.timestamp;

    return {
        _id: raw.hash,
        type,
        method,
        timestamp,
        wallet_address: walletAddress.toLowerCase(),
        platform_id: chainId,
        currency: nativeSymbol,
        fee: String(raw.fee),
        fee_usd: 0,
        success: raw.success,
        from: (raw.from ?? '').toLowerCase(),
        to: (raw.to ?? '').toLowerCase(),
        additional_properties: {
            transaction_hash: raw.hash,
            block: raw.block,
        },
        tokens: buildTxTokens(raw, walletAddress, chainId, nativeSymbol, nativeAddress),
        transfers: raw.transfers.map(transfer => buildTxTransfer(transfer, chainId)),
    };
}
