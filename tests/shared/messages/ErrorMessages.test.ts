import ErrorMessages from '../../../src/shared/messages/ErrorMessages';

describe('ErrorMessages', () => {
    it('exposes expected error keys', () => {
        expect(ErrorMessages.WC_NO_URI).toBeDefined();
        expect(ErrorMessages.NO_WALLET).toBeDefined();
        expect(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS).toBeDefined();
        expect(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT).toBeDefined();
        expect(ErrorMessages.SWAP_SAME_COIN).toBe('You can not swap the same coin.');
    });
});
