import {
    isWebHidApiAvailable,
    openLedgerWebHidTransport,
} from '../../../src/lib/ledger/openLedgerWebHidTransport';
import { LEDGER_USB_VENDOR_ID } from '../../../src/lib/ledger/ledgerUsbConstants';
import {
    LEDGER_ERR_COULD_NOT_OPEN_DEVICE,
    LEDGER_ERR_DEVICE_NOT_CONNECTED,
    LEDGER_ERR_WEBHID_NOT_SUPPORTED_BROWSER,
} from '../../../src/lib/ledger/ledgerErrorMessages';

const mockOpenConnected = jest.fn();
const mockOpen = jest.fn();

jest.mock('@ledgerhq/hw-transport-webhid', () => ({
    __esModule: true,
    default: {
        openConnected: (...a: any[]) => mockOpenConnected(...a),
        open: (...a: any[]) => mockOpen(...a),
    },
}));

function setHid(hid: any) {
    Object.defineProperty(global.navigator, 'hid', {
        configurable: true,
        get: () => hid,
    });
}

beforeEach(() => {
    mockOpenConnected.mockReset();
    mockOpen.mockReset();
    setHid(undefined);
});

describe('isWebHidApiAvailable', () => {
    it('returns false when navigator.hid is missing', () => {
        setHid(undefined);
        expect(isWebHidApiAvailable()).toBe(false);
    });

    it('returns true when navigator.hid is present', () => {
        setHid({ getDevices: jest.fn() });
        expect(isWebHidApiAvailable()).toBe(true);
    });
});

describe('openLedgerWebHidTransport', () => {
    it('throws when WebHID is not available', async () => {
        setHid(undefined);
        await expect(openLedgerWebHidTransport()).rejects.toThrow(
            LEDGER_ERR_WEBHID_NOT_SUPPORTED_BROWSER,
        );
    });

    it('returns existing connected transport when available', async () => {
        setHid({ getDevices: jest.fn() });
        mockOpenConnected.mockResolvedValueOnce({ existing: true });
        const out = await openLedgerWebHidTransport();
        expect(out).toEqual({ existing: true });
    });

    it('throws DEVICE_NOT_CONNECTED when no permitted devices are present', async () => {
        setHid({ getDevices: jest.fn().mockResolvedValue([{ vendorId: 0x1234 }]) });
        mockOpenConnected.mockResolvedValueOnce(null);
        await expect(openLedgerWebHidTransport()).rejects.toThrow(LEDGER_ERR_DEVICE_NOT_CONNECTED);
    });

    it('opens the first permitted Ledger device successfully', async () => {
        setHid({
            getDevices: jest
                .fn()
                .mockResolvedValue([
                    { vendorId: 0x1111 },
                    { vendorId: LEDGER_USB_VENDOR_ID, name: 'ledger' },
                ]),
        });
        mockOpenConnected.mockResolvedValueOnce(null);
        mockOpen.mockResolvedValueOnce({ opened: true });
        const out = await openLedgerWebHidTransport();
        expect(out).toEqual({ opened: true });
        expect(mockOpen).toHaveBeenCalledWith({ vendorId: LEDGER_USB_VENDOR_ID, name: 'ledger' });
    });

    it('falls through devices on open failure and throws COULD_NOT_OPEN_DEVICE when all fail', async () => {
        setHid({
            getDevices: jest
                .fn()
                .mockResolvedValue([
                    { vendorId: LEDGER_USB_VENDOR_ID, name: 'a' },
                    { vendorId: LEDGER_USB_VENDOR_ID, name: 'b' },
                ]),
        });
        mockOpenConnected.mockResolvedValueOnce(null);
        mockOpen.mockRejectedValueOnce(new Error('fail-a'));
        mockOpen.mockRejectedValueOnce(new Error('fail-b'));
        await expect(openLedgerWebHidTransport()).rejects.toThrow(LEDGER_ERR_COULD_NOT_OPEN_DEVICE);
    });

    it('returns the second device when the first fails to open', async () => {
        setHid({
            getDevices: jest
                .fn()
                .mockResolvedValue([
                    { vendorId: LEDGER_USB_VENDOR_ID, name: 'a' },
                    { vendorId: LEDGER_USB_VENDOR_ID, name: 'b' },
                ]),
        });
        mockOpenConnected.mockResolvedValueOnce(null);
        mockOpen.mockRejectedValueOnce(new Error('fail-a'));
        mockOpen.mockResolvedValueOnce({ which: 'b' });
        await expect(openLedgerWebHidTransport()).resolves.toEqual({ which: 'b' });
    });

    it('deduplicates concurrent calls (returns same promise)', async () => {
        setHid({ getDevices: jest.fn().mockResolvedValue([]) });
        let resolveFn: any;
        mockOpenConnected.mockReturnValueOnce(
            new Promise(resolve => {
                resolveFn = resolve;
            }),
        );
        const a = openLedgerWebHidTransport();
        const b = openLedgerWebHidTransport();
        resolveFn({ shared: true });
        await expect(a).resolves.toEqual({ shared: true });
        await expect(b).resolves.toEqual({ shared: true });
    });
});
