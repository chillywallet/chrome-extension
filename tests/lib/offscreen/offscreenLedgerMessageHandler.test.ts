// Capture event listeners registered on navigator.hid
const mockHidListeners: Array<{ type: string; listener: (e: Event) => void }> = [];
Object.defineProperty(global.navigator, 'hid', {
    configurable: true,
    value: {
        addEventListener: (type: string, listener: (e: Event) => void) => {
            mockHidListeners.push({ type, listener });
        },
    },
});

const mockKeyringInstances: any[] = [];
const mockKeyringFactory = {
    addAccounts: jest.fn(),
    signTransaction: jest.fn(),
    signPersonalMessage: jest.fn(),
    signTypedData: jest.fn(),
    getFirstPage: jest.fn(),
    getNextPage: jest.fn(),
    getPreviousPage: jest.fn(),
    setAccountToUnlock: jest.fn(),
    serialize: jest.fn(),
    deserialize: jest.fn(),
    init: jest.fn(),
    destroy: jest.fn(),
};

jest.mock('@metamask/eth-ledger-bridge-keyring', () => ({
    LedgerKeyring: function MockLedgerKeyring(opts: any) {
        const instance: any = {
            bridge: opts?.bridge,
            init: (...a: any[]) => mockKeyringFactory.init(...a),
            destroy: (...a: any[]) => mockKeyringFactory.destroy(...a),
            deserialize: (...a: any[]) => mockKeyringFactory.deserialize(...a),
            serialize: (...a: any[]) => mockKeyringFactory.serialize(...a),
            addAccounts: (...a: any[]) => mockKeyringFactory.addAccounts(...a),
            signTransaction: (...a: any[]) => mockKeyringFactory.signTransaction(...a),
            signPersonalMessage: (...a: any[]) => mockKeyringFactory.signPersonalMessage(...a),
            signTypedData: (...a: any[]) => mockKeyringFactory.signTypedData(...a),
            getFirstPage: (...a: any[]) => mockKeyringFactory.getFirstPage(...a),
            getNextPage: (...a: any[]) => mockKeyringFactory.getNextPage(...a),
            getPreviousPage: (...a: any[]) => mockKeyringFactory.getPreviousPage(...a),
            setAccountToUnlock: (...a: any[]) => mockKeyringFactory.setAccountToUnlock(...a),
        };
        mockKeyringInstances.push(instance);
        return instance;
    },
}));

jest.mock('../../../src/lib/ledger/LedgerWebHidBridge', () => ({
    LedgerWebHidBridge: function MockBridge() {
        return {
            updateTransportMethod: jest.fn().mockResolvedValue(true),
            ensureEthereumAppOpenOrThrow: jest.fn().mockResolvedValue(undefined),
        };
    },
}));

jest.mock('../../../src/lib/offscreen/hardwareTxWire', () => ({
    typedTransactionFromHardwareWirePayload: (p: any) => ({ __unsigned: true, payload: p }),
    typedTransactionToWireRecord: (t: any) => ({ __wire: true, tx: t }),
}));

