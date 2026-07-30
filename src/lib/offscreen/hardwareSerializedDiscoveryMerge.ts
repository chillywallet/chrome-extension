import type { Json } from '@metamask/utils';

import { getUUIDFromAddress } from '../WalletUtils';

/**
 * Bridge `serialize()` payloads omit our wallet-id field — preserve the previous value when merging
 * RPC responses (same pattern for Ledger `ledgerDiscoveryId` and Trezor `trezorDiscoveryId`).
 */
export function mergeHardwareSerializedPreserveDiscoveryField<T extends Record<string, Json>>(
    previous: T,
    fromBridge: T,
    discoveryField: keyof T & string,
): T {
    const prevVal = previous[discoveryField];
    const preserved = typeof prevVal === 'string' && prevVal !== '' ? prevVal : '';

    const merged = structuredClone(fromBridge) as T;
    (merged as Record<string, Json>)[discoveryField] = preserved as Json;
    return merged;
}

/** Wallet id is UUID(address at device derivation index 0), regardless of what the user imports. */
export function applyHardwareDiscoveryIdFromPagingRows<T extends Record<string, Json>>(
    target: T,
    rows: readonly { address: string; index: number }[],
    discoveryField: keyof T & string,
): void {
    const row0 = rows.find(r => r.index === 0);
    const addr = row0?.address;
    if (typeof addr !== 'string' || !addr) {
        return;
    }
    (target as Record<string, Json>)[discoveryField] = getUUIDFromAddress(addr) as Json;
}
