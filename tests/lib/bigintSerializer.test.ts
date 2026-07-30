import {
    serializeBigInt,
    deserializeBigInt,
} from '../../src/lib/bigintSerializer';

describe('bigintSerializer', () => {
    describe('serializeBigInt', () => {
        it('returns null/undefined unchanged', () => {
            expect(serializeBigInt(null)).toBeNull();
            expect(serializeBigInt(undefined)).toBeUndefined();
        });

        it('serializes a plain bigint', () => {
            expect(serializeBigInt(BigInt(123))).toEqual({ __bigint: '123' });
        });

        it('serializes bigint nested in objects', () => {
            const out = serializeBigInt({
                a: BigInt(1),
                b: { c: BigInt(2) },
            });
            expect(out).toEqual({ a: { __bigint: '1' }, b: { c: { __bigint: '2' } } });
        });

        it('serializes bigint nested in arrays', () => {
            const out = serializeBigInt([BigInt(1), BigInt(2)]);
            expect(out).toEqual([{ __bigint: '1' }, { __bigint: '2' }]);
        });

        it('converts typed arrays to plain number arrays', () => {
            const bytes = new Uint8Array([1, 2, 3]);
            expect(serializeBigInt(bytes)).toEqual([1, 2, 3]);
        });

        it('passes DataView through unchanged', () => {
            const dv = new DataView(new ArrayBuffer(4));
            expect(serializeBigInt(dv)).toBe(dv);
        });

        it('does not double-serialize an already-serialized marker', () => {
            const already = { __bigint: '99' };
            expect(serializeBigInt(already)).toBe(already);
        });

        it('returns primitive non-bigint values unchanged', () => {
            expect(serializeBigInt(5)).toBe(5);
            expect(serializeBigInt('s')).toBe('s');
            expect(serializeBigInt(true)).toBe(true);
        });
    });

    describe('deserializeBigInt', () => {
        it('returns null/undefined unchanged', () => {
            expect(deserializeBigInt(null)).toBeNull();
            expect(deserializeBigInt(undefined)).toBeUndefined();
        });

        it('deserializes a marker to bigint', () => {
            expect(deserializeBigInt({ __bigint: '42' })).toBe(BigInt(42));
        });

        it('deserializes markers nested in objects', () => {
            const out = deserializeBigInt({
                a: { __bigint: '1' },
                b: { c: { __bigint: '2' } },
            });
            expect(out).toEqual({ a: BigInt(1), b: { c: BigInt(2) } });
        });

        it('deserializes markers in arrays', () => {
            const out = deserializeBigInt([{ __bigint: '1' }, { __bigint: '2' }]);
            expect(out).toEqual([BigInt(1), BigInt(2)]);
        });

        it('round-trips arbitrary structures', () => {
            const original = {
                a: BigInt(1),
                b: [BigInt(2), { c: BigInt(3) }],
                d: 'x',
            };
            const round = deserializeBigInt(serializeBigInt(original));
            expect(round).toEqual(original);
        });

        it('returns primitive non-marker values unchanged', () => {
            expect(deserializeBigInt(5)).toBe(5);
        });
    });
});
