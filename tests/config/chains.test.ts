import { CHAINS, getDataProviderPresets } from '../../src/config/chains';

describe('getDataProviderPresets', () => {
    it('returns an empty list for an unknown chain', () => {
        expect(getDataProviderPresets(1234567)).toEqual([]);
    });

    it('lists the committed default first and marks it', () => {
        CHAINS.forEach(chain => {
            const presets = getDataProviderPresets(chain.chain_id);

            expect(presets.length).toBeGreaterThan(0);
            expect(presets[0].isDefault).toBe(true);
            expect(presets[0].kind).toBe(chain.dataProvider.kind);
            expect(presets[0].baseUrl).toBe(chain.dataProvider.baseUrl);
            expect(presets.filter(preset => preset.isDefault)).toHaveLength(1);
        });
    });

    it('offers unique options ending with "none" for every chain', () => {
        CHAINS.forEach(chain => {
            const presets = getDataProviderPresets(chain.chain_id);
            const ids = presets.map(preset => preset.id);

            expect(new Set(ids).size).toBe(ids.length);
            expect(presets[presets.length - 1].kind).toBe('none');
        });
    });

    it('always offers Etherscan V2 exactly once, since every chain here is in its chain list', () => {
        CHAINS.forEach(chain => {
            const presets = getDataProviderPresets(chain.chain_id);
            const etherscanV2 = presets.filter(
                preset => preset.baseUrl === 'https://api.etherscan.io/v2/api',
            );

            expect(etherscanV2).toHaveLength(1);
            expect(etherscanV2[0].apiKeyRef).toBe('etherscan');
        });
    });

    it('defaults Monad to Etherscan V2 and offers BlockVision as an alternative', () => {
        [143, 10143].forEach(chainId => {
            const presets = getDataProviderPresets(chainId);

            expect(presets[0]).toMatchObject({
                kind: 'etherscan',
                apiKeyRef: 'etherscan',
                isDefault: true,
            });

            const blockvision = presets.find(preset => preset.kind === 'blockvision');
            expect(blockvision).toBeDefined();
            expect(blockvision?.apiKeyRef).toBe('blockvision');
            expect(blockvision?.isDefault).toBeFalsy();
        });
    });

    it('does not offer BlockVision on non-Monad chains', () => {
        CHAINS.filter(chain => ![143, 10143].includes(chain.chain_id)).forEach(chain => {
            const presets = getDataProviderPresets(chain.chain_id);
            expect(presets.some(preset => preset.kind === 'blockvision')).toBe(false);
        });
    });

    it('keeps Routescan as the keyless Avalanche default rather than relabelling it', () => {
        const presets = getDataProviderPresets(43114);

        expect(presets[0].label).toBe('Routescan');
        expect(presets[0].apiKeyRef).toBeUndefined();
    });
});
