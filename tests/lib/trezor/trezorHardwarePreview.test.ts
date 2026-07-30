import {
    createTrezorHardwarePreviewSession,
    trezorPreviewDispose,
    trezorPreviewGetAddressPage,
} from '../../../src/lib/trezor/trezorHardwarePreview';

jest.mock('../../../src/lib/offscreen/hardwareAddressPreview', () => ({
    hardwarePreviewGetAddressPage: jest.fn(),
    hardwarePreviewDispose: jest.fn(),
}));

jest.mock('../../../src/lib/trezor/trezorOffscreenPort', () => ({
    trezorOffscreenRpc: jest.fn(),
}));

const previewModule = require('../../../src/lib/offscreen/hardwareAddressPreview');
const portModule = require('../../../src/lib/trezor/trezorOffscreenPort');

beforeEach(() => {
    Object.defineProperty(global, 'crypto', {
        configurable: true,
        value: { randomUUID: () => 'trezor-session-uuid' },
    });
});

describe('createTrezorHardwarePreviewSession', () => {
    it('creates a session with a generated instanceId and default serialized', () => {
        const session = createTrezorHardwarePreviewSession();
        expect(session.instanceId).toBe('trezor-session-uuid');
        expect(session.serialized.trezorDiscoveryId).toBe('');
        expect(session.serialized.paths).toEqual({});
    });
});

describe('trezorPreviewGetAddressPage', () => {
    it('forwards to the shared helper with the Trezor rpc and discovery field', async () => {
        (previewModule.hardwarePreviewGetAddressPage as jest.Mock).mockResolvedValueOnce([
            { address: '0xRoot', index: 0 },
        ]);
        const session = createTrezorHardwarePreviewSession();
        const out = await trezorPreviewGetAddressPage(session, 'next');
        expect(out).toEqual([{ address: '0xRoot', index: 0 }]);
        expect(previewModule.hardwarePreviewGetAddressPage).toHaveBeenCalledWith(
            session,
            'next',
            portModule.trezorOffscreenRpc,
            'trezorDiscoveryId',
        );
    });
});

describe('trezorPreviewDispose', () => {
    it('forwards to the shared dispose helper', async () => {
        (previewModule.hardwarePreviewDispose as jest.Mock).mockResolvedValueOnce(undefined);
        await trezorPreviewDispose('inst-2');
        expect(previewModule.hardwarePreviewDispose).toHaveBeenCalledWith(
            'inst-2',
            portModule.trezorOffscreenRpc,
        );
    });
});
