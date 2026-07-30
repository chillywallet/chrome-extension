import { getErrorMessage, showErrorMessage } from '../../../src/api/graphQL/BaseRequest';
import ErrorMessages from '../../../src/shared/messages/ErrorMessages';
import Toast from '../../../src/ui/components/Toast';

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showError: jest.fn(), showSuccess: jest.fn() },
}));

beforeEach(() => {
    jest.clearAllMocks();
});

describe('getErrorMessage', () => {
    it('returns insufficient funds for INSUFFICIENT_FUNDS code', () => {
        expect(getErrorMessage({ code: 'INSUFFICIENT_FUNDS' })).toBe(
            ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS,
        );
    });

    it('prefers reason if present', () => {
        expect(getErrorMessage({ reason: 'nonce too low', message: 'other' })).toBe(
            'nonce too low',
        );
    });

    it('reads from response.data.message', () => {
        expect(getErrorMessage({ response: { data: { message: 'server said no' } } })).toBe(
            'server said no',
        );
    });

    it('reads from error.message', () => {
        expect(getErrorMessage({ error: { message: 'inner error' } })).toBe('inner error');
    });

    it('reads from shortMessage', () => {
        expect(getErrorMessage({ shortMessage: 'short err' })).toBe('short err');
    });

    it('joins response.data.errors with newlines', () => {
        const out = getErrorMessage({
            response: { data: { errors: [{ message: 'x' }, { message: 'y' }] } },
        });
        expect(out).toBe('x\ny');
    });

    it('rewrites Context creation failed', () => {
        const out = getErrorMessage({ message: 'Context creation failed: boom' });
        expect(out).toContain('extremely high usage');
    });

    it('rewrites HTTP request failed', () => {
        const out = getErrorMessage({ message: 'HTTP request failed with 500' });
        expect(out).toContain("Seems like you're offline");
    });

    it('strips execution reverted prefix', () => {
        expect(getErrorMessage({ message: 'execution reverted: bad input' })).toBe('bad input');
    });

    it('maps Invalid amount: TOKEN', () => {
        expect(getErrorMessage({ message: 'Invalid amount: TOKEN' })).toBe(
            ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT,
        );
    });

    it('maps INSUFFICIENT_AMOUNT: TOKEN', () => {
        expect(getErrorMessage({ message: 'INSUFFICIENT_AMOUNT: TOKEN' })).toBe(
            ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT,
        );
    });

    it('returns empty for Network error: Failed to fetch', () => {
        expect(getErrorMessage({ message: 'Network error: Failed to fetch' })).toBe('');
    });

    it('falls back to JSON.stringify of the error', () => {
        expect(getErrorMessage({ foo: 'bar' })).toBe(JSON.stringify({ foo: 'bar' }));
    });

    it('returns Unknown Error when the input has no usable fields', () => {
        expect(getErrorMessage(undefined)).toBe('Unknown Error');
    });
});

describe('showErrorMessage', () => {
    it('shows a toast for a non-empty error', () => {
        showErrorMessage({ message: 'oops' });
        expect((Toast as any).showError).toHaveBeenCalledWith('oops');
    });

    it('does nothing when error resolves to empty', () => {
        showErrorMessage({ message: 'Network error: Failed to fetch' });
        expect((Toast as any).showError).not.toHaveBeenCalled();
    });
});
