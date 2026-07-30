import {
    buildEip5792CapabilitiesForChain,
    getBatchCallsContractAddress,
    getSupportedChainIds,
    isCapabilitiesAddressAuthorized,
    parseWalletGetCapabilitiesParams,
} from '../../../src/lib/eip5792/capabilities';

describe('capabilities', () => {
    it('getSupportedChainIds returns chain ids', () => {
        const ids = getSupportedChainIds();
        expect(ids.length).toBeGreaterThan(0);
        ids.forEach(id => expect(typeof id).toBe('number'));
    });

    it('getBatchCallsContractAddress', () => {
        expect(getBatchCallsContractAddress(143)).toMatch(/^0x/);
        expect(getBatchCallsContractAddress(999999)).toBeUndefined();
    });

    it('buildEip5792CapabilitiesForChain returns supported atomic', () => {
        const caps = buildEip5792CapabilitiesForChain(143) as any;
        expect(caps.atomic.status).toBe('supported');
        expect(caps.sendCalls.supported).toBe(true);
    });

    it('buildEip5792CapabilitiesForChain returns unsupported atomic when no batch contract', () => {
        const ids = getSupportedChainIds().filter(id => !getBatchCallsContractAddress(id));
        if (ids.length) {
            const caps = buildEip5792CapabilitiesForChain(ids[0]) as any;
            expect(caps.atomic.status).toBe('unsupported');
        }
    });

    it('buildEip5792CapabilitiesForChain returns null for unsupported chain', () => {
        expect(buildEip5792CapabilitiesForChain(999999)).toBeNull();
    });

    it('parseWalletGetCapabilitiesParams rejects non-array', () => {
        expect(parseWalletGetCapabilitiesParams(null).ok).toBe(false);
        expect(parseWalletGetCapabilitiesParams([]).ok).toBe(false);
    });

    it('parseWalletGetCapabilitiesParams rejects bad address', () => {
        expect(parseWalletGetCapabilitiesParams(['not-an-address']).ok).toBe(false);
    });

    it('parseWalletGetCapabilitiesParams accepts a valid address and chains', () => {
        const result = parseWalletGetCapabilitiesParams([
            '0x32Be343B94f860124dC4fEe278FDCBD38C102D88',
            ['0x1', '0x89'],
        ]);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.address).toMatch(/^0x/);
            expect(result.chainIdsHex.length).toBe(2);
        }
    });

    it('parseWalletGetCapabilitiesParams handles empty rawAddr', () => {
        const result = parseWalletGetCapabilitiesParams([null, []]);
        expect(result.ok).toBe(true);
    });

    it('isCapabilitiesAddressAuthorized', () => {
        expect(isCapabilitiesAddressAuthorized(undefined, ['0xabc'])).toBe(true);
        expect(
            isCapabilitiesAddressAuthorized('0xABC' as `0x${string}`, ['0xabc']),
        ).toBe(true);
        expect(
            isCapabilitiesAddressAuthorized('0xdef' as `0x${string}`, ['0xabc']),
        ).toBe(false);
    });
});
