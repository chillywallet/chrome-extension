import GasController from '../../src/controller/GasController';

jest.mock('../../src/lib/bigintSerializer', () => ({
    deserializeBigInt: (v: any) => v ?? {},
    serializeBigInt: (v: any) => v,
}));

jest.mock('../../src/lib/ChainsUtils', () => ({
    getCurrentChainByChainId: (chainId: number) => ({
        chain_id: chainId,
        gasPriceType: chainId === 1 ? 'baseandpriority' : 'gasprice',
    }),
}));

jest.mock('../../src/shared/types/Chain', () => ({
    GasPriceType: { BaseAndPriority: 'baseandpriority', GasPrice: 'gasprice' },
}));

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn() },
}));

jest.mock('ethers', () => ({
    parseUnits: (value: string) => BigInt(Math.floor(parseFloat(value) * 1e9)),
}));

const network: any = { chain_id: 137, gasPriceType: 'gasprice' };

function buildMessenger() {
    return {} as any;
}

describe('GasController', () => {
    let provider: any;
    let c: GasController;
    beforeEach(() => {
        provider = { getFeeData: jest.fn() };
        c = new GasController({
            state: {} as any,
            messenger: buildMessenger(),
            getProviderForNetwork: () => provider,
        });
    });

    it('starts with empty maps for customGas/gasType/gasOptionsData', () => {
        const state = c.store.getState();
        expect(state.customGas).toEqual({});
        expect(state.gasType).toEqual({});
        expect(state.gasOptionsData).toEqual({});
    });

    it('setCustomGas stores per-chain entry', () => {
        c.setCustomGas({ gasPrice: 10n } as any, network);
        expect(c.store.getState().customGas[137]).toEqual({ gasPrice: 10n });
    });

    it('setGasType stores per-chain entry', () => {
        c.setGasType('high' as any, network);
        expect(c.store.getState().gasType[137]).toBe('high');
    });

    it('setGasOptionsData stores per-chain entry', () => {
        const data: any = { low: { gasPrice: 1n } };
        c.setGasOptionsData(data, network);
        expect(c.store.getState().gasOptionsData[137]).toEqual(data);
    });

    it('loadGasOptions returns EIP-1559 options for BaseAndPriority chain', async () => {
        provider.getFeeData.mockResolvedValue({
            gasPrice: null,
            maxFeePerGas: 200n,
            maxPriorityFeePerGas: 50n,
        });
        const out = await c.loadGasOptions(1);
        expect(out?.low).toBeDefined();
        expect(out?.medium).toBeDefined();
        expect(out?.high).toBeDefined();
    });

    it('loadGasOptions returns legacy options when only gasPrice is set', async () => {
        provider.getFeeData.mockResolvedValue({
            gasPrice: 100n,
            maxFeePerGas: null,
            maxPriorityFeePerGas: null,
        });
        const out = await c.loadGasOptions(137);
        expect(out?.low.gasPrice).toBeDefined();
    });

    it('loadGasOptions returns undefined when no fee data available', async () => {
        provider.getFeeData.mockResolvedValue({});
        const out = await c.loadGasOptions(137);
        expect(out).toBeUndefined();
    });

    it('loadGasOptions uses customPriorityFee overrides for EIP-1559', async () => {
        provider.getFeeData.mockResolvedValue({
            gasPrice: null,
            maxFeePerGas: 200n,
            maxPriorityFeePerGas: 50n,
        });
        const out = await c.loadGasOptions(1, {
            customPriorityFee: { low: '1', medium: '2', high: '3' },
        } as any);
        expect(out?.low.priorityFee).toBe(BigInt(1e9));
        expect(out?.medium.priorityFee).toBe(BigInt(2e9));
        expect(out?.high.priorityFee).toBe(BigInt(3e9));
    });

    it('loadGasOptions uses customGasPrice overrides for legacy', async () => {
        provider.getFeeData.mockResolvedValue({
            gasPrice: 100n,
            maxFeePerGas: null,
            maxPriorityFeePerGas: null,
        });
        const out = await c.loadGasOptions(137, {
            customGasPrice: { low: '4', medium: '5', high: '6' },
        } as any);
        expect(out?.low.gasPrice).toBe(BigInt(4e9));
        expect(out?.medium.gasPrice).toBe(BigInt(5e9));
        expect(out?.high.gasPrice).toBe(BigInt(6e9));
    });

    it('loadGasOptions defaults priorityFee to 0n when maxPriorityFeePerGas is null', async () => {
        provider.getFeeData.mockResolvedValue({
            gasPrice: null,
            maxFeePerGas: 200n,
            maxPriorityFeePerGas: null,
        });
        const out = await c.loadGasOptions(1);
        // priorityFee multiplier of 0 = 0
        expect(out?.low.priorityFee).toBe(0n);
    });
});
