import {
    CallBatchStatusCode,
    EIP5792_APPROVAL_TYPES,
    EIP5792_ERROR_CODES,
    EIP5792_METHODS,
} from '../../../src/lib/eip5792/types';

describe('eip5792 types', () => {
    it('exposes wallet RPC method names', () => {
        expect(EIP5792_METHODS.WALLET_GET_CAPABILITIES).toBe('wallet_getCapabilities');
        expect(EIP5792_METHODS.WALLET_SEND_CALLS).toBe('wallet_sendCalls');
    });

    it('exposes approval types and error codes', () => {
        expect(EIP5792_APPROVAL_TYPES.SEND_CALLS).toBe('wallet_sendCalls');
        expect(EIP5792_ERROR_CODES.USER_REJECTED.code).toBe(4001);
        expect(EIP5792_ERROR_CODES.UNAUTHORIZED.code).toBe(4100);
    });

    it('exposes CallBatchStatusCode enum values', () => {
        expect(CallBatchStatusCode.Pending).toBe(100);
        expect(CallBatchStatusCode.Confirmed).toBe(200);
        expect(CallBatchStatusCode.OffchainFailure).toBe(400);
    });
});
