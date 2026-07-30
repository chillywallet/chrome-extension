import eip5792 from '../../../src/lib/rpc-method-middleware/eip5792';
import { EIP5792_METHODS } from '../../../src/lib/eip5792/types';
import {
    buildEip5792CapabilitiesForChain,
    isCapabilitiesAddressAuthorized,
    parseWalletGetCapabilitiesParams,
} from '../../../src/lib/eip5792/capabilities';
import { validateWalletSendCallsPreflight } from '../../../src/lib/eip5792/sendCalls';

jest.mock('../../../src/lib/eip5792/capabilities', () => ({
    buildEip5792CapabilitiesForChain: jest.fn(() => ({ atomic: { status: 'ready' } })),
    isCapabilitiesAddressAuthorized: jest.fn(() => true),
    parseWalletGetCapabilitiesParams: jest.fn(() => ({ ok: true, chainIdsHex: [], address: undefined })),
}));

jest.mock('../../../src/lib/eip5792/sendCalls', () => ({
    validateWalletSendCallsPreflight: jest.fn(() => ({ ok: true })),
}));

const invoke = async (req: any, hooks: any) => {
    const res: any = {};
    const end = jest.fn();
    await eip5792.implementation(req, res, () => undefined as any, end, hooks);
    return { res, end };
};

const baseHooks = (overrides: any = {}) => ({
    getAccounts: jest.fn(async () => ['0xAbc']),
    getCurrentChain: () => ({ chain_id: 1 }),
    requestUserApproval: jest.fn(async () => ({ value: undefined, resultCallbacks: { success: jest.fn(), error: jest.fn() } })),
    executeWalletSendCalls: jest.fn(async () => 'batch-1'),
    getCallBatchStatus: jest.fn(async () => ({ status: 100 })),
    hasCallBatch: jest.fn(async () => true),
    ...overrides,
});

