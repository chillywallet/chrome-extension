import {
    createLedgerHardwarePreviewSession,
    ledgerPreviewDispose,
    ledgerPreviewGetAddressPage,
} from '../../../src/lib/ledger/ledgerHardwarePreview';

jest.mock('../../../src/lib/offscreen/hardwareAddressPreview', () => ({
    hardwarePreviewGetAddressPage: jest.fn(),
    hardwarePreviewDispose: jest.fn(),
}));

jest.mock('../../../src/lib/ledger/ledgerOffscreenPort', () => ({
    ledgerOffscreenRpc: jest.fn(),
}));

const previewModule = require('../../../src/lib/offscreen/hardwareAddressPreview');
const portModule = require('../../../src/lib/ledger/ledgerOffscreenPort');

beforeEach(() => {
    Object.defineProperty(global, 'crypto', {
        configurable: true,
        value: { randomUUID: () => 'session-uuid' },
    });
});

describe('createLedgerHardwarePreviewSession', () => {
    it('creates a session with a generated instanceId and default serialized', () => {
        const session = createLedgerHardwarePreviewSession();
        expect(session.instanceId).toBe('session-uuid');
        expect(session.serialized.ledgerDiscoveryId).toBe('');
        expect(session.serialized.accounts).toEqual([]);
    });
});

describe('ledgerPreviewGetAddressPage', () => {
    it('forwards to the shared helper with the Ledger rpc and discovery field', async () => {
        (previewModule.hardwarePreviewGetAddressPage as jest.Mock).mockResolvedValueOnce([
            { address: '0xRoot', index: 0 },
        ]);

        const session = createLedgerHardwarePreviewSession();
        const out = await ledgerPreviewGetAddressPage(session, 'first');

        expect(out).toEqual([{ address: '0xRoot', index: 0 }]);
        expect(previewModule.hardwarePreviewGetAddressPage).toHaveBeenCalledWith(
            session,
            'first',
            portModule.ledgerOffscreenRpc,
            'ledgerDiscoveryId',
        );
    });
});

describe('ledgerPreviewDispose', () => {
    it('forwards to the shared dispose helper', async () => {
        (previewModule.hardwarePreviewDispose as jest.Mock).mockResolvedValueOnce(undefined);
        await ledgerPreviewDispose('inst-1');
        expect(previewModule.hardwarePreviewDispose).toHaveBeenCalledWith(
            'inst-1',
            portModule.ledgerOffscreenRpc,
        );
    });
});
