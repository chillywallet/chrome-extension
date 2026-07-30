import LiquidStakingController from '../../src/controller/LiquidStakingController';

jest.mock('ethers', () => {
    function Contract(this: any, addr: string, abi: any, providerOrSigner: any) {
        this.addr = addr;
        this.abi = abi;
        this.provider = providerOrSigner;
        this.interface = {
            encodeFunctionData: jest.fn((methodName: string, args: any[]) =>
                `data:${methodName}:${JSON.stringify(args, (_k, v) =>
                    typeof v === 'bigint' ? v.toString() : v,
                )}`,
            ),
        };
        this.connect = jest.fn((signer: any) => {
            const connected: any = Object.create(Contract.prototype);
            connected.addr = addr;
            connected.abi = abi;
            connected.provider = providerOrSigner;
            connected.interface = this.interface;
            connected.getFunction = jest.fn((name: string) =>
                jest.fn(async (...args: any[]) => ({ hash: `tx-${name}-${args.length}`, signer })),
            );
            return connected;
        });
        this.getFunction = jest.fn((name: string) =>
            jest.fn(async () => BigInt(42)),
        );
        // Method called via this.contract![methodName]
        this.getRate = jest.fn(async (amount: bigint) => amount * BigInt(2));
        this.getUnstakeRate = jest.fn(async (amount: bigint) => amount / BigInt(2));
    }
    function Wallet(privateKey: string, provider: any) {
        // @ts-ignore
        this.privateKey = privateKey;
        // @ts-ignore
        this.provider = provider;
    }
    function JsonRpcProvider() {}
    class TransactionResponse {}
    return {
        Contract,
        JsonRpcProvider,
        Wallet,
        TransactionResponse,
        ethers: {
            parseEther: (v: string) => BigInt(Math.floor(parseFloat(v) * 1e18)),
            formatEther: (v: bigint) => String(Number(v) / 1e18),
        },
    };
});

jest.mock('../../src/lib/liquid-staking', () => {
    const mGetWaitTime = jest.fn(() => 7);
    const mGetClaimRequests = jest.fn(async () => ['req-1']);
    const kintsuProvider = {
        contractAddress: '0xkintsu',
        abi: [],
        fetchExchangeRateMethod: 'getRate',
        fetchUnstakeExchangeRateMethod: 'getUnstakeRate',
        stakeMethod: 'stake',
        getStakeArgs: (_amount: bigint, walletAddress: string) => [walletAddress],
        requestUnstakeMethod: 'requestUnstake',
        getRequestUnstakeArgs: (amount: bigint, walletAddress: string) => [amount, walletAddress],
        unstakeMethod: 'unstake',
        getUnstakeArgs: (
            walletAddress: string,
            requestIDs?: number[] | string,
            amount?: bigint,
        ) => [walletAddress, requestIDs ?? [], amount ?? BigInt(0)],
        cancelUnstakeRequestMethod: 'cancel',
        waitTimeMethod: 'waitTime',
    };
    const aprioriProvider = {
        ...kintsuProvider,
        contractAddress: '0xapriori',
        getWaitTime: mGetWaitTime,
        getClaimRequests: mGetClaimRequests,
    };
    const noWaitProvider = {
        ...kintsuProvider,
        contractAddress: '0xnowait',
        waitTimeMethod: undefined,
        getWaitTime: undefined,
    };
    const noRequestUnstakeMethod = {
        ...kintsuProvider,
        contractAddress: '0xnoreq',
        requestUnstakeMethod: undefined,
    };
    const noRequestUnstakeArgs = {
        ...kintsuProvider,
        contractAddress: '0xnoreqargs',
        getRequestUnstakeArgs: undefined,
    };
    return {
        __mocked: { mGetWaitTime, mGetClaimRequests },
        LiquidStakingProviders: {
            kintsu: kintsuProvider,
            apriori: aprioriProvider,
            noWait: noWaitProvider,
            noRequestUnstakeMethod: noRequestUnstakeMethod,
            noRequestUnstakeArgs: noRequestUnstakeArgs,
        },
    };
});

const mockGetGasData = jest.fn(() => ({ gasPrice: '100' }));
const mockRetryFunc = jest.fn(async (fn: Function) => fn());

