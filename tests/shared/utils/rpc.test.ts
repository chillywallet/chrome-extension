import { getRpcUrlByNetwork } from '../../../src/shared/utils/rpc';

const baseNetwork = (overrides: Partial<any> = {}) => ({
    chain_id: 1,
    rpcUrl: 'https://default.example',
    ...overrides,
});

describe('getRpcUrlByNetwork', () => {
    it('returns empty string when network is undefined', () => {
        expect(getRpcUrlByNetwork(undefined as any)).toBe('');
    });

    it('returns default rpcUrl when no overrides', () => {
        expect(getRpcUrlByNetwork(baseNetwork() as any)).toBe('https://default.example');
    });

    it('prefers user custom over remote and default', () => {
        const result = getRpcUrlByNetwork(baseNetwork() as any, {
            rpcUrls: { '1': 'https://remote.example' },
            customNetworks: [{ chain_id: 1, rpcUrl: ' https://user.example ' }],
        });
        expect(result).toBe('https://user.example');
    });

    it('uses remote when no user override', () => {
        const result = getRpcUrlByNetwork(baseNetwork() as any, {
            rpcUrls: { '1': 'https://remote.example' },
        });
        expect(result).toBe('https://remote.example');
    });

    it('skipUserRpcUrl ignores user override', () => {
        const result = getRpcUrlByNetwork(baseNetwork() as any, {
            rpcUrls: { '1': 'https://remote.example' },
            customNetworks: [{ chain_id: 1, rpcUrl: 'https://user.example' }],
            skipUserRpcUrl: true,
        });
        expect(result).toBe('https://remote.example');
    });

    it('ignores customNetworks for other chain ids', () => {
        const result = getRpcUrlByNetwork(baseNetwork() as any, {
            customNetworks: [{ chain_id: 2, rpcUrl: 'https://other.example' }],
        });
        expect(result).toBe('https://default.example');
    });

    it('falls back to empty string when no urls at all', () => {
        const result = getRpcUrlByNetwork({ chain_id: 1 } as any);
        expect(result).toBe('');
    });
});
