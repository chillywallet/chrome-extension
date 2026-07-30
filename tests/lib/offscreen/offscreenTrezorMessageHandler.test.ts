const mockTrezorKeyringApi = {
    init: jest.fn(),
    destroy: jest.fn(),
    deserialize: jest.fn(),
    serialize: jest.fn(),
    addAccounts: jest.fn(),
    getAccounts: jest.fn(),
    signTransaction: jest.fn(),
    signPersonalMessage: jest.fn(),
    signTypedData: jest.fn(),
    getFirstPage: jest.fn(),
    getNextPage: jest.fn(),
    getPreviousPage: jest.fn(),
    setAccountToUnlock: jest.fn(),
};

let mockBridgeInitiated = true;

jest.mock('@metamask/eth-trezor-keyring', () => ({
    TrezorConnectBridge: function MockBridge() {
        return {
            init: jest.fn().mockResolvedValue(undefined),
            get trezorConnectInitiated() {
                return mockBridgeInitiated;
            },
        };
    },
    TrezorKeyring: function MockKeyring() {
        return {
            destroy: (...a: any[]) => mockTrezorKeyringApi.destroy(...a),
            deserialize: (...a: any[]) => mockTrezorKeyringApi.deserialize(...a),
            serialize: (...a: any[]) => mockTrezorKeyringApi.serialize(...a),
            getAccounts: (...a: any[]) => mockTrezorKeyringApi.getAccounts(...a),
            addAccounts: (...a: any[]) => mockTrezorKeyringApi.addAccounts(...a),
            signTransaction: (...a: any[]) => mockTrezorKeyringApi.signTransaction(...a),
            signPersonalMessage: (...a: any[]) => mockTrezorKeyringApi.signPersonalMessage(...a),
            signTypedData: (...a: any[]) => mockTrezorKeyringApi.signTypedData(...a),
            getFirstPage: (...a: any[]) => mockTrezorKeyringApi.getFirstPage(...a),
            getNextPage: (...a: any[]) => mockTrezorKeyringApi.getNextPage(...a),
            getPreviousPage: (...a: any[]) => mockTrezorKeyringApi.getPreviousPage(...a),
            setAccountToUnlock: (...a: any[]) => mockTrezorKeyringApi.setAccountToUnlock(...a),
        };
    },
}));