jest.mock('../../src/lib/WalletUtils', () => ({
    getGasData: (...args: any[]) => mockGetGasData(...args),
    getTransactionErrorMessage: (e: any) => e?.message,
    retryFunc: (fn: Function, _opts?: any) => mockRetryFunc(fn),
}));

const mockEstimateGasWithPadding = jest.fn(async () => BigInt(1000));

jest.mock('../../src/lib/web3', () => ({
    estimateGasWithPadding: (...args: any[]) => mockEstimateGasWithPadding(...args),
}));

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mocked: liquidStakingMocks } = require('../../src/lib/liquid-staking');
const mockGetWaitTime = liquidStakingMocks.mGetWaitTime;
const mockGetClaimRequests = liquidStakingMocks.mGetClaimRequests;

function makeMessenger() {
    const { ControllerMessenger } = require('@metamask/base-controller');
    const cm = new ControllerMessenger();
    cm.registerActionHandler('NetworkController:getCurrentProvider', () => ({ chainId: 1 }));
    return cm.getRestricted({
        name: 'LiquidStakingController',
        allowedActions: ['NetworkController:getCurrentProvider'],
        allowedEvents: [],
    });
}

function build(opts: { privateKeyError?: boolean } = {}) {
    return new LiquidStakingController({
        state: {} as any,
        messenger: makeMessenger() as any,
        getPrivateKey: jest.fn(async () => {
            if (opts.privateKeyError) {
                throw new Error('priv-key-err');
            }
            return '0xprivkey';
        }),
        getProviderByChainId: () => ({} as any),
    });
}

