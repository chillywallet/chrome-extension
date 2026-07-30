/** EVM {@link TypedTransaction} ⇄ plain JSON for hardware offscreen signing (Ledger / Trezor IPC). */
import type { ChainConfig } from '@ethereumjs/common';
import { Common, Hardfork } from '@ethereumjs/common';
import type { TypedTransaction, TxData } from '@ethereumjs/tx';
import { TransactionFactory } from '@ethereumjs/tx';
import { bigIntToHex } from '@ethereumjs/util';
import type { Json } from '@metamask/utils';

export type HardwareTxWirePayload = {
    tx: Record<string, Json | undefined>;
    chainId: string;
    hardfork: string;
};

/** Serialize typed tx fields suitable for `postMessage`-style JSON transport (hex `type`, etc.). */
export function typedTransactionToWireRecord(tx: TypedTransaction): Record<string, Json | undefined> {
    const json = tx.toJSON() as Record<string, Json | undefined>;
    return {
        ...json,
        type: bigIntToHex(BigInt(tx.type)),
    };
}

function normalizedTypeNumber(tx: Record<string, Json | undefined>): number | undefined {
    const t = tx.type;
    if (t === undefined || t === null) {
        return undefined;
    }
    if (typeof t === 'number' && Number.isFinite(t)) {
        return t;
    }
    if (typeof t === 'string' && t.trim() !== '') {
        return Number(BigInt(t));
    }
    return undefined;
}

function repairWireTxJsonEnvelope(
    tx: Record<string, Json | undefined>,
): Record<string, Json | undefined> {
    const out: Record<string, Json | undefined> = { ...tx };

    let tn = normalizedTypeNumber(out);

    if (tn === 2) {
        delete out.gasPrice;
        return out;
    }

    if (tn === 1 || tn === 0) {
        return out;
    }

    const maxFee = out.maxFeePerGas;
    const priority = out.maxPriorityFeePerGas;
    const has1559 =
        typeof maxFee === 'string' &&
        maxFee !== '' &&
        typeof priority === 'string' &&
        priority !== '';

    if (has1559) {
        out.type = '0x2';
        delete out.gasPrice;
        return out;
    }

    const hasGasPrice = typeof out.gasPrice === 'string' && out.gasPrice !== '';
    const hasAccessListField = 'accessList' in out && Array.isArray(out.accessList);

    if (hasGasPrice && hasAccessListField) {
        out.type = '0x1';
    }

    return out;
}

export function hardwareTxWireFromTyped(tx: TypedTransaction): HardwareTxWirePayload {
    return {
        tx: typedTransactionToWireRecord(tx),
        chainId: tx.common.chainId().toString(),
        hardfork: tx.common.hardfork(),
    };
}

/** Rebuild a frozen {@link TypedTransaction} from a wire payload coming back from offscreen. */
export function typedTransactionFromHardwareWirePayload(p: HardwareTxWirePayload): TypedTransaction {
    const customChainParams: Partial<ChainConfig> = {
        chainId: Number(p.chainId),
        defaultHardfork: p.hardfork as Hardfork,
    };
    const common = Common.custom(customChainParams);

    const tx = repairWireTxJsonEnvelope(p.tx);

    return TransactionFactory.fromTxData(tx as never, { common, freeze: false });
}

/**
 * After signing, offscreen returns fields as JSON ({@link typedTransactionToWireRecord}).
 * Rehydrate while preserving {@link TypedTransaction}'s {@link Common} from the unsigned tx
 * (MetaMask-style parity).
 */
export function typedTransactionFromHardwareSignedWire(
    unsignedTx: TypedTransaction,
    signedPayload: TypedTransaction | TxData | Record<string, Json | undefined>,
): TypedTransaction {
    if (
        typeof signedPayload === 'object' &&
        signedPayload !== null &&
        'serialize' in signedPayload &&
        typeof (signedPayload as TypedTransaction).serialize === 'function'
    ) {
        return signedPayload as TypedTransaction;
    }

    return typedTransactionFromHardwareWirePayload({
        tx: signedPayload as Record<string, Json | undefined>,
        chainId: unsignedTx.common.chainId().toString(),
        hardfork: unsignedTx.common.hardfork(),
    });
}
