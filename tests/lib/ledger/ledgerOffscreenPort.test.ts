import { ledgerOffscreenRpc } from '../../../src/lib/ledger/ledgerOffscreenPort';
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

const REQ_ID = 'fixed-uuid';

beforeEach(() => {
    Object.defineProperty(global, 'crypto', {
        configurable: true,
        value: { randomUUID: () => REQ_ID },
    });
    (ensureHardwareOffscreenReady as jest.Mock).mockResolvedValue(undefined);
});

describe('ledgerOffscreenRpc', () => {
    it('sends an envelope with matching request id and resolves result on ok', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
            ledgerRequestId: REQ_ID,
            ok: true,
            result: { hello: 'world' },
        });

        const out = await ledgerOffscreenRpc('inst-1', 'foo', { x: 1 });
        expect(out).toEqual({ hello: 'world' });

        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: REQ_ID,
            instanceId: 'inst-1',
            method: 'foo',
            payload: { x: 1 },
        });
        expect(ensureHardwareOffscreenReady).toHaveBeenCalled();
    });

    it('throws when response is null', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce(null);
        await expect(ledgerOffscreenRpc('id', 'method')).rejects.toThrow(
            /invalid response/i,
        );
    });

    it('throws when ledgerRequestId mismatches', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
            ledgerRequestId: 'WRONG',
            ok: true,
            result: 'x',
        });
        await expect(ledgerOffscreenRpc('id', 'method')).rejects.toThrow(
            /invalid response/i,
        );
    });

    it('throws response.error when ok=false', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
            ledgerRequestId: REQ_ID,
            ok: false,
            error: 'boom',
        });
        await expect(ledgerOffscreenRpc('id', 'method')).rejects.toThrow('boom');
    });

    it('throws generic message when ok=false but error is empty', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
            ledgerRequestId: REQ_ID,
            ok: false,
            error: '',
        });
        await expect(ledgerOffscreenRpc('id', 'method')).rejects.toThrow(/Ledger offscreen error/);
    });

    it('propagates rejection from sendMessage', async () => {
        (browser.runtime.sendMessage as jest.Mock).mockRejectedValueOnce(new Error('chan dead'));
        await expect(ledgerOffscreenRpc('id', 'method')).rejects.toThrow('chan dead');
    });
});
