import {
    hardwarePreviewDispose,
    hardwarePreviewGetAddressPage,
    type HardwareAddressPreviewSession,
} from '../offscreen/hardwareAddressPreview';

import { ledgerOffscreenRpc } from './ledgerOffscreenPort';
import { createLedgerEmptySerialized, type LedgerSerializedState } from './ledgerSerializedDefaults';

export type LedgerHardwarePreviewSession = HardwareAddressPreviewSession<LedgerSerializedState>;

export function createLedgerHardwarePreviewSession(): LedgerHardwarePreviewSession {
    return {
        instanceId: crypto.randomUUID(),
        serialized: createLedgerEmptySerialized(),
    };
}

export async function ledgerPreviewGetAddressPage(
    session: LedgerHardwarePreviewSession,
    direction: 'first' | 'next' | 'prev',
): Promise<{ address: string; index: number }[]> {
    return hardwarePreviewGetAddressPage(
        session,
        direction,
        ledgerOffscreenRpc,
        'ledgerDiscoveryId',
    );
}

export async function ledgerPreviewDispose(instanceId: string): Promise<void> {
    return hardwarePreviewDispose(instanceId, ledgerOffscreenRpc);
}
