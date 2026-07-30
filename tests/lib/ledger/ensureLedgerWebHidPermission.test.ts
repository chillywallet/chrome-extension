import {
    ensureLedgerWebHidPermission,
    isWebHidSupported,
} from '../../../src/lib/ledger/ensureLedgerWebHidPermission';
import { LEDGER_USB_VENDOR_ID } from '../../../src/lib/ledger/ledgerUsbConstants';
import {
    LEDGER_ERR_DEVICE_NOT_CONNECTED,
    LEDGER_ERR_NO_LEDGER_SELECTED,
    LEDGER_ERR_WEBHID_NOT_AVAILABLE,
} from '../../../src/lib/ledger/ledgerErrorMessages';
import { ENVIRONMENT_TYPE_FULLSCREEN } from '../../../src/shared/constants/app';

jest.mock('../../../src/shared/utils/utils', () => ({
    getEnvironmentType: jest.fn(),
}));

const utils = require('../../../src/shared/utils/utils');

function setHid(hid: any) {
    Object.defineProperty(global.navigator, 'hid', {
        configurable: true,
        get: () => hid,
    });
}

beforeEach(() => {
    setHid(undefined);
    (utils.getEnvironmentType as jest.Mock).mockReset();
});

describe('isWebHidSupported', () => {
    it('reflects navigator.hid presence', () => {
        setHid(undefined);
        expect(isWebHidSupported()).toBe(false);
        setHid({ getDevices: jest.fn() });
        expect(isWebHidSupported()).toBe(true);
    });
});

describe('ensureLedgerWebHidPermission', () => {
    it('throws WEBHID_NOT_AVAILABLE when navigator.hid missing', async () => {
        setHid(undefined);
        await expect(ensureLedgerWebHidPermission()).rejects.toThrow(
            LEDGER_ERR_WEBHID_NOT_AVAILABLE,
        );
    });

    it('resolves when a Ledger device is already permitted', async () => {
        setHid({
            getDevices: jest.fn().mockResolvedValue([{ vendorId: LEDGER_USB_VENDOR_ID }]),
            requestDevice: jest.fn(),
        });
        await expect(ensureLedgerWebHidPermission()).resolves.toBeUndefined();
    });

    it('throws DEVICE_NOT_CONNECTED outside fullscreen environment', async () => {
        (utils.getEnvironmentType as jest.Mock).mockReturnValue('popup');
        setHid({
            getDevices: jest.fn().mockResolvedValue([]),
            requestDevice: jest.fn(),
        });
        await expect(ensureLedgerWebHidPermission()).rejects.toThrow(
            LEDGER_ERR_DEVICE_NOT_CONNECTED,
        );
    });

    it('prompts requestDevice in fullscreen and resolves when user picks a device', async () => {
        (utils.getEnvironmentType as jest.Mock).mockReturnValue(ENVIRONMENT_TYPE_FULLSCREEN);
        const requestDevice = jest.fn().mockResolvedValue([{ vendorId: LEDGER_USB_VENDOR_ID }]);
        setHid({
            getDevices: jest.fn().mockResolvedValue([]),
            requestDevice,
        });
        await expect(ensureLedgerWebHidPermission()).resolves.toBeUndefined();
        expect(requestDevice).toHaveBeenCalledWith({
            filters: [{ vendorId: LEDGER_USB_VENDOR_ID }],
        });
    });

    it('throws NO_LEDGER_SELECTED when requestDevice returns empty', async () => {
        (utils.getEnvironmentType as jest.Mock).mockReturnValue(ENVIRONMENT_TYPE_FULLSCREEN);
        setHid({
            getDevices: jest.fn().mockResolvedValue([]),
            requestDevice: jest.fn().mockResolvedValue([]),
        });
        await expect(ensureLedgerWebHidPermission()).rejects.toThrow(LEDGER_ERR_NO_LEDGER_SELECTED);
    });

    it('maps DOMException("NotFoundError") to NO_LEDGER_SELECTED', async () => {
        (utils.getEnvironmentType as jest.Mock).mockReturnValue(ENVIRONMENT_TYPE_FULLSCREEN);
        const err = new DOMException('cancelled', 'NotFoundError');
        setHid({
            getDevices: jest.fn().mockResolvedValue([]),
            requestDevice: jest.fn().mockRejectedValue(err),
        });
        await expect(ensureLedgerWebHidPermission()).rejects.toThrow(LEDGER_ERR_NO_LEDGER_SELECTED);
    });

    it('rethrows unknown errors from requestDevice', async () => {
        (utils.getEnvironmentType as jest.Mock).mockReturnValue(ENVIRONMENT_TYPE_FULLSCREEN);
        setHid({
            getDevices: jest.fn().mockResolvedValue([]),
            requestDevice: jest.fn().mockRejectedValue(new Error('broken')),
        });
        await expect(ensureLedgerWebHidPermission()).rejects.toThrow('broken');
    });
});
