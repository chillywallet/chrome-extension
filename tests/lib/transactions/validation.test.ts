import { validateTransactionOrigin, validateTxParams } from '../../../src/lib/transactions/validation';
import { ORIGIN_CHILLY } from '../../../src/shared/constants/app';
import { TransactionEnvelopeType } from '../../../src/shared/types/Transaction';

const VALID = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';
const VALID2 = '0xeFA1ec40d0c7c81FfFA51AdC4e72cF8b85bdD6cf';

describe('validateTransactionOrigin', () => {
    it('passes for Chilly origin when from matches a selected address', async () => {
        await expect(
            validateTransactionOrigin([], [VALID], VALID, ORIGIN_CHILLY),
        ).resolves.toBeUndefined();
    });

    it('throws for Chilly origin when from is not selected', async () => {
        await expect(
            validateTransactionOrigin([], [VALID2], VALID, ORIGIN_CHILLY),
        ).rejects.toThrow(/invalid account/i);
    });

    it('passes for dapp origin when from is permitted', async () => {
        await expect(
            validateTransactionOrigin([VALID], [], VALID, 'https://dapp.example'),
        ).resolves.toBeUndefined();
    });

    it('throws when dapp origin is not permitted', async () => {
        await expect(
            validateTransactionOrigin([VALID2], [], VALID, 'https://dapp.example'),
        ).rejects.toThrow();
    });
});

describe('validateTxParams', () => {
    it('accepts minimal valid params', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                value: '0x0',
            } as any),
        ).not.toThrow();
    });

    it('rejects invalid from', () => {
        expect(() => validateTxParams({ from: 'not-hex' } as any)).toThrow();
        expect(() => validateTxParams({ from: '' } as any)).toThrow();
    });

    it('rejects invalid to', () => {
        expect(() =>
            validateTxParams({ from: VALID, to: 'not-hex' } as any),
        ).toThrow();
    });

    it('allows omitted to when data is present', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: '0x',
                data: '0x1234',
                value: '0x0',
            } as any),
        ).not.toThrow();
    });

    it('rejects negative value', () => {
        expect(() =>
            validateTxParams({ from: VALID, to: VALID2, value: '-1' } as any),
        ).toThrow();
    });

    it('rejects decimal value', () => {
        expect(() =>
            validateTxParams({ from: VALID, to: VALID2, value: '1.5' } as any),
        ).toThrow();
    });

    it('rejects invalid chainId type', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                value: '0x0',
                chainId: { weird: true },
            } as any),
        ).toThrow();
    });

    it('rejects gasPrice mixed with maxFeePerGas', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                gasPrice: '0x1',
                maxFeePerGas: '0x1',
            } as any),
        ).toThrow();
    });

    it('rejects gasPrice when type is feeMarket', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                gasPrice: '0x1',
                type: TransactionEnvelopeType.feeMarket,
            } as any),
        ).toThrow();
    });

    it('rejects non-string gas fields', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                maxFeePerGas: 5 as any,
                maxPriorityFeePerGas: '0x1',
            } as any),
        ).toThrow();
    });

    it('rejects non-numeric value strings', () => {
        expect(() =>
            validateTxParams({ from: VALID, to: VALID2, value: 'abc' } as any),
        ).toThrow(/must be a valid number/);
    });

    it('rejects to of "0x" when data is missing', () => {
        expect(() =>
            validateTxParams({ from: VALID, to: '0x' } as any),
        ).toThrow(/Invalid "to" address/);
    });

    it('rejects when to is omitted and data is missing', () => {
        expect(() => validateTxParams({ from: VALID } as any)).toThrow(
            /Invalid "to" address/,
        );
    });

    it('rejects data that triggers BUFFER_OVERRUN', () => {
        // ERC20 transfer signature with truncated args to trigger BUFFER_OVERRUN
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                value: '0x0',
                data: '0xa9059cbb00',
            } as any),
        ).toThrow(/BUFFER_OVERRUN/);
    });

    it('silently ignores non-ERC20 data without throwing', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                value: '0x0',
                data: '0xdeadbeef',
            } as any),
        ).not.toThrow();
    });

    it('rejects gasPrice mixed with maxPriorityFeePerGas', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                gasPrice: '0x1',
                maxPriorityFeePerGas: '0x1',
            } as any),
        ).toThrow(/cannot be mixed/);
    });

    it('rejects non-string gasPrice', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                gasPrice: 5 as any,
            } as any),
        ).toThrow(/gasPrice is not a string/);
    });

    it('rejects maxPriorityFeePerGas when type is non-feeMarket', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                maxPriorityFeePerGas: '0x1',
                type: TransactionEnvelopeType.accessList,
            } as any),
        ).toThrow(/maxFeePerGas and maxPriorityFeePerGas/);
    });

    it('rejects maxPriorityFeePerGas mixed with gasPrice', () => {
        // gasPrice is checked first, so to exercise the maxPriorityFeePerGas mutual
        // exclusion check we provide maxPriorityFeePerGas without gasPrice and supply
        // a non-string gasPrice via Object.defineProperty so the gasPrice "if" guard fails.
        const tx: any = {
            from: VALID,
            to: VALID2,
            maxPriorityFeePerGas: '0x1',
            gasPrice: 0,
        };
        expect(() => validateTxParams(tx)).toThrow(/cannot be mixed/);
    });

    it('rejects non-string maxPriorityFeePerGas', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                maxPriorityFeePerGas: 5 as any,
            } as any),
        ).toThrow(/maxPriorityFeePerGas is not a string/);
    });

    it('accepts valid string gasPrice without throwing', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                value: '0x0',
                gasPrice: '0x1',
            } as any),
        ).not.toThrow();
    });

    it('accepts valid EIP-1559 fee params', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                value: '0x0',
                maxFeePerGas: '0x1',
                maxPriorityFeePerGas: '0x1',
                type: TransactionEnvelopeType.feeMarket,
            } as any),
        ).not.toThrow();
    });

    it('accepts chainId as a number', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                value: '0x0',
                chainId: 1,
            } as any),
        ).not.toThrow();
    });

    it('accepts chainId as a hex string', () => {
        expect(() =>
            validateTxParams({
                from: VALID,
                to: VALID2,
                value: '0x0',
                chainId: '0x1',
            } as any),
        ).not.toThrow();
    });
});
