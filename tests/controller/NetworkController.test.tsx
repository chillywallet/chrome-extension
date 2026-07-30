import NetworkController from '../../src/controller/NetworkController';

jest.mock('ethers', () => {
    function JsonRpcProvider(this: any, url: string, chainId: number) {
        this.url = url;
        this.chain_id = chainId;
    }
    JsonRpcProvider.prototype._getConnection = function () {
        return { url: this.url };
    };
    return { JsonRpcProvider };
});

jest.mock('../../src/lib/ChainsUtils', () => ({
    DEFAULT_CHAIN: { chain_id: 1, name: 'Ethereum' },
    getCurrentChainByChainId: (chainId: number) => ({
        chain_id: chainId,
        name: `chain-${chainId}`,
    }),
    getCurrentChainByPlatformId: (platformId: number) => ({
        chain_id: platformId,
        name: `chain-${platformId}`,
    }),
}));

jest.mock('../../src/shared/utils/rpc', () => ({
    getRpcUrlByNetwork: (network: any) => `https://rpc.test/${network.chain_id}`,
}));

function buildMessenger() {
    return {
        registerActionHandler: jest.fn(),
        publish: jest.fn(),
    } as any;
}

describe('NetworkController', () => {
    it('initializes with DEFAULT_CHAIN', () => {
        const c = new NetworkController({
            state: {} as any,
            messenger: buildMessenger(),
            getRpcConfig: () => ({}),
        });
        expect(c.getSelectedNetwork().chain_id).toBe(1);
    });

    it('setSelectedNetwork updates state and publishes networkChange', () => {
        const messenger = buildMessenger();
        const c = new NetworkController({
            state: {} as any,
            messenger,
            getRpcConfig: () => ({}),
        });
        c.setSelectedNetwork(137);
        expect(c.getSelectedNetwork().chain_id).toBe(137);
        expect(messenger.publish).toHaveBeenCalledWith(
            'NetworkController:networkChange',
            expect.objectContaining({ chain_id: 137 }),
        );
    });

    it('getCurrentProvider returns a JsonRpcProvider for the selected chain', () => {
        const c = new NetworkController({
            state: {} as any,
            messenger: buildMessenger(),
            getRpcConfig: () => ({}),
        });
        const provider = c.getCurrentProvider();
        expect(provider).toBeDefined();
    });

    it('reuses cached provider when url unchanged', () => {
        const c = new NetworkController({
            state: {} as any,
            messenger: buildMessenger(),
            getRpcConfig: () => ({}),
        });
        const p1 = c.getProviderByChainId(137);
        const p2 = c.getProviderByChainId(137);
        expect(p1).toBe(p2);
    });

    it('getProviderByPlatformId resolves through ChainsUtils', () => {
        const c = new NetworkController({
            state: {} as any,
            messenger: buildMessenger(),
            getRpcConfig: () => ({}),
        });
        expect(c.getProviderByPlatformId(5)).toBeDefined();
    });

    it('initializeProvider returns the same provider as getCurrentProvider', () => {
        const c = new NetworkController({
            state: {} as any,
            messenger: buildMessenger(),
            getRpcConfig: () => ({}),
        });
        const initial = c.initializeProvider();
        const current = c.getCurrentProvider();
        expect(initial).toBe(current);
    });

    it('handles getRpcConfig returning undefined (uses empty defaults)', () => {
        const c = new NetworkController({
            state: { selectedNetwork: { chain_id: 999 } } as any,
            messenger: buildMessenger(),
            getRpcConfig: undefined as any,
        });
        // Should not throw — getRpcConfig?.() returns undefined,
        // ?? {} provides empty defaults, rpcUrl resolves via mock
        expect(c.getProviderByChainId(999)).toBeDefined();
    });
});
