import type Transport from '@ledgerhq/hw-transport';

type TransportWithBusyGuard = Transport & {
    exchangeBusyPromise?: Promise<unknown> | null;
};

const LEDGER_TRANSPORT_STUCK_MARKERS = [
    'TransportRaceCondition',
    'An action was already pending on the Ledger device',
    'DisconnectedDeviceDuringOperation',
    'DisconnectedDevice',
    'Cannot write to HID device',
    'device was disconnected',
] as const;

/** True when the WebHID transport is likely stuck after unplug, deny, or an interrupted exchange. */
export function isLedgerTransportStuckError(error: unknown): boolean {
    if (!error) {
        return false;
    }

    const name = error instanceof Error ? error.name : '';
    if (name === 'TransportRaceCondition' || name === 'DisconnectedDeviceDuringOperation') {
        return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    return LEDGER_TRANSPORT_STUCK_MARKERS.some(
        marker => message.includes(marker) || lower.includes(marker.toLowerCase()),
    );
}

/**
 * Close a Ledger transport without waiting indefinitely on a stuck atomic exchange
 * (e.g. after USB unplug during sign).
 */
export async function forceCloseLedgerTransport(
    transport: Transport | null | undefined,
): Promise<void> {
    if (!transport) {
        return;
    }

    const guarded = transport as TransportWithBusyGuard;
    if (guarded.exchangeBusyPromise) {
        guarded.exchangeBusyPromise = null;
    }

    try {
        await Promise.race([
            transport.close(),
            new Promise<void>(resolve => {
                globalThis.setTimeout(resolve, 1500);
            }),
        ]);
    } catch {
        // best-effort cleanup
    }
}
