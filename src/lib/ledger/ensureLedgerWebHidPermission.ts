import { ENVIRONMENT_TYPE_FULLSCREEN } from '../../shared/constants/app';
import { getEnvironmentType } from '../../shared/utils/utils';
import {
    LEDGER_ERR_DEVICE_NOT_CONNECTED,
    LEDGER_ERR_NO_LEDGER_SELECTED,
    LEDGER_ERR_WEBHID_NOT_AVAILABLE,
} from './ledgerErrorMessages';
import { LEDGER_USB_VENDOR_ID } from './ledgerUsbConstants';

/** Typed access — `Navigator.hid` may be missing from TS lib typings in this project. */
export type LedgerHidNavigator = {
    getDevices(): Promise<{ vendorId: number }[]>;
    requestDevice(options: { filters: { vendorId: number }[] }): Promise<{ vendorId: number }[]>;
};

function getNavigatorHid(): LedgerHidNavigator | undefined {
    return (navigator as { hid?: LedgerHidNavigator }).hid;
}

/**
 * Ensures at least one Ledger USB HID device is authorized for this extension origin.
 * Must run from a visible extension page (popup / side panel) inside a click handler so
 * Chrome shows the native device picker.
 */
export function isWebHidSupported(): boolean {
    return Boolean(getNavigatorHid());
}

export async function ensureLedgerWebHidPermission(): Promise<void> {
    const hid = getNavigatorHid();

    if (!hid) {
        throw new Error(LEDGER_ERR_WEBHID_NOT_AVAILABLE);
    }

    const existing = (await hid.getDevices()).filter(d => d.vendorId === LEDGER_USB_VENDOR_ID);

    if (existing.length > 0) {
        return;
    }

    if (getEnvironmentType() !== ENVIRONMENT_TYPE_FULLSCREEN) {
        throw new Error(LEDGER_ERR_DEVICE_NOT_CONNECTED);
    }

    try {
        const connectedDevices = await hid.requestDevice({
            filters: [{ vendorId: LEDGER_USB_VENDOR_ID }],
        });

        if (connectedDevices.length === 0) {
            throw new Error(LEDGER_ERR_NO_LEDGER_SELECTED);
        }
    } catch (e) {
        if (e instanceof DOMException && e.name === 'NotFoundError') {
            throw new Error(LEDGER_ERR_NO_LEDGER_SELECTED);
        }

        throw e;
    }
}
