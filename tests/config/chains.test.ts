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

/**
 * Registry-wide invariants. Most entries are now produced from a table rather
 * than written out by hand, so these guard the expansion as much as the data.
 */
describe('CHAINS registry', () => {
    it('keys every chain uniquely by id and by chain_key', () => {
        const ids = CHAINS.map(chain => chain.chain_id);
        const keys = CHAINS.map(chain => chain.chain_key);

        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('keeps platform_id unified with chain_id', () => {
        CHAINS.forEach(chain => {
            expect(chain.platform_id).toBe(chain.chain_id);
        });
    });

    it('dials the first entry of rpcUrls, over https', () => {
        CHAINS.forEach(chain => {
            expect(chain.rpcUrls.length).toBeGreaterThan(0);
            expect(chain.rpcUrl).toBe(chain.rpcUrls[0]);
            chain.rpcUrls.forEach(url => expect(url).toMatch(/^https:\/\//));
        });
    });

    it('matches the bundled viem chain to the configured id', () => {
        CHAINS.forEach(chain => {
            expect(chain.viemChain?.id).toBe(chain.chain_id);
        });
    });

    it('agrees between swapSupport and the configured swap provider', () => {
        CHAINS.forEach(chain => {
            expect(chain.swapSupport).toBe(chain.swapProvider.kind !== 'none');

            if (chain.swapSupport) {
                expect(chain.swapProvider.providerChainSlug).toBeTruthy();
            }
        });
    });

    it('gives every DefiLlama-priced chain a slug to key tokens by', () => {
        CHAINS.filter(chain => chain.priceProvider.kind === 'defillama').forEach(chain => {
            expect(chain.priceProvider.llamaSlug).toBeTruthy();
        });
    });

    it('only asks for an API key where the provider actually needs one', () => {
        CHAINS.forEach(chain => {
            const { kind, apiKeyRef, baseUrl } = chain.dataProvider;

            if (kind === 'blockscout') {
                expect(apiKeyRef).toBeUndefined();
            }

            if (kind === 'etherscan' && baseUrl.includes('api.etherscan.io')) {
                expect(apiKeyRef).toBe('etherscan');
            }
        });
    });

    it('gives every chain an icon', () => {
        CHAINS.forEach(chain => {
            expect(chain.icon).toBeTruthy();
        });
    });
});
