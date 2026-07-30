import {
    getTokenIdParam,
    getTokenAddressParam,
    getTokenValueParam,
    calcTokenAmount,
    getTxValue,
    getAssetDetails,
    getNativeAssetDetails,
} from '../../../src/shared/utils/token-utils';
import { getTokenBalance } from '../../../src/store/actions/uiActions';
import { parseStandardTokenTransactionData } from '../../../src/lib/transactions/utils';
import { TransactionType } from '../../../src/shared/types/Transaction';

jest.mock('../../../src/store/actions/uiActions', () => ({
    getTokenBalance: jest.fn(),
}));

jest.mock('../../../src/lib/transactions/utils', () => ({
    parseStandardTokenTransactionData: jest.fn(),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('token-utils', () => {
    describe('getTokenIdParam', () => {
        it('returns _tokenId when present', () => {
            expect(getTokenIdParam({ args: { _tokenId: 42 } } as any)).toBe('42');
        });

        it('falls back to id', () => {
            expect(getTokenIdParam({ args: { id: 100 } } as any)).toBe('100');
        });

        it('returns undefined when neither is present', () => {
            expect(getTokenIdParam({ args: {} } as any)).toBeUndefined();
        });
    });

    describe('getTokenAddressParam', () => {
        it('returns _to lowercased', () => {
            expect(getTokenAddressParam({ args: { _to: '0xABCD' } } as any)).toBe('0xabcd');
        });
        it('falls back to to', () => {
            expect(getTokenAddressParam({ args: { to: '0xDEEF' } } as any)).toBe('0xdeef');
        });
        it('falls back to first positional arg', () => {
            expect(getTokenAddressParam({ args: ['0xAAAA'] } as any)).toBe('0xaaaa');
        });
        it('returns undefined when args are missing', () => {
            expect(getTokenAddressParam({ args: undefined } as any)).toBeUndefined();
        });
        it('returns undefined when args is empty object', () => {
            expect(getTokenAddressParam({ args: {} } as any)).toBeUndefined();
        });
    });

    describe('getTokenValueParam', () => {
        it('returns _value as a string', () => {
            expect(getTokenValueParam({ name: 'approve', args: { _value: 100 } } as any)).toBe('100');
        });

        it('returns increment for tokenMethodIncreaseAllowance', () => {
            expect(
                getTokenValueParam({
                    name: TransactionType.tokenMethodIncreaseAllowance,
                    args: { increment: 50 },
                } as any),
            ).toBe('50');
        });

        it('returns undefined when args missing for non-allowance', () => {
            expect(getTokenValueParam({ name: 'approve', args: undefined } as any)).toBeUndefined();
        });

        it('returns undefined when increment missing for allowance', () => {
            expect(
                getTokenValueParam({
                    name: TransactionType.tokenMethodIncreaseAllowance,
                    args: {},
                } as any),
            ).toBeUndefined();
        });
    });

    describe('calcTokenAmount', () => {
        it('divides by 10^decimals', () => {
            expect(calcTokenAmount('1000', 3).toString()).toBe('1');
        });
        it('handles decimals=0', () => {
            expect(calcTokenAmount('5', 0).toString()).toBe('5');
        });
    });

    describe('getTxValue', () => {
        it('returns 0 when no data', () => {
            expect(getTxValue({ data: undefined })).toBe('0');
        });
        it('parses ETH transfer with 0x data', () => {
            const result = getTxValue({ data: '0x', value: '0xde0b6b3a7640000' });
            expect(typeof result).toBe('string');
        });

        it('parses token transfer data payload', () => {
            // tokenTransferHash + 64-char address pad + 64-char amount pad
            // amount = 0x...64 = 100 (decimal)
            const addrPad = '0'.repeat(64);
            const amountHex = '64'.padStart(64, '0');
            const data = `0xa9059cbb${addrPad}${amountHex}`;
            const result = getTxValue({ data });
            expect(typeof result).toBe('string');
            // 100 / 1e18 - extremely small but a valid decimal string
            expect(result).toContain('1');
        });

        it('returns 0 when data exists but value is missing (non-transfer)', () => {
            // data starts with neither 0x nor token transfer hash, and value undefined
            const result = getTxValue({ data: '0xdeadbeef', value: undefined });
            expect(result).toBe('0');
        });

        it('parses ETH-style tx when data is non-empty and not a token transfer', () => {
            const result = getTxValue({ data: '0xdeadbeef', value: '0xde0b6b3a7640000' });
            expect(typeof result).toBe('string');
        });
    });

    describe('getAssetDetails', () => {
        it('throws when transactionData cannot be parsed', async () => {
            (parseStandardTokenTransactionData as jest.Mock).mockReturnValue(undefined);
            await expect(getAssetDetails('0xT', '0xU', '0xff')).rejects.toThrow(/valid token data/);
        });

        it('returns toAddress when balance lookup fails', async () => {
            (parseStandardTokenTransactionData as jest.Mock).mockReturnValue({
                args: { _to: '0xRECIPIENT', _value: '1' },
            });
            (getTokenBalance as jest.Mock).mockRejectedValueOnce(new Error('no balance'));
            const result = await getAssetDetails('0xT', '0xU', '0xff');
            expect(result.toAddress).toBe('0xrecipient');
        });

        it('returns full detail on success with decimals + balance', async () => {
            (parseStandardTokenTransactionData as jest.Mock).mockReturnValue({
                args: { _to: '0xRECIPIENT', _value: '1000000' },
            });
            (getTokenBalance as jest.Mock).mockResolvedValueOnce({
                decimals: 6,
                balance: '5000000',
                error: false,
            });
            const result = await getAssetDetails('0xT', '0xU', '0xff');
            expect(result.toAddress).toBe('0xrecipient');
            expect(result.decimals).toBe(6);
            expect(result.balance).toBe('5.0');
            // 1000000 / 10^6 = 1
            expect(result.tokenAmount?.toString()).toBe('1');
        });

        it('handles tokenBalance with error true (decimals undefined)', async () => {
            (parseStandardTokenTransactionData as jest.Mock).mockReturnValue({
                args: { _to: '0xRECIPIENT', _value: '1000000' },
            });
            (getTokenBalance as jest.Mock).mockResolvedValueOnce({
                decimals: 6,
                balance: '5000000',
                error: true,
            });
            const result = await getAssetDetails('0xT', '0xU', '0xff');
            expect(result.decimals).toBeUndefined();
            // tokenAmount becomes falsy when decimals undefined
            expect(result.tokenAmount).toBeFalsy();
        });
    });

    describe('getNativeAssetDetails', () => {
        it('returns toAddress when balance lookup fails', async () => {
            (getTokenBalance as jest.Mock).mockRejectedValueOnce(new Error('no'));
            const result = await getNativeAssetDetails('0xT', '0xR', '100', '0xU');
            expect(result.toAddress).toBe('0xR');
        });

        it('returns native asset detail on success', async () => {
            (getTokenBalance as jest.Mock).mockResolvedValueOnce({
                decimals: 18,
                balance: '1000000000000000000',
                error: false,
            });
            const result = await getNativeAssetDetails(
                '0xT',
                '0xR',
                '1000000000000000000',
                '0xU',
            );
            expect(result.toAddress).toBe('0xR');
            expect(result.decimals).toBe(18);
            expect(result.balance).toBe('1.0');
            expect(result.tokenAmount?.toString()).toBe('1');
        });

        it('returns undefined tokenAmount when tokenValue is empty', async () => {
            (getTokenBalance as jest.Mock).mockResolvedValueOnce({
                decimals: 18,
                balance: '1000000000000000000',
                error: false,
            });
            const result = await getNativeAssetDetails('0xT', '0xR', '', '0xU');
            expect(result.tokenAmount).toBeUndefined();
        });

        it('returns undefined tokenAmount when decimals missing', async () => {
            (getTokenBalance as jest.Mock).mockResolvedValueOnce({
                decimals: 18,
                balance: '1000000000000000000',
                error: true,
            });
            const result = await getNativeAssetDetails('0xT', '0xR', '100', '0xU');
            expect(result.tokenAmount).toBeUndefined();
            expect(result.decimals).toBeUndefined();
        });
    });
});
