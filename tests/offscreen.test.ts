import { HARDWARE_OFFSCREEN_MESSAGE } from '../src/lib/offscreen/hardwareOffscreenMessaging';

const mockAddListenerSpy = jest.fn();
const mockSendMessageSpy = jest.fn();

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        runtime: {
            onMessage: {
                addListener: (...a: any[]) => mockAddListenerSpy(...a),
            },
            sendMessage: (...a: any[]) => mockSendMessageSpy(...a),
        },
    },
}));

jest.mock('../src/lib/offscreen/offscreenLedgerMessageHandler', () => ({
    handleOffscreenLedgerRuntimeMessage: jest.fn(),
}));

jest.mock('../src/lib/offscreen/offscreenTrezorMessageHandler', () => ({
    handleOffscreenTrezorRuntimeMessage: jest.fn(),
}));

beforeEach(() => {
    mockAddListenerSpy.mockReset();
    mockSendMessageSpy.mockReset();
    jest.resetModules();
});

describe('offscreen entry', () => {
    it('registers a runtime message listener that fan-outs to ledger then trezor', () => {
        mockSendMessageSpy.mockResolvedValueOnce(undefined);
        require('../src/offscreen');
        const ledger = require('../src/lib/offscreen/offscreenLedgerMessageHandler');
        const trezor = require('../src/lib/offscreen/offscreenTrezorMessageHandler');
        const handler = mockAddListenerSpy.mock.calls[0][0];

        (ledger.handleOffscreenLedgerRuntimeMessage as jest.Mock).mockReturnValueOnce(true);
        expect(handler({}, {}, () => {})).toBe(true);

        (ledger.handleOffscreenLedgerRuntimeMessage as jest.Mock).mockReturnValueOnce(false);
        (trezor.handleOffscreenTrezorRuntimeMessage as jest.Mock).mockReturnValueOnce(true);
        expect(handler({}, {}, () => {})).toBe(true);

        (ledger.handleOffscreenLedgerRuntimeMessage as jest.Mock).mockReturnValueOnce(false);
        (trezor.handleOffscreenTrezorRuntimeMessage as jest.Mock).mockReturnValueOnce(false);
        expect(handler({}, {}, () => {})).toBeUndefined();
    });

    it('posts a boot acknowledgement on import', async () => {
        mockSendMessageSpy.mockResolvedValueOnce(undefined);
        require('../src/offscreen');
        await Promise.resolve();
        await Promise.resolve();
        expect(mockSendMessageSpy).toHaveBeenCalledWith({
            target: HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension,
            offscreenBooted: true,
        });
    });

    it('swallows boot ack errors', async () => {
        mockSendMessageSpy.mockRejectedValueOnce(new Error('chan dead'));
        require('../src/offscreen');
        await Promise.resolve();
        await Promise.resolve();
        // The catch should swallow the error. No assertion required other than no unhandled rejection.
        expect(mockSendMessageSpy).toHaveBeenCalled();
    });
});
