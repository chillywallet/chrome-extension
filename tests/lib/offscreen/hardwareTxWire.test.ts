import {
    hardwareTxWireFromTyped,
    typedTransactionFromHardwareSignedWire,
    typedTransactionFromHardwareWirePayload,
    typedTransactionToWireRecord,
} from '../../../src/lib/offscreen/hardwareTxWire';

const customCalls: any[] = [];
const fromTxDataCalls: any[] = [];

jest.mock('@ethereumjs/tx', () => ({
    TransactionFactory: {
        fromTxData: (tx: any, opts: any) => {
            fromTxDataCalls.push({ tx, opts });
            return {
                toJSON: () => tx,
                type: tx.__type ?? 2,
                common: opts?.common,
                __isReconstructed: true,
                ...tx,
            };
        },
    },
}));

jest.mock('@ethereumjs/common', () => ({
    Common: {
        custom: (params: any) => {
            customCalls.push(params);
            return {
                chainId: () => BigInt(params.chainId),
                hardfork: () => params.defaultHardfork,
                __params: params,
            };
        },
    },
    Hardfork: {},
}));

jest.mock('@ethereumjs/util', () => ({
    bigIntToHex: (n: bigint) => `0x${n.toString(16)}`,
}));

function buildTyped(opts: { type: number; json: Record<string, unknown>; chainId?: bigint; hardfork?: string }) {
    return {
        type: opts.type,
        toJSON: () => ({ ...opts.json }),
        common: {
            chainId: () => opts.chainId ?? BigInt(1),
            hardfork: () => opts.hardfork ?? 'london',
        },
    } as any;
}

beforeEach(() => {
    customCalls.length = 0;
    fromTxDataCalls.length = 0;
});

describe('typedTransactionToWireRecord', () => {
    it('serializes JSON with type as hex', () => {
        const tx = buildTyped({ type: 2, json: { nonce: '0x1' } });
        expect(typedTransactionToWireRecord(tx)).toEqual({ nonce: '0x1', type: '0x2' });
    });
});

describe('hardwareTxWireFromTyped', () => {
    it('captures tx, chainId, and hardfork', () => {
        const tx = buildTyped({ type: 0, json: { gasPrice: '0x1' }, chainId: BigInt(5), hardfork: 'berlin' });
        const wire = hardwareTxWireFromTyped(tx);
        expect(wire).toEqual({
            tx: { gasPrice: '0x1', type: '0x0' },
            chainId: '5',
            hardfork: 'berlin',
        });
    });
});

describe('typedTransactionFromHardwareWirePayload', () => {
    it('rebuilds a TypedTransaction (type=2 strips gasPrice)', () => {
        const result: any = typedTransactionFromHardwareWirePayload({
            tx: { type: '0x2', gasPrice: '0xabc', maxFeePerGas: '0x1' } as any,
            chainId: '137',
            hardfork: 'cancun',
        });
        expect(result.__isReconstructed).toBe(true);
        expect(result.gasPrice).toBeUndefined();
        expect(result.maxFeePerGas).toBe('0x1');
        expect(customCalls).toContainEqual(
            expect.objectContaining({ chainId: 137, defaultHardfork: 'cancun' }),
        );
    });

    it('passes type=1 envelope (with accessList) through untouched', () => {
        const tx: any = typedTransactionFromHardwareWirePayload({
            tx: { type: '0x1', gasPrice: '0xabc', accessList: [] } as any,
            chainId: '1',
            hardfork: 'london',
        });
        expect(tx.gasPrice).toBe('0xabc');
        expect(tx.accessList).toEqual([]);
    });

    it('passes type=0 envelope through', () => {
        const tx: any = typedTransactionFromHardwareWirePayload({
            tx: { type: '0x0', gasPrice: '0xabc' } as any,
            chainId: '1',
            hardfork: 'london',
        });
        expect(tx.gasPrice).toBe('0xabc');
    });

    it('promotes to type=2 when EIP-1559 fields present and type is missing', () => {
        const tx: any = typedTransactionFromHardwareWirePayload({
            tx: { maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x2' } as any,
            chainId: '1',
            hardfork: 'london',
        });
        expect(tx.type).toBe('0x2');
        expect(tx.gasPrice).toBeUndefined();
    });

    it('promotes to type=1 when accessList + gasPrice present and type missing', () => {
        const tx: any = typedTransactionFromHardwareWirePayload({
            tx: { gasPrice: '0x10', accessList: [{ a: 'b' }] } as any,
            chainId: '1',
            hardfork: 'london',
        });
        expect(tx.type).toBe('0x1');
    });

    it('treats numeric type fields directly', () => {
        const tx: any = typedTransactionFromHardwareWirePayload({
            tx: { type: 1, gasPrice: '0x10' } as any,
            chainId: '1',
            hardfork: 'london',
        });
        expect(tx.gasPrice).toBe('0x10');
    });

    it('passes through when no type and no fee fields inferrable', () => {
        const tx: any = typedTransactionFromHardwareWirePayload({
            tx: { nonce: '0x0' } as any,
            chainId: '1',
            hardfork: 'london',
        });
        expect(tx.nonce).toBe('0x0');
        const lastCall = fromTxDataCalls[fromTxDataCalls.length - 1];
        expect(lastCall.tx).toEqual({ nonce: '0x0' });
    });

    it('ignores null type as missing', () => {
        const tx: any = typedTransactionFromHardwareWirePayload({
            tx: { type: null, maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x2' } as any,
            chainId: '1',
            hardfork: 'london',
        });
        expect(tx.type).toBe('0x2');
    });

    it('ignores empty-string type', () => {
        typedTransactionFromHardwareWirePayload({
            tx: { type: '', nonce: '0x0' } as any,
            chainId: '1',
            hardfork: 'london',
        });
        const lastCall = fromTxDataCalls[fromTxDataCalls.length - 1];
        expect(lastCall.tx).toEqual({ type: '', nonce: '0x0' });
    });
});

describe('typedTransactionFromHardwareSignedWire', () => {
    it('returns the signed payload directly if it has a serialize() function', () => {
        const unsigned = buildTyped({ type: 2, json: {} });
        const signed = { serialize: () => Buffer.from('') } as any;
        expect(typedTransactionFromHardwareSignedWire(unsigned, signed)).toBe(signed);
    });

    it('rehydrates via wire payload when given plain JSON', () => {
        const unsigned = buildTyped({ type: 2, json: {}, chainId: BigInt(42), hardfork: 'shanghai' });
        const signed = { type: '0x2', maxFeePerGas: '0x1' } as any;
        const rehydrated: any = typedTransactionFromHardwareSignedWire(unsigned, signed);
        expect(rehydrated.__isReconstructed).toBe(true);
        expect(customCalls).toContainEqual(
            expect.objectContaining({ chainId: 42, defaultHardfork: 'shanghai' }),
        );
    });
});