jest.mock('@trezor/connect-web', () => ({
    __esModule: true,
    default: {
        dispose: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@metamask/eth-sig-util', () => ({
    SignTypedDataVersion: { V4: 'V4' },
}));

jest.mock('../../../src/lib/offscreen/hardwareTxWire', () => ({
    typedTransactionFromHardwareWirePayload: (p: any) => ({ __unsigned: true, payload: p }),
    typedTransactionToWireRecord: (t: any) => ({ __wire: true, tx: t }),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
    handleOffscreenTrezorRuntimeMessage,
} = require('../../../src/lib/offscreen/offscreenTrezorMessageHandler');
const {
    HARDWARE_OFFSCREEN_MESSAGE,
} = require('../../../src/lib/offscreen/hardwareOffscreenMessaging');

function call(envelope: any): Promise<any> {
    return new Promise(resolve => {
        const handled = handleOffscreenTrezorRuntimeMessage(envelope, null, resolve);
        if (!handled) resolve({ __notHandled: true });
    });
}

beforeEach(() => {
    Object.values(mockTrezorKeyringApi).forEach((fn: any) => fn.mockReset?.());
    mockTrezorKeyringApi.destroy.mockResolvedValue(undefined);
    mockTrezorKeyringApi.deserialize.mockResolvedValue(undefined);
    mockTrezorKeyringApi.serialize.mockResolvedValue({ ok: true });
    mockTrezorKeyringApi.getAccounts.mockResolvedValue([]);
    mockBridgeInitiated = true;
});

describe('handleOffscreenTrezorRuntimeMessage', () => {
    it('returns false for non-trezor envelopes', () => {
        const r = handleOffscreenTrezorRuntimeMessage({ target: 'other' }, null, () => {});
        expect(r).toBe(false);
    });

    it('returns false for missing trezorRequestId', () => {
        const r = handleOffscreenTrezorRuntimeMessage(
            { target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget },
            null,
            () => {},
        );
        expect(r).toBe(false);
    });

    it('dispose returns ok', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'r1',
            instanceId: 'i1',
            method: 'dispose',
        });
        expect(reply.ok).toBe(true);
    });

    it('addAccounts returns only newly added (diffed against before-set)', async () => {
        mockTrezorKeyringApi.getAccounts.mockResolvedValueOnce(['0xAaa']);
        mockTrezorKeyringApi.addAccounts.mockResolvedValueOnce(['0xAaa', '0xBbb']);
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'r2',
            instanceId: 'i2',
            method: 'addAccounts',
            payload: { serialized: {}, n: 1 },
        });
        expect(reply.result.newAddresses).toEqual(['0xBbb']);
    });

    it('addAccounts defaults n to 1', async () => {
        mockTrezorKeyringApi.getAccounts.mockResolvedValueOnce([]);
        mockTrezorKeyringApi.addAccounts.mockResolvedValueOnce(['0xa']);
        await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'r2b',
            instanceId: 'i2',
            method: 'addAccounts',
            payload: { serialized: {} },
        });
        expect(mockTrezorKeyringApi.addAccounts).toHaveBeenCalledWith(1);
    });

    it('signTransaction returns wire-serialized signed tx', async () => {
        mockTrezorKeyringApi.signTransaction.mockResolvedValueOnce({ signed: 'ok' });
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'r3',
            instanceId: 'i3',
            method: 'signTransaction',
            payload: { serialized: {}, address: '0x', wire: { tx: {}, chainId: '1', hardfork: 'l' } },
        });
        expect(reply.result.signedTx).toEqual({ __wire: true, tx: { signed: 'ok' } });
    });

    it('signPersonalMessage returns signature', async () => {
        mockTrezorKeyringApi.signPersonalMessage.mockResolvedValueOnce('0xsig');
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'r4',
            instanceId: 'i4',
            method: 'signPersonalMessage',
            payload: { serialized: {}, address: '0x', message: '0x01' },
        });
        expect(reply.result.signature).toBe('0xsig');
    });

    it('signTypedData rejects non-V4', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'r5',
            instanceId: 'i5',
            method: 'signTypedData',
            payload: { serialized: {}, address: '0x', data: {}, version: 'V1' },
        });
        expect(reply.ok).toBe(false);
    });

    it('signTypedData V4 returns signature', async () => {
        mockTrezorKeyringApi.signTypedData.mockResolvedValueOnce('0xtyped');
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'r6',
            instanceId: 'i6',
            method: 'signTypedData',
            payload: { serialized: {}, address: '0x', data: {}, version: 'V4' },
        });
        expect(reply.result.signature).toBe('0xtyped');
    });

    it('getAddressPage dispatches by direction (next/prev/first)', async () => {
        mockTrezorKeyringApi.getFirstPage.mockResolvedValueOnce([{ address: '0xR', index: 0 }]);
        const a = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'g1',
            instanceId: 'g',
            method: 'getAddressPage',
            payload: { serialized: {}, direction: 'first' },
        });
        expect(a.result.accounts[0]).toEqual({ address: '0xR', index: 0 });

        mockTrezorKeyringApi.getNextPage.mockResolvedValueOnce([{ address: '0xN', index: 1 }]);
        const b = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'g2',
            instanceId: 'g',
            method: 'getAddressPage',
            payload: { serialized: {}, direction: 'next' },
        });
        expect(b.result.accounts[0]).toEqual({ address: '0xN', index: 1 });

        mockTrezorKeyringApi.getPreviousPage.mockResolvedValueOnce([{ address: '0xP', index: -1 }]);
        const c = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'g3',
            instanceId: 'g',
            method: 'getAddressPage',
            payload: { serialized: {}, direction: 'prev' },
        });
        expect(c.result.accounts[0]).toEqual({ address: '0xP', index: -1 });
    });

    it('getAddressPage rejects invalid direction', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'g4',
            instanceId: 'g',
            method: 'getAddressPage',
            payload: { serialized: {}, direction: 'down' },
        });
        expect(reply.ok).toBe(false);
    });

    it('importAccountsAtIndices iterates and dedupes', async () => {
        mockTrezorKeyringApi.getAccounts.mockResolvedValueOnce([]);
        mockTrezorKeyringApi.addAccounts.mockResolvedValueOnce(['0xA']);
        mockTrezorKeyringApi.getAccounts.mockResolvedValueOnce(['0xA']);
        mockTrezorKeyringApi.addAccounts.mockResolvedValueOnce(['0xA', '0xB']);
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'imp1',
            instanceId: 'g',
            method: 'importAccountsAtIndices',
            payload: { serialized: {}, indices: [0, 0, 1] },
        });
        expect(reply.result.newAddresses).toEqual(['0xA', '0xB']);
    });

    it('importAccountsAtIndices defaults to empty list on non-array indices', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'imp2',
            instanceId: 'g',
            method: 'importAccountsAtIndices',
            payload: { serialized: {}, indices: 'oops' as any },
        });
        expect(reply.result.newAddresses).toEqual([]);
    });

    it('returns ok:false with message on unknown ops', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'u1',
            instanceId: 'g',
            method: 'who-knows',
        });
        expect(reply.ok).toBe(false);
        expect(reply.error).toContain('Unknown Trezor op: who-knows');
    });

    it('catches errors thrown inside a session method', async () => {
        mockTrezorKeyringApi.getAccounts.mockResolvedValueOnce([]);
        mockTrezorKeyringApi.addAccounts.mockRejectedValueOnce(new Error('user cancelled'));
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'err1',
            instanceId: 'g',
            method: 'addAccounts',
            payload: { serialized: {}, n: 1 },
        });
        expect(reply.ok).toBe(false);
        expect(reply.error).toContain('user cancelled');
    });

    it('errors when bridge fails to initialize', async () => {
        mockBridgeInitiated = false;
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
            trezorRequestId: 'init-err',
            instanceId: 'fresh-instance',
            method: 'addAccounts',
            payload: { serialized: {}, n: 1 },
        });
        expect(reply.ok).toBe(false);
        expect(reply.error).toContain('did not initialize');
    });
});
