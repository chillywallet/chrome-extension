import { AUTOMATION_ERRORS } from '../../../src/shared/utils/error-messages';

describe('AUTOMATION_ERRORS', () => {
    it('exposes well-known error codes', () => {
        expect(AUTOMATION_ERRORS.BALANCE_TOO_LOW).toBe('Insufficient funds');
        expect(AUTOMATION_ERRORS.CAN_NOT_PAY_FEES).toBe('Insufficient funds');
        expect(AUTOMATION_ERRORS.SWAP_FAILED).toBe('Swap failed');
        expect(AUTOMATION_ERRORS.APPROVE_FAILED).toBe('Approval failed');
        expect(AUTOMATION_ERRORS.SLIPPAGE_EXCEED).toBe('Slippage Exceeded');
    });

    it('returns undefined for unknown codes', () => {
        expect(AUTOMATION_ERRORS.NOPE).toBeUndefined();
    });
});
