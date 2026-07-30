import { getBatchCallsContractAddress, getSupportedChainIds } from './capabilities';
import { EIP5792_ERROR_CODES, SendCallsParams } from './types';

export type WalletSendCallsPreflightResult =
    | { ok: true; chainIdNum: number }
    | {
          ok: false;
          message: string;
          rpcError: { code: number; message: string };
      };

export function validateWalletSendCallsPreflight(
    body: SendCallsParams | null,
    activeSessionChainId: number,
): WalletSendCallsPreflightResult {
    if (!body?.version || !Array.isArray(body.calls) || !body.calls.length) {
        return {
            ok: false,
            message: 'Invalid params: version and calls array required',
            rpcError: EIP5792_ERROR_CODES.INVALID_PARAMS,
        };
    }

    if (body.chainId === undefined || body.chainId === null) {
        return {
            ok: false,
            message: 'Invalid params: chainId required',
            rpcError: EIP5792_ERROR_CODES.INVALID_PARAMS,
        };
    }

    const chainIdNum =
        typeof body.chainId === 'string' ? parseInt(body.chainId as string, 16) : Number(body.chainId);

    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
        return {
            ok: false,
            message: 'Invalid params: chainId',
            rpcError: EIP5792_ERROR_CODES.INVALID_PARAMS,
        };
    }

    if (!getSupportedChainIds().includes(chainIdNum)) {
        return {
            ok: false,
            message: 'Unsupported chain id',
            rpcError: EIP5792_ERROR_CODES.UNSUPPORTED_CHAIN,
        };
    }

    if (chainIdNum !== activeSessionChainId) {
        return {
            ok: false,
            message: 'chainId does not match active session chain',
            rpcError: EIP5792_ERROR_CODES.INVALID_PARAMS,
        };
    }

    const atomicRequired = body.atomicRequired === true;
    if (atomicRequired && !getBatchCallsContractAddress(chainIdNum)) {
        return {
            ok: false,
            message: 'Atomic batch calls not supported on this chain',
            rpcError: EIP5792_ERROR_CODES.UNSUPPORTED_CHAIN,
        };
    }

    return { ok: true, chainIdNum };
}