describe('LiquidStakingController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetWaitTime.mockImplementation(() => 7);
        mockGetClaimRequests.mockImplementation(async () => ['req-1']);
    });

    describe('setLiquidStakingProvider', () => {
        it('throws on unknown provider type', () => {
            const c = build();
            expect(() => c.setLiquidStakingProvider('unknown' as any)).toThrow(
                'Liquid staking provider not found.',
            );
        });

        it('stores provider and creates a contract', () => {
            const c = build();
            const result = c.setLiquidStakingProvider('kintsu' as any);
            expect(result.contractAddress).toBe('0xkintsu');
            expect(c.getLiquidStakingProvider()).toBe(result);
            expect(c.contract).toBeDefined();
        });
    });

    describe('getExchangeRate / getUnstakeExchangeRate', () => {
        it('getExchangeRate throws when contract not initialized', async () => {
            const c = build();
            await expect(c.getExchangeRate('1')).rejects.toThrow('Contract not initialized.');
        });

        it('getUnstakeExchangeRate throws when contract not initialized', async () => {
            const c = build();
            await expect(c.getUnstakeExchangeRate('1')).rejects.toThrow('Contract not initialized.');
        });

        it('getExchangeRate returns parsed float result', async () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const rate = await c.getExchangeRate('1');
            expect(typeof rate).toBe('number');
            expect(rate).toBe(2);
        });

        it('getUnstakeExchangeRate returns parsed float result', async () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const rate = await c.getUnstakeExchangeRate('2');
            expect(rate).toBe(1);
        });
    });

    describe('getWaitTime', () => {
        it('throws when contract not initialized', async () => {
            const c = build();
            await expect(c.getWaitTime()).rejects.toThrow('Contract not initialized.');
        });

        it('throws when no wait time method or fn is available', async () => {
            const c = build();
            c.setLiquidStakingProvider('noWait' as any);
            await expect(c.getWaitTime()).rejects.toThrow('waitTimeMethod not exists.');
        });

        it('uses getWaitTime when provided', async () => {
            const c = build();
            c.setLiquidStakingProvider('apriori' as any);
            await expect(c.getWaitTime()).resolves.toBe(7);
            expect(mockGetWaitTime).toHaveBeenCalled();
        });

        it('uses waitTimeMethod when getWaitTime not provided', async () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            await expect(c.getWaitTime()).resolves.toBe(42);
        });
    });

    describe('getClaimRequests', () => {
        it('throws when provider not initialized', async () => {
            const c = build();
            await expect(c.getClaimRequests('0xabc')).rejects.toThrow('Provider not initialized.');
        });

        it('throws when getClaimRequests not implemented', async () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            await expect(c.getClaimRequests('0xabc')).rejects.toThrow(
                'getClaimRequests not exists.',
            );
        });

        it('throws when contract not initialized but provider has getClaimRequests', async () => {
            const c = build();
            c.setLiquidStakingProvider('apriori' as any);
            c.contract = undefined;
            await expect(c.getClaimRequests('0xabc')).rejects.toThrow('Contract not initialized.');
        });

        it('forwards to provider.getClaimRequests', async () => {
            const c = build();
            c.setLiquidStakingProvider('apriori' as any);
            const result = await c.getClaimRequests('0xabc');
            expect(result).toEqual(['req-1']);
            expect(mockGetClaimRequests).toHaveBeenCalledWith('0xabc', c.contract, expect.anything());
        });
    });

    describe('getStakeCall', () => {
        it('throws when contract or provider not set', () => {
            const c = build();
            expect(() => c.getStakeCall('1', '0xabc')).toThrow('Liquid staking provider not set');
        });

        it('returns encoded call', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const call = c.getStakeCall('10', '0xabc');
            expect(call).toEqual({
                to: '0xkintsu',
                data: expect.stringContaining('data:stake'),
                value: '10',
            });
        });
    });

    describe('getRequestUnstakeCall', () => {
        it('throws when contract or provider not set', () => {
            const c = build();
            expect(() => c.getRequestUnstakeCall('1', '0xabc')).toThrow(
                'Liquid staking provider not set',
            );
        });

        it('throws when requestUnstakeMethod missing', () => {
            const c = build();
            c.setLiquidStakingProvider('noRequestUnstakeMethod' as any);
            expect(() => c.getRequestUnstakeCall('1', '0xabc')).toThrow(
                'requestUnstakeMethod not exists.',
            );
        });

        it('throws when getRequestUnstakeArgs missing', () => {
            const c = build();
            c.setLiquidStakingProvider('noRequestUnstakeArgs' as any);
            expect(() => c.getRequestUnstakeCall('1', '0xabc')).toThrow(
                'getRequestUnstakeArgs not exists.',
            );
        });

        it('returns encoded call', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const call = c.getRequestUnstakeCall('5', '0xabc');
            expect(call.to).toBe('0xkintsu');
            expect(call.value).toBe('0');
        });
    });

    describe('getUnstakeCall', () => {
        it('throws when contract not set', () => {
            const c = build();
            expect(() => c.getUnstakeCall('1', '0xabc')).toThrow('Liquid staking provider not set');
        });

        it('returns encoded call without amount', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const call = c.getUnstakeCall('', '0xabc', [1, 2]);
            expect(call.to).toBe('0xkintsu');
            expect(call.value).toBe('0');
        });

        it('returns encoded call with amount', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const call = c.getUnstakeCall('10', '0xabc');
            expect(call.data).toContain('data:unstake');
        });
    });

    describe('getCancelUnstakeRequestCall', () => {
        it('throws when contract not set', () => {
            const c = build();
            expect(() => c.getCancelUnstakeRequestCall('1', '0xabc')).toThrow(
                'Liquid staking provider not set',
            );
        });

        it('returns encoded call', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const call = c.getCancelUnstakeRequestCall('1', '0xabc');
            expect(call.to).toBe('0xkintsu');
            expect(call.value).toBe('0');
            expect(call.data).toContain('data:cancel');
        });
    });

    describe('estimate helpers', () => {
        it('estimateStake throws when contract not set', () => {
            const c = build();
            expect(() => c.estimateStake('0xabc', '1')).toThrow('Contract not initialized.');
        });

        it('estimateStake calls estimateGasWithPadding', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            c.estimateStake('0xabc', '1');
            expect(mockEstimateGasWithPadding).toHaveBeenCalled();
        });

        it('estimateRequestUnstake throws when contract not set', () => {
            const c = build();
            expect(() => c.estimateRequestUnstake('0xabc', '1')).toThrow(
                'Contract not initialized.',
            );
        });

        it('estimateRequestUnstake calls estimateGasWithPadding', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            c.estimateRequestUnstake('0xabc', '1');
            expect(mockEstimateGasWithPadding).toHaveBeenCalled();
        });

        it('estimateUnstake throws when contract not set', () => {
            const c = build();
            expect(() => c.estimateUnstake('0xabc')).toThrow('Contract not initialized.');
        });

        it('estimateUnstake calls estimateGasWithPadding', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            c.estimateUnstake('0xabc', [1, 2], '10');
            expect(mockEstimateGasWithPadding).toHaveBeenCalled();
        });

        it('estimateCancelUnstakeRequest throws when contract not set', () => {
            const c = build();
            expect(() => c.estimateCancelUnstakeRequest('1', '0xabc')).toThrow(
                'Contract not initialized.',
            );
        });

        it('estimateCancelUnstakeRequest calls estimateGasWithPadding', () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            c.estimateCancelUnstakeRequest('1', '0xabc');
            expect(mockEstimateGasWithPadding).toHaveBeenCalled();
        });
    });

    describe('stake', () => {
        it('returns null when contract not set', async () => {
            const c = build();
            await expect(c.stake('0xabc', '1', {} as any, 100)).resolves.toBeNull();
        });

        it('throws transaction error when load wallet fails', async () => {
            const c = build({ privateKeyError: true });
            c.setLiquidStakingProvider('kintsu' as any);
            await expect(c.stake('0xabc', '1', {} as any, 100)).rejects.toThrow('priv-key-err');
        });

        it('executes stake successfully', async () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const result = await c.stake('0xabc', '1', {} as any, 100);
            expect(result).toMatchObject({ hash: expect.stringContaining('stake') });
        });
    });

    describe('requestUnstake', () => {
        it('returns null when contract not set', async () => {
            const c = build();
            await expect(c.requestUnstake('0xabc', '1', {} as any, 100)).resolves.toBeNull();
        });

        it('throws when requestUnstakeMethod missing', async () => {
            const c = build();
            c.setLiquidStakingProvider('noRequestUnstakeMethod' as any);
            await expect(c.requestUnstake('0xabc', '1', {} as any, 100)).rejects.toThrow(
                'requestUnstakeMethod not exists.',
            );
        });

        it('throws when getRequestUnstakeArgs missing', async () => {
            const c = build();
            c.setLiquidStakingProvider('noRequestUnstakeArgs' as any);
            await expect(c.requestUnstake('0xabc', '1', {} as any, 100)).rejects.toThrow(
                'getRequestUnstakeArgs not exists.',
            );
        });

        it('throws transaction error when load wallet fails', async () => {
            const c = build({ privateKeyError: true });
            c.setLiquidStakingProvider('kintsu' as any);
            await expect(c.requestUnstake('0xabc', '1', {} as any, 100)).rejects.toThrow(
                'priv-key-err',
            );
        });

        it('executes requestUnstake successfully', async () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const result = await c.requestUnstake('0xabc', '1', {} as any, 100);
            expect(result).toMatchObject({ hash: expect.stringContaining('requestUnstake') });
        });
    });

    describe('unstake', () => {
        it('returns null when contract not set', async () => {
            const c = build();
            await expect(c.unstake('0xabc', [1], '1', {} as any, 100)).resolves.toBeNull();
        });

        it('throws transaction error when load wallet fails', async () => {
            const c = build({ privateKeyError: true });
            c.setLiquidStakingProvider('kintsu' as any);
            await expect(c.unstake('0xabc', [1], '1', {} as any, 100)).rejects.toThrow(
                'priv-key-err',
            );
        });

        it('executes unstake without amount successfully', async () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const result = await c.unstake('0xabc', [1], undefined, {} as any, 100);
            expect(result).toMatchObject({ hash: expect.stringContaining('unstake') });
        });
    });

    describe('cancelUnstakeRequest', () => {
        it('returns null when contract not set', async () => {
            const c = build();
            await expect(
                c.cancelUnstakeRequest('1', '0xabc', {} as any, 100),
            ).resolves.toBeNull();
        });

        it('throws transaction error when load wallet fails', async () => {
            const c = build({ privateKeyError: true });
            c.setLiquidStakingProvider('kintsu' as any);
            await expect(
                c.cancelUnstakeRequest('1', '0xabc', {} as any, 100),
            ).rejects.toThrow('priv-key-err');
        });

        it('executes cancelUnstakeRequest successfully', async () => {
            const c = build();
            c.setLiquidStakingProvider('kintsu' as any);
            const result = await c.cancelUnstakeRequest('1', '0xabc', {} as any, 100);
            expect(result).toMatchObject({ hash: expect.stringContaining('cancel') });
        });
    });
});
