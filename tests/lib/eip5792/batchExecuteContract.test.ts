import {
    encodeExecuteBatch,
    buildExecuteBatchTx,
    estimateExecuteBatchGas,
} from '../../../src/lib/eip5792/batchExecuteContract';
import { estimateGasWithPadding } from '../../../src/lib/web3';

jest.mock('../../../src/lib/web3', () => ({
    estimateGasWithPadding: jest.fn(),
}));

jest.mock('viem', () => ({
    zeroAddress: '0x0000000000000000000000000000000000000000',
}));

describe('encodeExecuteBatch', () => {
    it('encodes a single call with empty data and value=0 default', () => {
        const { data, totalValue } = encodeExecuteBatch([{ to: '0x1111111111111111111111111111111111111111' } as any]);
        expect(data.startsWith('0x')).toBe(true);
        expect(totalValue).toBe(0n);
    });

    it('sums values across calls', () => {
        const { totalValue } = encodeExecuteBatch([
            { to: '0x1111111111111111111111111111111111111111', value: '0x1' as any },
            { to: '0x2222222222222222222222222222222222222222', value: '0x2' as any },
        ]);
        expect(totalValue).toBe(3n);
    });

    it('handles empty call list', () => {
        const { data, totalValue } = encodeExecuteBatch([]);
        expect(data.startsWith('0x')).toBe(true);
        expect(totalValue).toBe(0n);
    });
});

describe('buildExecuteBatchTx', () => {
    it('builds a TransactionRequest with to/from/data', () => {
        const tx = buildExecuteBatchTx({
            calls: [{ to: '0x1111111111111111111111111111111111111111' } as any],
            from: '0xfrom',
            executeAddress: '0xexec',
        });
        expect(tx.to).toBe('0xexec');
        expect(tx.from).toBe('0xfrom');
        expect(typeof tx.data).toBe('string');
    });
});

describe('estimateExecuteBatchGas', () => {
    beforeEach(() => {
        (estimateGasWithPadding as jest.Mock).mockReset();
    });

    it('returns the padded gas estimate', async () => {
        (estimateGasWithPadding as jest.Mock).mockResolvedValueOnce('120000');
        const result = await estimateExecuteBatchGas({} as any, {
            calls: [{ to: '0x1111111111111111111111111111111111111111' } as any],
            from: '0xfrom',
            executeAddress: '0xexec',
        });
        expect(result).toBe(120000);
    });

    it('throws when estimateGasWithPadding returns falsy', async () => {
        (estimateGasWithPadding as jest.Mock).mockResolvedValueOnce(null);
        await expect(
            estimateExecuteBatchGas({} as any, {
                calls: [{ to: '0x1111111111111111111111111111111111111111' } as any],
                from: '0xfrom',
                executeAddress: '0xexec',
            }),
        ).rejects.toThrow(/Failed to estimate/);
    });

    it('throws when gas is not finite', async () => {
        (estimateGasWithPadding as jest.Mock).mockResolvedValueOnce('not-a-number');
        await expect(
            estimateExecuteBatchGas({} as any, {
                calls: [{ to: '0x1111111111111111111111111111111111111111' } as any],
                from: '0xfrom',
                executeAddress: '0xexec',
            }),
        ).rejects.toThrow();
    });
});
