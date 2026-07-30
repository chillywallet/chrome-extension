import type { Json } from '@metamask/utils';

import {
    applyHardwareDiscoveryIdFromPagingRows,
    mergeHardwareSerializedPreserveDiscoveryField,
} from '../offscreen/hardwareSerializedDiscoveryMerge';

import type { LedgerSerializedState } from './ledgerSerializedDefaults';

/** MetaMask Ledger `serialize()` omits extension fields — keep ours when merging RPC payloads. */
export function mergeLedgerSerializedPreserveLedgerDiscovery(
    previous: LedgerSerializedState,
    fromBridge: LedgerSerializedState,
): LedgerSerializedState {
    return mergeHardwareSerializedPreserveDiscoveryField(
        previous,
        fromBridge,
        'ledgerDiscoveryId',
    );
}

/** Wallet id is UUID(address at device derivation index 0), regardless of what the user imports. */
export function applyLedgerDiscoveryIdFromPagingRows(
    target: LedgerSerializedState,
    rows: readonly { address: string; index: number }[],
): void {
    applyHardwareDiscoveryIdFromPagingRows(target, rows, 'ledgerDiscoveryId');
}

export function removeLedgerAccountDetailsForChecksum(
    data: LedgerSerializedState,
    checksumAddress: string,
): void {
    const details = data.accountDetails;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
        const rec = { ...(details as Record<string, Json>) };
        delete rec[checksumAddress];
        data.accountDetails = rec as Json;
    }
}
