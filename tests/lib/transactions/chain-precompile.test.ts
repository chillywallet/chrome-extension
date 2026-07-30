import {
    ZERO_CODE_VALUES,
    isKnownPrecompileOrSystemAddress,
} from '../../../src/lib/transactions/chain-precompile';

describe('chain-precompile', () => {
    it('exports the set of zero-code values', () => {
        expect(ZERO_CODE_VALUES.has('0x')).toBe(true);
        expect(ZERO_CODE_VALUES.has('0x0')).toBe(true);
        expect(ZERO_CODE_VALUES.has('0xabc')).toBe(false);
    });

    it('detects an Ethereum precompile on chain 1', () => {
        expect(
            isKnownPrecompileOrSystemAddress(
                1,
                '0x0000000000000000000000000000000000000001',
            ),
        ).toBe(true);
    });

    it('returns false for unknown chain/address', () => {
        expect(
            isKnownPrecompileOrSystemAddress(99999, '0x32Be343B94f860124dC4fEe278FDCBD38C102D88'),
        ).toBe(false);
    });

    it('detects an OP Stack predeploy on Base (8453)', () => {
        expect(
            isKnownPrecompileOrSystemAddress(
                8453,
                '0x4200000000000000000000000000000000000006',
            ),
        ).toBe(true);
    });

    it('normalizes address case', () => {
        expect(
            isKnownPrecompileOrSystemAddress(
                1,
                '0x0000000000000000000000000000000000000001'.toUpperCase(),
            ),
        ).toBe(true);
    });

    it('falls back to common EVM chains', () => {
        // Polygon (137) uses ETHEREUM_PRECOMPILES; this address is precompile 0x09
        expect(
            isKnownPrecompileOrSystemAddress(
                137,
                '0x0000000000000000000000000000000000000009',
            ),
        ).toBe(true);
    });
});
