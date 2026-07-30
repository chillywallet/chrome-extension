import { LedgerWebHidBridge } from '../../../src/lib/ledger/LedgerWebHidBridge';
import { LEDGER_ERR_OPEN_ETHEREUM_APP } from '../../../src/lib/ledger/ledgerErrorMessages';

const mockEthApp = {
    openEthApp: jest.fn(),
    getAppNameAndVersion: jest.fn(),
    getAddress: jest.fn(),
    clearSignTransaction: jest.fn(),
    signTransaction: jest.fn(),
    signPersonalMessage: jest.fn(),
    signEIP712Message: jest.fn(),
    signEIP712HashedMessage: jest.fn(),
};

const mockMiddleware = {
    getEthApp: () => mockEthApp,
    setTransport: jest.fn(),
    dispose: jest.fn(),
};

jest.mock('@metamask/eth-ledger-bridge-keyring', () => ({
    LedgerTransportMiddleware: function MockLedgerTransportMiddleware() {
        return mockMiddleware;
    },
}));

jest.mock('@metamask/eth-sig-util', () => ({
    SignTypedDataVersion: { V4: 'V4' },
    TypedDataUtils: {
        sanitizeData: (msg: any) => ({
            domain: msg?.domain ?? {},
            types: msg?.types ?? {},
            primaryType: msg?.primaryType ?? 'EIP712Domain',
            message: msg?.message ?? {},
        }),
        hashStruct: (_kind: string, _val: any, _types: any, _v: any) => Buffer.from('deadbeef', 'hex'),
    },
}));

