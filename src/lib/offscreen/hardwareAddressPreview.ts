import type { Json } from '@metamask/utils';

import type { HardwareOffscreenRpcFn } from './hardwareOffscreenRpcTypes';
import {
    applyHardwareDiscoveryIdFromPagingRows,
    mergeHardwareSerializedPreserveDiscoveryField,
} from './hardwareSerializedDiscoveryMerge';

export type HardwareAddressPreviewSession<TState extends Record<string, Json>> = {
    instanceId: string;
    serialized: TState;
};

export async function hardwarePreviewGetAddressPage<TState extends Record<string, Json>>(
    session: HardwareAddressPreviewSession<TState>,
    direction: 'first' | 'next' | 'prev',
    rpc: HardwareOffscreenRpcFn,
    discoveryField: keyof TState & string,
): Promise<{ address: string; index: number }[]> {
    const { serialized, accounts } = await rpc<{
        serialized: TState;
        accounts: { address: string; index: number; balance?: null }[];
    }>(session.instanceId, 'getAddressPage', {
        serialized: structuredClone(session.serialized),
        direction,
    });

    const rows = accounts.map(({ address, index }) => ({ address, index }));

    session.serialized = mergeHardwareSerializedPreserveDiscoveryField(
        session.serialized,
        serialized,
        discoveryField,
    );
    applyHardwareDiscoveryIdFromPagingRows(session.serialized, rows, discoveryField);

    return rows;
}

export async function hardwarePreviewDispose(
    instanceId: string,
    rpc: HardwareOffscreenRpcFn,
): Promise<void> {
    try {
        await rpc(instanceId, 'dispose');
    } catch {
        /* Port may be gone after reload; ignore. */
    }
}
