// @ts-ignore — JS file, no types
import { sanitizeMessage, stripOneLayerofNesting } from '../../src/lib/helper';

describe('helper', () => {
    describe('stripOneLayerofNesting', () => {
        it('strips a trailing [N]', () => {
            expect(stripOneLayerofNesting('uint256[3]')).toBe('uint256');
            expect(stripOneLayerofNesting('uint256[][]')).toBe('uint256[]');
        });
    });

    describe('sanitizeMessage', () => {
        it('throws when types is missing', () => {
            expect(() => sanitizeMessage({}, 'A', undefined as any)).toThrow(
                /Invalid types definition/,
            );
        });

        it('sanitizes a basic Solidity type', () => {
            const result = sanitizeMessage('hello', 'string', {});
            expect(result).toEqual({ value: 'hello', type: 'string' });
        });

        it('sanitizes an array type', () => {
            const result = sanitizeMessage(['a', 'b'], 'string[]', {});
            expect(result.type).toBe('string[]');
            expect(result.value).toEqual([
                { value: 'a', type: 'string' },
                { value: 'b', type: 'string' },
            ]);
        });

        it('sanitizes a struct', () => {
            const types = {
                Person: [
                    { name: 'name', type: 'string' },
                    { name: 'age', type: 'uint256' },
                ],
            };
            const result = sanitizeMessage(
                { name: 'Alice', age: 30, extra: 'ignored' },
                'Person',
                types,
            );
            expect(result.type).toBe('Person');
            expect((result.value as any).name).toEqual({ value: 'Alice', type: 'string' });
            expect((result.value as any).age).toEqual({ value: 30, type: 'uint256' });
            // unknown field is omitted
            expect((result.value as any).extra).toBeUndefined();
        });

        it('throws when primary type is unknown', () => {
            expect(() => sanitizeMessage({}, 'Unknown', {})).toThrow(
                /Invalid primary type definition/,
            );
        });
    });
});
