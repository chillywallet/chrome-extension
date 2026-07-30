import { ethErrors } from 'eth-rpc-errors';
import {
    buildEip5792CapabilitiesForChain,
    isCapabilitiesAddressAuthorized,
    parseWalletGetCapabilitiesParams,
} from '../eip5792/capabilities';
import { validateWalletSendCallsPreflight } from '../eip5792/sendCalls';
import {
    EIP5792_APPROVAL_TYPES,
    EIP5792_ERROR_CODES,
    EIP5792_METHODS,
    SendCallsParams,
    WalletSendCallsApprovalValue,
} from '../eip5792/types';
import { toHex } from '../web3';

type ApprovalResultCallbacks = {
    success: (value?: unknown) => void;
    error: (error: Error) => void;
};

const eip5792Handlers = {
    methodNames: [
        EIP5792_METHODS.WALLET_GET_CAPABILITIES,
        EIP5792_METHODS.WALLET_SEND_CALLS,
        EIP5792_METHODS.WALLET_GET_CALLS_STATUS,
        EIP5792_METHODS.WALLET_SHOW_CALLS_STATUS,
    ],
    implementation: eip5792Handler,
    hookNames: {
        getAccounts: true,
        getCurrentChain: true,
        requestUserApproval: true,
        executeWalletSendCalls: true,
        getCallBatchStatus: true,
        hasCallBatch: true,
    },
};

export default eip5792Handlers;

async function eip5792Handler(
    req: any,
    res: any,
    _next: Function,
    end: Function,
    {
        getAccounts,
        getCurrentChain,
        requestUserApproval,
        executeWalletSendCalls,
        getCallBatchStatus,
        hasCallBatch,
    }: {
        getAccounts: () => Promise<string[]>;
        getCurrentChain: () => { chain_id: number };
        requestUserApproval: (opts: Record<string, unknown>) => Promise<unknown>;
        executeWalletSendCalls: (opts: {
            payload: SendCallsParams;
            from: string;
            gas?: WalletSendCallsApprovalValue;
        }) => Promise<string>;
        getCallBatchStatus: (id: string) => Promise<unknown | undefined>;
        hasCallBatch: (id: string) => Promise<boolean>;
    },
) {
    const method = req.method;
    const accounts = (await getAccounts()).map((account: string) => account.toLowerCase());

    if (method === EIP5792_METHODS.WALLET_GET_CAPABILITIES) {
        if (!accounts.length) {
            return end(
                ethErrors.provider.unauthorized({
                    message: 'The specified address is not connected or not in the wallet',
                }),
            );
        }

        const parsed = parseWalletGetCapabilitiesParams(req.params);
        if (!parsed.ok) {
            return end(ethErrors.rpc.invalidParams({ message: parsed.message }));
        }

        if (parsed.address && !isCapabilitiesAddressAuthorized(parsed.address, accounts)) {
            return end(
                ethErrors.provider.unauthorized({
                    message: 'The specified address is not connected or not in the wallet',
                }),
            );
        }

        const activeChainId = getCurrentChain().chain_id;
        const chainsToReport =
            parsed.chainIdsHex.length > 0 ? parsed.chainIdsHex : [toHex(activeChainId)];
        const capabilities: Record<string, Record<string, unknown>> = {};
        const seenKeys = new Set<string>();

        for (const chainIdHex of chainsToReport) {
            const chainIdNum = parseInt(chainIdHex, 16);
            if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
                continue;
            }

            const built = buildEip5792CapabilitiesForChain(chainIdNum);
            if (!built) {
                continue;
            }

            const key = toHex(chainIdNum);
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);
            capabilities[key] = built;
        }

        res.result = capabilities;
        return end();
    }

    if (method === EIP5792_METHODS.WALLET_SEND_CALLS) {
        if (!accounts.length) {
            return end(
                ethErrors.provider.unauthorized({
                    message: 'The specified address is not connected or not in the wallet',
                }),
            );
        }

        const body = (Array.isArray(req.params) ? req.params[0] : req.params) as
            | SendCallsParams
            | undefined;
        const currentChainId = getCurrentChain().chain_id;
        const preflight = validateWalletSendCallsPreflight(body ?? null, currentChainId);

        if (!preflight.ok) {
            return end(
                ethErrors.provider.custom({
                    code: preflight.rpcError.code,
                    message: preflight.message,
                }),
            );
        }

        let approval:
            | { value?: WalletSendCallsApprovalValue; resultCallbacks?: ApprovalResultCallbacks }
            | undefined;
        try {
            approval = (await requestUserApproval({
                origin: req.origin,
                type: EIP5792_APPROVAL_TYPES.SEND_CALLS,
                requestData: {
                    method: EIP5792_METHODS.WALLET_SEND_CALLS,
                    params: body,
                    from: accounts[0],
                    origin: req.origin,
                },
                expectsResult: true,
            })) as { value?: WalletSendCallsApprovalValue; resultCallbacks?: ApprovalResultCallbacks };

            const batchId = await executeWalletSendCalls({
                payload: body as SendCallsParams,
                from: accounts[0],
                gas: approval?.value,
            });

            approval?.resultCallbacks?.success({ id: batchId });
            res.result = { id: batchId };
            return end();
        } catch (error: any) {
            if (approval?.resultCallbacks) {
                const wrapped =
                    error instanceof Error
                        ? error
                        : new Error(error?.message ?? 'wallet_sendCalls failed');
                approval.resultCallbacks.error(wrapped);
            }
            return end(error);
        }
    }

    if (method === EIP5792_METHODS.WALLET_GET_CALLS_STATUS) {
        const batchId = (req.params as [string])?.[0];
        if (!batchId || typeof batchId !== 'string') {
            return end(ethErrors.rpc.invalidParams({ message: 'Invalid params' }));
        }

        const status = await getCallBatchStatus(batchId);
        if (!status) {
            return end(
                ethErrors.provider.custom({
                    code: EIP5792_ERROR_CODES.UNKNOWN_BUNDLE_ID.code,
                    message: EIP5792_ERROR_CODES.UNKNOWN_BUNDLE_ID.message,
                }),
            );
        }

        res.result = status;
        return end();
    }

    if (method === EIP5792_METHODS.WALLET_SHOW_CALLS_STATUS) {
        const batchId = (req.params as [string])?.[0];
        if (!batchId || typeof batchId !== 'string') {
            return end(ethErrors.rpc.invalidParams({ message: 'Invalid params' }));
        }

        if (!(await hasCallBatch(batchId))) {
            return end(
                ethErrors.provider.custom({
                    code: EIP5792_ERROR_CODES.UNKNOWN_BUNDLE_ID.code,
                    message: EIP5792_ERROR_CODES.UNKNOWN_BUNDLE_ID.message,
                }),
            );
        }

        const status = await getCallBatchStatus(batchId);

        // FE behavior: trigger UI and return null immediately.
        void requestUserApproval({
            origin: req.origin,
            type: EIP5792_APPROVAL_TYPES.SHOW_CALLS_STATUS,
            requestData: {
                method: EIP5792_METHODS.WALLET_SHOW_CALLS_STATUS,
                batchId,
                status,
                origin: req.origin,
            },
        }).catch(() => undefined);

        res.result = null;
        return end();
    }

    return end(
        ethErrors.provider.custom({
            code: EIP5792_ERROR_CODES.INVALID_PARAMS.code,
            message: `Unsupported method: ${method}`,
        }),
    );
}