describe('eip5792 handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (parseWalletGetCapabilitiesParams as jest.Mock).mockReturnValue({
            ok: true,
            chainIdsHex: [],
            address: undefined,
        });
        (isCapabilitiesAddressAuthorized as jest.Mock).mockReturnValue(true);
        (validateWalletSendCallsPreflight as jest.Mock).mockReturnValue({ ok: true });
        (buildEip5792CapabilitiesForChain as jest.Mock).mockReturnValue({ atomic: { status: 'ready' } });
    });

    describe('wallet_getCapabilities', () => {
        it('rejects when no accounts', async () => {
            const { end } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CAPABILITIES },
                baseHooks({ getAccounts: jest.fn(async () => []) }),
            );
            expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/not connected/) }));
        });

        it('rejects on invalid params', async () => {
            (parseWalletGetCapabilitiesParams as jest.Mock).mockReturnValueOnce({ ok: false, message: 'bad' });
            const { end } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CAPABILITIES },
                baseHooks(),
            );
            expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/bad/) }));
        });

        it('rejects unauthorized address', async () => {
            (parseWalletGetCapabilitiesParams as jest.Mock).mockReturnValueOnce({ ok: true, chainIdsHex: [], address: '0xother' });
            (isCapabilitiesAddressAuthorized as jest.Mock).mockReturnValueOnce(false);
            const { end } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CAPABILITIES },
                baseHooks(),
            );
            expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/not connected/) }));
        });

        it('returns capabilities for active chain when no chainIds passed', async () => {
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CAPABILITIES },
                baseHooks(),
            );
            expect(res.result).toBeDefined();
        });

        it('skips invalid chainId hex entries', async () => {
            (parseWalletGetCapabilitiesParams as jest.Mock).mockReturnValueOnce({
                ok: true,
                chainIdsHex: ['0x0', '0xzzzz'],
                address: undefined,
            });
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CAPABILITIES },
                baseHooks(),
            );
            expect(res.result).toEqual({});
        });

        it('skips chains where capabilities build returns nothing', async () => {
            (parseWalletGetCapabilitiesParams as jest.Mock).mockReturnValueOnce({
                ok: true,
                chainIdsHex: ['0x1'],
                address: undefined,
            });
            (buildEip5792CapabilitiesForChain as jest.Mock).mockReturnValueOnce(null);
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CAPABILITIES },
                baseHooks(),
            );
            expect(res.result).toEqual({});
        });

        it('deduplicates chainIds when the same chain is requested twice', async () => {
            (parseWalletGetCapabilitiesParams as jest.Mock).mockReturnValueOnce({
                ok: true,
                chainIdsHex: ['0x1', '0x1'],
                address: undefined,
            });
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CAPABILITIES },
                baseHooks(),
            );
            expect(Object.keys(res.result).length).toBe(1);
        });
    });

    describe('wallet_sendCalls', () => {
        it('rejects when no accounts', async () => {
            const { end } = await invoke(
                { method: EIP5792_METHODS.WALLET_SEND_CALLS, params: [{ calls: [] }] },
                baseHooks({ getAccounts: jest.fn(async () => []) }),
            );
            expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/not connected/) }));
        });

        it('rejects on preflight failure', async () => {
            (validateWalletSendCallsPreflight as jest.Mock).mockReturnValueOnce({
                ok: false,
                rpcError: { code: 4001 },
                message: 'bad payload',
            });
            const { end } = await invoke(
                { method: EIP5792_METHODS.WALLET_SEND_CALLS, params: [{ calls: [] }] },
                baseHooks(),
            );
            expect(end).toHaveBeenCalledWith(expect.objectContaining({ code: 4001 }));
        });

        it('executes and returns batchId on approval', async () => {
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_SEND_CALLS, params: [{ calls: [] }] },
                baseHooks(),
            );
            expect(res.result).toEqual({ id: 'batch-1' });
        });

        it('reports approval error via resultCallbacks and end', async () => {
            const successCb = jest.fn();
            const errorCb = jest.fn();
            const hooks = baseHooks({
                requestUserApproval: jest.fn(async () => ({ resultCallbacks: { success: successCb, error: errorCb } })),
                executeWalletSendCalls: jest.fn().mockRejectedValueOnce(new Error('exec failed')),
            });
            const { end } = await invoke(
                { method: EIP5792_METHODS.WALLET_SEND_CALLS, params: [{ calls: [] }] },
                hooks,
            );
            expect(errorCb).toHaveBeenCalled();
            expect(end).toHaveBeenCalled();
        });

        it('accepts non-array params (object) and missing body', async () => {
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_SEND_CALLS, params: { calls: [] } as any },
                baseHooks(),
            );
            expect(res.result).toEqual({ id: 'batch-1' });
        });

        it('handles undefined body via the ?? null fallback', async () => {
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_SEND_CALLS, params: [undefined] },
                baseHooks(),
            );
            expect(res.result).toEqual({ id: 'batch-1' });
        });

        it('wraps non-Error rejections from executeWalletSendCalls using its message', async () => {
            const errorCb = jest.fn();
            const hooks = baseHooks({
                requestUserApproval: jest.fn(async () => ({ resultCallbacks: { success: jest.fn(), error: errorCb } })),
                executeWalletSendCalls: jest.fn().mockRejectedValueOnce({ message: 'plain' }),
            });
            await invoke(
                { method: EIP5792_METHODS.WALLET_SEND_CALLS, params: [{ calls: [] }] },
                hooks,
            );
            expect(errorCb).toHaveBeenCalledWith(expect.objectContaining({ message: 'plain' }));
        });

        it('falls back to a default message when non-Error rejection has no message', async () => {
            const errorCb = jest.fn();
            const hooks = baseHooks({
                requestUserApproval: jest.fn(async () => ({ resultCallbacks: { success: jest.fn(), error: errorCb } })),
                executeWalletSendCalls: jest.fn().mockRejectedValueOnce({}),
            });
            await invoke(
                { method: EIP5792_METHODS.WALLET_SEND_CALLS, params: [{ calls: [] }] },
                hooks,
            );
            expect(errorCb).toHaveBeenCalledWith(expect.objectContaining({ message: 'wallet_sendCalls failed' }));
        });
    });

    describe('wallet_getCallsStatus', () => {
        it('rejects when batchId is missing', async () => {
            const { end } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CALLS_STATUS, params: [] },
                baseHooks(),
            );
            expect(end).toHaveBeenCalled();
        });

        it('throws (via ethErrors) when batch not found', async () => {
            // Note: source uses EIP5792_ERROR_CODES.UNKNOWN_BUNDLE_ID.code = 5730 which is outside
            // the range eth-rpc-errors enforces for provider.custom. The implementation throws
            // synchronously rather than calling end.
            await expect(
                invoke(
                    { method: EIP5792_METHODS.WALLET_GET_CALLS_STATUS, params: ['x'] },
                    baseHooks({ getCallBatchStatus: jest.fn(async () => undefined) }),
                ),
            ).rejects.toThrow();
        });

        it('returns the status when found', async () => {
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_GET_CALLS_STATUS, params: ['x'] },
                baseHooks(),
            );
            expect(res.result).toEqual({ status: 100 });
        });
    });

    describe('wallet_showCallsStatus', () => {
        it('rejects when batchId is missing', async () => {
            const { end } = await invoke(
                { method: EIP5792_METHODS.WALLET_SHOW_CALLS_STATUS, params: [] },
                baseHooks(),
            );
            expect(end).toHaveBeenCalled();
        });

        it('throws (via ethErrors) when batch unknown', async () => {
            await expect(
                invoke(
                    { method: EIP5792_METHODS.WALLET_SHOW_CALLS_STATUS, params: ['x'] },
                    baseHooks({ hasCallBatch: jest.fn(async () => false) }),
                ),
            ).rejects.toThrow();
        });

        it('returns null and triggers UI when batch known', async () => {
            const requestUserApproval = jest.fn(async () => undefined as any);
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_SHOW_CALLS_STATUS, params: ['x'] },
                baseHooks({ requestUserApproval }),
            );
            expect(res.result).toBeNull();
            expect(requestUserApproval).toHaveBeenCalled();
        });

        it('swallows rejection from requestUserApproval when triggering UI', async () => {
            const requestUserApproval = jest.fn().mockRejectedValueOnce(new Error('ui-failed'));
            const { res } = await invoke(
                { method: EIP5792_METHODS.WALLET_SHOW_CALLS_STATUS, params: ['x'] },
                baseHooks({ requestUserApproval }),
            );
            // synchronously returns null; wait a tick so the .catch handler runs
            await Promise.resolve();
            await Promise.resolve();
            expect(res.result).toBeNull();
            expect(requestUserApproval).toHaveBeenCalled();
        });
    });

    it('throws (via ethErrors) on unsupported methods', async () => {
        // Source uses INVALID_PARAMS code which is -32602 (jsonrpc), outside provider.custom range.
        await expect(invoke({ method: 'wallet_unknown' }, baseHooks())).rejects.toThrow();
    });
});
