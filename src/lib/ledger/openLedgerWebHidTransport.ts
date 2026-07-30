import type Transport from '@ledgerhq/hw-transport';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';

import {
    LEDGER_ERR_COULD_NOT_OPEN_DEVICE,
    LEDGER_ERR_DEVICE_NOT_CONNECTED,
    LEDGER_ERR_WEBHID_NOT_SUPPORTED_BROWSER,
} from './ledgerErrorMessages';
import { LEDGER_USB_VENDOR_ID } from './ledgerUsbConstants';

type MinimalHidNavigator = {
    getDevices(): Promise<Array<{ vendorId: number }>>;
};

function getNavigatorHid(): MinimalHidNavigator | undefined {
    return (navigator as { hid?: MinimalHidNavigator }).hid;
}

export function isWebHidApiAvailable(): boolean {
    return typeof navigator !== 'undefined' && Boolean(getNavigatorHid());
}

let pendingOpen: Promise<Transport> | null = null;

export async function openLedgerWebHidTransport(): Promise<Transport> {
    if (pendingOpen) {
        return pendingOpen;
    }

    pendingOpen = (async () => {
        if (!isWebHidApiAvailable()) {
            throw new Error(LEDGER_ERR_WEBHID_NOT_SUPPORTED_BROWSER);
        }

        const existing = await TransportWebHID.openConnected();
        if (existing) {
            return existing;
        }

        const hid = getNavigatorHid();
        if (!hid) {
            throw new Error(LEDGER_ERR_WEBHID_NOT_SUPPORTED_BROWSER);
        }

        const permitted = (await hid.getDevices()).filter(d => d.vendorId === LEDGER_USB_VENDOR_ID);

        if (permitted.length === 0) {
            throw new Error(LEDGER_ERR_DEVICE_NOT_CONNECTED);
        }

        for (const device of permitted) {
            try {
                return await TransportWebHID.open(device);
            } catch {
                /* try next permitted device */
            }
        }

        throw new Error(LEDGER_ERR_COULD_NOT_OPEN_DEVICE);
    })();

    try {
        return await pendingOpen;
    } finally {
        pendingOpen = null;
    }
}
