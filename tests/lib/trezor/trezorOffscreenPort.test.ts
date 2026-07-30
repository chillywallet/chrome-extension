import { trezorOffscreenRpc } from '../../../src/lib/trezor/trezorOffscreenPort';
import { HARDWARE_OFFSCREEN_MESSAGE } from '../../../src/lib/offscreen/hardwareOffscreenMessaging';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        runtime: {
            sendMessage: jest.fn(),
        },
    },
}));

jest.mock('../../../src/lib/offscreen/hardwareOffscreenPort', () => ({
    ensureHardwareOffscreenReady: jest.fn(),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const browser = require('webextension-polyfill').default;
const { ensureHardwareOffscreenReady } = require('../../../src/lib/offscreen/hardwareOffscreenPort');

const REQ_ID = 'trezor-uuid';

beforeEach(() => {
    Object.defineProperty(global, 'crypto', {
        configurable: true,
        value: { randomUUID: () => REQ_ID },
    });
    (ensureHardwareOffscreenReady as jest.Mock).mockResolvedValue(undefined);
});

describe('trezorOffscreenRpc', () => {
    it('sends envelope with matching request id and resolves result on ok', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
            trezorRequestId: REQ_ID,
            ok: true,
            result: { ok: 1 },
        });

        const out = await trezorOffscreenRpc('inst-1', 'addAccounts', { n: 1 });
        expect(out).toEqual({ ok: 1 });
        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: REQ_ID,
            instanceId: 'inst-1',
            method: 'addAccounts',
            payload: { n: 1 },
        });
    });

    it('throws when response is null/undefined', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce(undefined);
        await expect(trezorOffscreenRpc('i', 'm')).rejects.toThrow(/invalid response/i);
    });

    it('throws when trezorRequestId mismatches', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
            trezorRequestId: 'OTHER',
            ok: true,
            result: 1,
        });
        await expect(trezorOffscreenRpc('i', 'm')).rejects.toThrow(/invalid response/i);
    });

    it('throws response.error on ok=false', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
            trezorRequestId: REQ_ID,
            ok: false,
            error: 'cancelled',
        });
        await expect(trezorOffscreenRpc('i', 'm')).rejects.toThrow('cancelled');
    });

    it('throws generic message when ok=false but error is empty', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
            trezorRequestId: REQ_ID,
            ok: false,
            error: '',
        });
        await expect(trezorOffscreenRpc('i', 'm')).rejects.toThrow(/Trezor offscreen error/);
    });

    it('propagates rejection from sendMessage', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('nope'));
        await expect(trezorOffscreenRpc('i', 'm')).rejects.toThrow('nope');
    });
});