jest.mock('../../../src/lib/ledger/ledgerNormalizeDeviceError', () => ({
    normalizeLedgerDeviceErrorMessage: (e: any) => `normalized:${e instanceof Error ? e.message : String(e)}`,
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
    handleOffscreenLedgerRuntimeMessage,
} = require('../../../src/lib/offscreen/offscreenLedgerMessageHandler');
const {
    HARDWARE_OFFSCREEN_MESSAGE,
} = require('../../../src/lib/offscreen/hardwareOffscreenMessaging');
const { LEDGER_USB_VENDOR_ID } = require('../../../src/lib/ledger/ledgerUsbConstants');

function call(envelope: any): Promise<any> {
    return new Promise(resolve => {
        const handled = handleOffscreenLedgerRuntimeMessage(envelope, null, resolve);
        if (!handled) resolve({ __notHandled: true });
    });
}

beforeEach(() => {
    Object.values(mockKeyringFactory).forEach((fn: any) => fn.mockReset?.());
    mockKeyringFactory.init.mockResolvedValue(undefined);
    mockKeyringFactory.destroy.mockResolvedValue(undefined);
    mockKeyringFactory.deserialize.mockResolvedValue(undefined);
    mockKeyringFactory.serialize.mockResolvedValue({ ok: true });
});

describe('handleOffscreenLedgerRuntimeMessage', () => {
    it('returns false for non-ledger envelopes', () => {
        const result = handleOffscreenLedgerRuntimeMessage({ target: 'other' }, null, () => {});
        expect(result).toBe(false);
    });

    it('returns false when ledgerRequestId is missing', () => {
        const result = handleOffscreenLedgerRuntimeMessage(
            { target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget, instanceId: 'a', method: 'm' },
            null,
            () => {},
        );
        expect(result).toBe(false);
    });

    it('handles dispose without ever opening a session', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'r1',
            instanceId: 'i1',
            method: 'dispose',
        });
        expect(reply).toEqual({ ledgerRequestId: 'r1', ok: true });
    });

    it('addAccounts wires through serialized state', async () => {
        mockKeyringFactory.addAccounts.mockResolvedValueOnce(['0xa', '0xb']);
        mockKeyringFactory.serialize.mockResolvedValueOnce({ state: 1 });
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'r2',
            instanceId: 'i2',
            method: 'addAccounts',
            payload: { serialized: { x: 1 }, n: 2 },
        });
        expect(reply).toMatchObject({
            ledgerRequestId: 'r2',
            ok: true,
            result: { serialized: { state: 1 }, newAddresses: ['0xa', '0xb'] },
        });
        expect(mockKeyringFactory.addAccounts).toHaveBeenCalledWith(2);
    });

    it('addAccounts defaults n to 1', async () => {
        mockKeyringFactory.addAccounts.mockResolvedValueOnce(['0xa']);
        await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'r3',
            instanceId: 'i3',
            method: 'addAccounts',
            payload: { serialized: {} },
        });
        expect(mockKeyringFactory.addAccounts).toHaveBeenCalledWith(1);
    });

    it('signTransaction returns a wire-serialized signed tx', async () => {
        mockKeyringFactory.signTransaction.mockResolvedValueOnce({ signed: true });
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'r4',
            instanceId: 'i4',
            method: 'signTransaction',
            payload: { serialized: {}, address: '0xabc', wire: { tx: {}, chainId: '1', hardfork: 'london' } },
        });
        expect(reply.result.signedTx).toEqual({ __wire: true, tx: { signed: true } });
    });

    it('signPersonalMessage forwards address and message', async () => {
        mockKeyringFactory.signPersonalMessage.mockResolvedValueOnce('0xsig');
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'r5',
            instanceId: 'i5',
            method: 'signPersonalMessage',
            payload: { serialized: {}, address: '0xabc', message: '0x01' },
        });
        expect(reply.result.signature).toBe('0xsig');
    });

    it('signTypedData requires V4', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'r6',
            instanceId: 'i6',
            method: 'signTypedData',
            payload: { serialized: {}, address: '0xabc', data: {}, version: 'V1' },
        });
        expect(reply).toMatchObject({ ledgerRequestId: 'r6', ok: false });
    });

    it('signTypedData V4 returns signature', async () => {
        mockKeyringFactory.signTypedData.mockResolvedValueOnce('0xtyped');
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'r7',
            instanceId: 'i7',
            method: 'signTypedData',
            payload: { serialized: {}, address: '0xabc', data: {}, version: 'V4' },
        });
        expect(reply.result.signature).toBe('0xtyped');
    });

    it('getAddressPage dispatches by direction', async () => {
        mockKeyringFactory.getFirstPage.mockResolvedValueOnce([{ address: '0xR', index: 0 }]);
        const r1 = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'p1',
            instanceId: 'I',
            method: 'getAddressPage',
            payload: { serialized: {}, direction: 'first' },
        });
        expect(r1.result.accounts).toEqual([{ address: '0xR', index: 0 }]);

        mockKeyringFactory.getNextPage.mockResolvedValueOnce([{ address: '0xN', index: 1 }]);
        const r2 = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'p2',
            instanceId: 'I',
            method: 'getAddressPage',
            payload: { serialized: {}, direction: 'next' },
        });
        expect(r2.result.accounts).toEqual([{ address: '0xN', index: 1 }]);

        mockKeyringFactory.getPreviousPage.mockResolvedValueOnce([{ address: '0xP', index: -1 }]);
        const r3 = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'p3',
            instanceId: 'I',
            method: 'getAddressPage',
            payload: { serialized: {}, direction: 'prev' },
        });
        expect(r3.result.accounts).toEqual([{ address: '0xP', index: -1 }]);
    });

    it('getAddressPage rejects invalid directions', async () => {
        const r = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'p4',
            instanceId: 'I',
            method: 'getAddressPage',
            payload: { serialized: {}, direction: 'sideways' },
        });
        expect(r).toMatchObject({ ok: false });
    });

    it('importAccountsAtIndices iterates indices and aggregates new addresses', async () => {
        mockKeyringFactory.addAccounts.mockResolvedValueOnce(['0xA']);
        mockKeyringFactory.addAccounts.mockResolvedValueOnce(['0xB']);
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'p5',
            instanceId: 'I',
            method: 'importAccountsAtIndices',
            payload: { serialized: {}, indices: [2, 0, 0] },
        });
        expect(mockKeyringFactory.setAccountToUnlock).toHaveBeenNthCalledWith(1, 0);
        expect(mockKeyringFactory.setAccountToUnlock).toHaveBeenNthCalledWith(2, 2);
        expect(reply.result.newAddresses).toEqual(['0xA', '0xB']);
    });

    it('importAccountsAtIndices defaults to empty list on non-array indices', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'p6',
            instanceId: 'I',
            method: 'importAccountsAtIndices',
            payload: { serialized: {}, indices: 'oops' as any },
        });
        expect(reply.result.newAddresses).toEqual([]);
    });

    it('returns an ok:false with normalized message on unknown ops', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'p7',
            instanceId: 'I',
            method: 'whatever',
        });
        expect(reply).toMatchObject({ ok: false });
    });

    it('catches sync throw inside a session method and normalizes the message', async () => {
        mockKeyringFactory.addAccounts.mockRejectedValueOnce(new Error('device unplug'));
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'p8',
            instanceId: 'I',
            method: 'addAccounts',
            payload: { serialized: {}, n: 1 },
        });
        expect(reply.error).toContain('normalized:');
    });

    it('disposes prior session when instanceId changes', async () => {
        mockKeyringFactory.addAccounts.mockResolvedValueOnce(['0x']);
        await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'a',
            instanceId: 'one',
            method: 'addAccounts',
            payload: { serialized: {}, n: 1 },
        });
        mockKeyringFactory.addAccounts.mockResolvedValueOnce(['0xz']);
        await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'b',
            instanceId: 'two',
            method: 'addAccounts',
            payload: { serialized: {}, n: 1 },
        });
        expect(mockKeyringFactory.destroy).toHaveBeenCalled();
    });

    it('dispose call with no session is a no-op', async () => {
        const reply = await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'd1',
            instanceId: 'unused',
            method: 'dispose',
        });
        expect(reply.ok).toBe(true);
    });

    it('registers a hid disconnect listener that disposes when Ledger unplugs', async () => {
        // First set up a session.
        mockKeyringFactory.addAccounts.mockResolvedValueOnce(['0x']);
        await call({
            target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
            ledgerRequestId: 'hid-1',
            instanceId: 'hid-inst',
            method: 'addAccounts',
            payload: { serialized: {}, n: 1 },
        });
        const before = mockKeyringFactory.destroy.mock.calls.length;
        // Then fire a Ledger disconnect.
        const disconnect = mockHidListeners.find(l => l.type === 'disconnect');
        expect(disconnect).toBeDefined();
        disconnect!.listener({
            device: { vendorId: LEDGER_USB_VENDOR_ID },
        } as any);
        // Allow microtask queue to drain.
        await Promise.resolve();
        await Promise.resolve();
        expect(mockKeyringFactory.destroy.mock.calls.length).toBeGreaterThan(before);
    });

    it('hid disconnect for a non-Ledger device is a no-op', async () => {
        const disconnect = mockHidListeners.find(l => l.type === 'disconnect');
        expect(disconnect).toBeDefined();
        const before = mockKeyringFactory.destroy.mock.calls.length;
        disconnect!.listener({ device: { vendorId: 0x1234 } } as any);
        await Promise.resolve();
        expect(mockKeyringFactory.destroy.mock.calls.length).toBe(before);
    });
});
