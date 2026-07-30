import {
    CURRENT_CHAINS,
    DEFAULT_CHAIN,
    getCurrentChainByChain,
    getCurrentChainByChainId,
    getCurrentChainByPlatformId,
    getCurrentChains,
    getPlatformIdByChainData,
} from '../../src/lib/ChainsUtils';

describe('ChainsUtils', () => {
    it('exports a populated CURRENT_CHAINS list', () => {
        expect(Array.isArray(CURRENT_CHAINS)).toBe(true);
        expect(CURRENT_CHAINS.length).toBeGreaterThan(0);
        expect(getCurrentChains()).toBe(CURRENT_CHAINS);
    });

    it('DEFAULT_CHAIN is included in CURRENT_CHAINS', () => {
        expect(CURRENT_CHAINS).toContain(DEFAULT_CHAIN);
    });

    it('getCurrentChainByChain returns chain when found', () => {
        const result = getCurrentChainByChain(DEFAULT_CHAIN.chain_key);
        expect(result).toBe(DEFAULT_CHAIN);
    });

    it('getCurrentChainByChain returns undefined when not found', () => {
        expect(getCurrentChainByChain('nope' as any)).toBeUndefined();
    });

    it('getCurrentChainByChainId returns chain when found', () => {
        const chain = getCurrentChainByChainId(DEFAULT_CHAIN.chain_id);
        expect(chain).toBe(DEFAULT_CHAIN);
    });

    it('getCurrentChainByChainId throws when not found', () => {
        expect(() => getCurrentChainByChainId(999999999)).toThrow(/chainId not found/);
    });

    it('getCurrentChainByPlatformId returns chain when found', () => {
        const chain = getCurrentChainByPlatformId(DEFAULT_CHAIN.platform_id);
        expect(chain).toBe(DEFAULT_CHAIN);
    });

    it('getCurrentChainByPlatformId throws when not found', () => {
        expect(() => getCurrentChainByPlatformId(999999999)).toThrow(
            /platformId not found/,
        );
    });

    it('getPlatformIdByChainData returns the chain platform id', () => {
        expect(getPlatformIdByChainData(DEFAULT_CHAIN)).toBe(DEFAULT_CHAIN.platform_id);
    });

    it('getPlatformIdByChainData falls back to DEFAULT_CHAIN when nil', () => {
        expect(getPlatformIdByChainData(undefined as any)).toBe(
            DEFAULT_CHAIN.platform_id,
        );
    });
});
