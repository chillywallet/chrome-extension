import { getErrorMessage } from '../../src/api/graphQL/BaseRequest';
import ErrorMessages from '../../src/shared/messages/ErrorMessages';

jest.mock('../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn(), showError: jest.fn() },
}));

describe('getErrorMessage', () => {
    it('returns reason when present', () => {
        expect(getErrorMessage({ reason: 'gas too low' })).toBe('gas too low');
    });

    it('maps INSUFFICIENT_FUNDS', () => {
        expect(getErrorMessage({ code: 'INSUFFICIENT_FUNDS' })).toBe(
            ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS,
        );
    });

    it('returns nested response.data.message', () => {
        expect(
            getErrorMessage({ response: { data: { message: 'server error' } } }),
        ).toBe('server error');
    });

    it('returns nested error.message', () => {
        expect(getErrorMessage({ error: { message: 'inner err' } })).toBe('inner err');
    });

    it('returns shortMessage', () => {
        expect(getErrorMessage({ shortMessage: 'oops' })).toBe('oops');
    });

    it('rewrites Context creation failed', () => {
        const out = getErrorMessage(new Error('Context creation failed somewhere'));
        expect(out).toMatch(/high usage/);
    });

    it('rewrites HTTP request failed', () => {
        const out = getErrorMessage(new Error('HTTP request failed'));
        expect(out).toMatch(/offline/);
    });

    it('strips execution reverted prefix', () => {
        const out = getErrorMessage(new Error('execution reverted: revert reason'));
        expect(out).toBe('revert reason');
    });

    it('maps INSUFFICIENT_AMOUNT to known message', () => {
        const out = getErrorMessage({ message: 'INSUFFICIENT_AMOUNT: TOKEN' });
        expect(out).toBe(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT);
    });

    it('returns "" for Network error: Failed to fetch', () => {
        const out = getErrorMessage({ message: 'Network error: Failed to fetch' });
        expect(out).toBe('');
    });

    it('falls back to stringified input when no message', () => {
        expect(getErrorMessage({})).toBe('{}');
    });

    it('returns "Unknown Error" when no extracted message and no input', () => {
        // undefined → JSON.stringify(undefined) === undefined → falls through to "Unknown Error"
        expect(getErrorMessage(undefined)).toBe('Unknown Error');
    });

});