jest.mock('../../../src/lib/ledger/openLedgerWebHidTransport', () => ({
    openLedgerWebHidTransport: jest.fn(),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const transportModule = require('../../../src/lib/ledger/openLedgerWebHidTransport');

beforeEach(() => {
    mockMiddleware.setTransport.mockReset();
    mockMiddleware.dispose.mockReset();
    mockEthApp.openEthApp.mockReset();
    mockEthApp.getAppNameAndVersion.mockReset();
    mockEthApp.getAddress.mockReset();
    mockEthApp.clearSignTransaction.mockReset();
    mockEthApp.signTransaction.mockReset();
    mockEthApp.signPersonalMessage.mockReset();
    mockEthApp.signEIP712Message.mockReset();
    mockEthApp.signEIP712HashedMessage.mockReset();
    (transportModule.openLedgerWebHidTransport as jest.Mock).mockReset();
});

describe('LedgerWebHidBridge', () => {
    it('init() resolves and getOptions returns the provided options', async () => {
        const bridge = new LedgerWebHidBridge({ a: 1 });
        await expect(bridge.init()).resolves.toBeUndefined();
        await expect(bridge.getOptions()).resolves.toEqual({ a: 1 });
    });

    it('setOptions replaces the stored options', async () => {
        const bridge = new LedgerWebHidBridge({ a: 1 });
        await bridge.setOptions({ b: 2 });
        await expect(bridge.getOptions()).resolves.toEqual({ b: 2 });
    });

    it('destroy disposes the middleware and clears connection flag', async () => {
        const bridge = new LedgerWebHidBridge();
        bridge.isDeviceConnected = true;
        mockMiddleware.dispose.mockResolvedValueOnce(undefined);
        await bridge.destroy();
        expect(bridge.isDeviceConnected).toBe(false);
    });

    it('destroy swallows middleware errors', async () => {
        const bridge = new LedgerWebHidBridge();
        mockMiddleware.dispose.mockRejectedValueOnce(new Error('eh'));
        await expect(bridge.destroy()).resolves.toBeUndefined();
        expect(bridge.isDeviceConnected).toBe(false);
    });

    it('attemptMakeApp invokes openEthApp on the device', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.openEthApp.mockResolvedValueOnce(undefined);
        await expect(bridge.attemptMakeApp()).resolves.toBe(true);
    });

    it('ensureEthereumAppOpenOrThrow resolves when Ethereum app is active', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.getAppNameAndVersion.mockResolvedValueOnce({ appName: 'Ethereum' });
        await expect(bridge.ensureEthereumAppOpenOrThrow()).resolves.toBeUndefined();
    });

    it('ensureEthereumAppOpenOrThrow asks to open Ethereum app and throws when other app is active', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.getAppNameAndVersion.mockResolvedValueOnce({ appName: 'BOLOS' });
        mockEthApp.openEthApp.mockResolvedValueOnce(undefined);
        await expect(bridge.ensureEthereumAppOpenOrThrow()).rejects.toThrow(
            LEDGER_ERR_OPEN_ETHEREUM_APP,
        );
    });

    it('ensureEthereumAppOpenOrThrow rethrows when device is locked', async () => {
        const bridge = new LedgerWebHidBridge();
        const lockedErr = Object.assign(new Error('Locked device'), { statusCode: 0x5515 });
        mockEthApp.getAppNameAndVersion.mockRejectedValueOnce(lockedErr);
        await expect(bridge.ensureEthereumAppOpenOrThrow()).rejects.toBe(lockedErr);
    });

    it('ensureEthereumAppOpenOrThrow detects "locked device" via message', async () => {
        const bridge = new LedgerWebHidBridge();
        const err = new Error('Some locked device thing');
        mockEthApp.getAppNameAndVersion.mockRejectedValueOnce(err);
        await expect(bridge.ensureEthereumAppOpenOrThrow()).rejects.toBe(err);
    });

    it('ensureEthereumAppOpenOrThrow falls through to opening Ethereum on non-locked error', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.getAppNameAndVersion.mockRejectedValueOnce(new Error('busy'));
        mockEthApp.openEthApp.mockResolvedValueOnce(undefined);
        await expect(bridge.ensureEthereumAppOpenOrThrow()).rejects.toThrow(
            LEDGER_ERR_OPEN_ETHEREUM_APP,
        );
    });

    it('updateTransportMethod accepts a Transport instance directly', async () => {
        const bridge = new LedgerWebHidBridge();
        const transport = { name: 'transport' } as any;
        await expect(bridge.updateTransportMethod(transport)).resolves.toBe(true);
        expect(mockMiddleware.setTransport).toHaveBeenCalledWith(transport);
        expect(bridge.isDeviceConnected).toBe(true);
    });

    it('updateTransportMethod opens a WebHID transport for "webhid"/"hid" strings', async () => {
        const bridge = new LedgerWebHidBridge();
        (transportModule.openLedgerWebHidTransport as jest.Mock).mockResolvedValueOnce({
            kind: 'hid',
        });
        await expect(bridge.updateTransportMethod('webhid')).resolves.toBe(true);
        expect(mockMiddleware.setTransport).toHaveBeenCalledWith({ kind: 'hid' });
    });

    it('updateTransportMethod throws on unsupported transport string', async () => {
        const bridge = new LedgerWebHidBridge();
        await expect(bridge.updateTransportMethod('bluetooth')).rejects.toThrow(
            /Unsupported Ledger transport/,
        );
    });

    it('getPublicKey delegates to the eth app', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.getAddress.mockResolvedValueOnce({ address: '0xa', publicKey: 'pk' });
        await expect(bridge.getPublicKey({ hdPath: "m/44'/60'/0'/0/0" } as any)).resolves.toEqual({
            address: '0xa',
            publicKey: 'pk',
        });
    });

    it('deviceSignTransaction prefers clearSignTransaction', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.clearSignTransaction.mockResolvedValueOnce({ r: 'r', s: 's', v: 'v' });
        const out = await bridge.deviceSignTransaction({ hdPath: 'p', tx: '0x' } as any);
        expect(out).toEqual({ r: 'r', s: 's', v: 'v' });
    });

    it('deviceSignTransaction falls back to signTransaction on non-rejection error', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.clearSignTransaction.mockRejectedValueOnce(new Error('cant clear-sign'));
        mockEthApp.signTransaction.mockResolvedValueOnce({ r: '1', s: '2', v: '3' });
        const out = await bridge.deviceSignTransaction({ hdPath: 'p', tx: '0x' } as any);
        expect(out).toEqual({ r: '1', s: '2', v: '3' });
    });

    it('deviceSignTransaction rethrows user-rejected errors', async () => {
        const bridge = new LedgerWebHidBridge();
        const err = Object.assign(new Error('rejected'), { statusCode: 0x6985 });
        mockEthApp.clearSignTransaction.mockRejectedValueOnce(err);
        await expect(bridge.deviceSignTransaction({ hdPath: 'p', tx: '0x' } as any)).rejects.toBe(
            err,
        );
    });

    it('deviceSignTransaction rethrows when statusText is CONDITIONS_OF_USE_NOT_SATISFIED', async () => {
        const bridge = new LedgerWebHidBridge();
        const err = Object.assign(new Error('declined'), {
            statusText: 'CONDITIONS_OF_USE_NOT_SATISFIED',
        });
        mockEthApp.clearSignTransaction.mockRejectedValueOnce(err);
        await expect(bridge.deviceSignTransaction({ hdPath: 'p', tx: '0x' } as any)).rejects.toBe(
            err,
        );
    });

    it('deviceSignMessage delegates to signPersonalMessage', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.signPersonalMessage.mockResolvedValueOnce({ r: '1', s: '2', v: '3' });
        const out = await bridge.deviceSignMessage({ hdPath: 'p', message: '0x' } as any);
        expect(out).toEqual({ r: '1', s: '2', v: '3' });
    });

    it('deviceSignTypedData prefers signEIP712Message', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.signEIP712Message.mockResolvedValueOnce({ r: 'a', s: 'b', v: 'c' });
        const out = await bridge.deviceSignTypedData({ hdPath: 'p', message: {} } as any);
        expect(out).toEqual({ r: 'a', s: 'b', v: 'c' });
    });

    it('deviceSignTypedData falls back to hashed message when INS_NOT_SUPPORTED', async () => {
        const bridge = new LedgerWebHidBridge();
        const err = Object.assign(new Error('not supported'), {
            statusText: 'INS_NOT_SUPPORTED',
        });
        mockEthApp.signEIP712Message.mockRejectedValueOnce(err);
        mockEthApp.signEIP712HashedMessage.mockResolvedValueOnce({ r: '1', s: '2', v: '3' });
        const out = await bridge.deviceSignTypedData({
            hdPath: 'p',
            message: { domain: {}, primaryType: 'X', types: {}, message: {} },
        } as any);
        expect(out).toEqual({ r: '1', s: '2', v: '3' });
        expect(mockEthApp.signEIP712HashedMessage).toHaveBeenCalled();
    });

    it('deviceSignTypedData rethrows non-INS_NOT_SUPPORTED errors', async () => {
        const bridge = new LedgerWebHidBridge();
        mockEthApp.signEIP712Message.mockRejectedValueOnce(new Error('boom'));
        await expect(bridge.deviceSignTypedData({ hdPath: 'p', message: {} } as any)).rejects.toThrow(
            'boom',
        );
    });
});
