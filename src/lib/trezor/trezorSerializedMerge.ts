import type { Json } from '@metamask/utils';

import {
    applyHardwareDiscoveryIdFromPagingRows,
    mergeHardwareSerializedPreserveDiscoveryField,
} from '../offscreen/hardwareSerializedDiscoveryMerge';

import type { TrezorSerializedState } from './trezorSerializedDefaults';

/** TrezorMetaMask `serialize()` omits extension fields — keep ours when merging RPC payloads. */
export function mergeTrezorSerializedPreserveTrezorDiscovery(
    previous: TrezorSerializedState,
    fromBridge: TrezorSerializedState,
): TrezorSerializedState {
    return mergeHardwareSerializedPreserveDiscoveryField(
        previous,
        fromBridge,
        'trezorDiscoveryId',
    );
}

/** Wallet id is UUID(address at device derivation index 0), regardless of what the user imports. */
export function applyTrezorDiscoveryIdFromPagingRows(
    target: TrezorSerializedState,
    rows: readonly { address: string; index: number }[],
): void {
    applyHardwareDiscoveryIdFromPagingRows(target, rows, 'trezorDiscoveryId');
}

export function removeTrezorPathsForChecksum(
    data: TrezorSerializedState,
    checksumAddress: string,
): void {
    const paths = data.paths;
    if (paths && typeof paths === 'object' && !Array.isArray(paths)) {
        const rec = { ...(paths as Record<string, Json>) };
        delete rec[checksumAddress];
        data.paths = rec as Json;
    }
}
