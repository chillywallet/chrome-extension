import {
    hardwarePreviewDispose,
    hardwarePreviewGetAddressPage,
    type HardwareAddressPreviewSession,
} from '../offscreen/hardwareAddressPreview';

import { trezorOffscreenRpc } from './trezorOffscreenPort';
import { createTrezorEmptySerialized, type TrezorSerializedState } from './trezorSerializedDefaults';

export type TrezorHardwarePreviewSession = HardwareAddressPreviewSession<TrezorSerializedState>;

export function createTrezorHardwarePreviewSession(): TrezorHardwarePreviewSession {
    return {
        instanceId: crypto.randomUUID(),
        serialized: createTrezorEmptySerialized(),
    };
}

export async function trezorPreviewGetAddressPage(
    session: TrezorHardwarePreviewSession,
    direction: 'first' | 'next' | 'prev',
): Promise<{ address: string; index: number }[]> {
    return hardwarePreviewGetAddressPage(
        session,
        direction,
        trezorOffscreenRpc,
        'trezorDiscoveryId',
    );
}

export async function trezorPreviewDispose(instanceId: string): Promise<void> {
    return hardwarePreviewDispose(instanceId, trezorOffscreenRpc);
}
