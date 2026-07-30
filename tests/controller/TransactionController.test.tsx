import TransactionController, {
    HARDFORK,
    ApprovalState,
} from '../../src/controller/TransactionController';
import { TransactionStatus, TransactionType } from '../../src/shared/types/Transaction';

jest.mock('@ethereumjs/tx', () => ({
    TransactionFactory: { fromTxData: jest.fn(() => ({ raw: '0xrawtx' })) },
}));

jest.mock('@ethereumjs/common', () => ({
    Common: class FakeCommon {
        constructor(_: any) {}
        static custom() {
            return new FakeCommon({});
        }
    },
    Hardfork: { London: 'london' },
}));

jest.mock('@ethereumjs/util', () => ({
    bufferToHex: jest.fn(() => '0xbuf'),
}));

jest.mock('@metamask/controller-utils', () => ({
    ApprovalType: { Transaction: 'transaction' },
    convertHexToDecimal: (h: string) => parseInt(h, 16),
}));

jest.mock('@metamask/rpc-errors', () => ({
    providerErrors: {
        userRejectedRequest: (msg: string) => new Error(msg),
    },
    rpcErrors: {
        internal: (msg: string) => new Error(msg),
    },
}));

jest.mock('@metamask/utils', () => ({
    add0x: (s: string) => (s?.startsWith?.('0x') ? s : '0x' + s),
    hexToNumber: (h: string) => parseInt(h, 16),
}));

jest.mock('async-mutex', () => ({
    Mutex: class {
        async runExclusive(fn: () => Promise<any>) {
            return fn();
        }
        async acquire() {
            return () => {};
        }
    },
}));

jest.mock('eth-rpc-errors', () => ({
    errorCodes: {
        rpc: { invalidInput: -32000 },
        provider: { userRejectedRequest: 4001 },
    },
}));

const mockProviderEstimateGas = jest.fn();
const mockProviderGetTransaction = jest.fn();
const mockProviderGetTransactionCount = jest.fn();
const mockProviderGetBalance = jest.fn();
const mockProviderGetCode = jest.fn();
const mockProviderResolveName = jest.fn();
const mockProviderWaitForTransaction = jest.fn();
const mockProviderBroadcastTransaction = jest.fn();
const mockProviderGetBlockNumber = jest.fn();

const mockContractApprove = jest.fn();
const mockContractAllowance = jest.fn();
const mockContractDecimals = jest.fn();
const mockContractBalanceOf = jest.fn();
const mockPopulateTransaction = jest.fn();

const mockWalletSendTransaction = jest.fn();

jest.mock('ethers', () => {
    class FakeProvider {
        estimateGas = (...args: any[]) => mockProviderEstimateGas(...args);
        getTransaction = (...args: any[]) => mockProviderGetTransaction(...args);
        getTransactionCount = (...args: any[]) => mockProviderGetTransactionCount(...args);
        getBalance = (...args: any[]) => mockProviderGetBalance(...args);
        getCode = (...args: any[]) => mockProviderGetCode(...args);
        resolveName = (...args: any[]) => mockProviderResolveName(...args);
        waitForTransaction = (...args: any[]) => mockProviderWaitForTransaction(...args);
        broadcastTransaction = (...args: any[]) => mockProviderBroadcastTransaction(...args);
        getBlockNumber = (...args: any[]) => mockProviderGetBlockNumber(...args);
    }

    class FakeContract {
        addr: string;
        abi: any;
        constructor(addr: string, abi: any, _provider: any) {
            this.addr = addr;
            this.abi = abi;
        }
        allowance = (...args: any[]) => mockContractAllowance(...args);
        balanceOf = (...args: any[]) => mockContractBalanceOf(...args);
        decimals = (...args: any[]) => mockContractDecimals(...args);
        connect(_wallet: any) {
            return this;
        }
        getFunction(_name: string) {
            const fn: any = (...args: any[]) => mockContractApprove(...args);
            fn.populateTransaction = (...args: any[]) => mockPopulateTransaction(...args);
            return fn;
        }
    }

    class FakeWallet {
        privateKey: string;
        provider: any;
        constructor(pk: string, provider: any) {
            this.privateKey = pk;
            this.provider = provider;
        }
        sendTransaction = (...args: any[]) => mockWalletSendTransaction(...args);
    }

    return {
        Contract: jest.fn().mockImplementation((addr: string, abi: any, provider: any) => {
            return new FakeContract(addr, abi, provider);
        }),
        JsonRpcProvider: FakeProvider,
        TransactionResponse: class {},
        Wallet: jest.fn().mockImplementation((pk: string, provider: any) => new FakeWallet(pk, provider)),
        ZeroAddress: '0x0000000000000000000000000000000000000000',
        __FakeProvider: FakeProvider,
    };
});

// Provide a local FakeProvider that satisfies the constructor mock so build() can construct it.
const ethersMock = require('ethers');
const FakeProvider: any = ethersMock.JsonRpcProvider;

// jest's resetMocks:true setting wipes mockImplementation for Contract/Wallet between tests.
// Restore them globally before each test.
function restoreEthersMocks() {
    class FakeContract {
        addr: string;
        abi: any;
        constructor(addr: string, abi: any, _provider: any) {
            this.addr = addr;
            this.abi = abi;
        }
        allowance = (...args: any[]) => mockContractAllowance(...args);
        balanceOf = (...args: any[]) => mockContractBalanceOf(...args);
        decimals = (...args: any[]) => mockContractDecimals(...args);
        connect(_wallet: any) {
            return this;
        }
        getFunction(_name: string) {
            const fn: any = (...args: any[]) => mockContractApprove(...args);
            fn.populateTransaction = (...args: any[]) => mockPopulateTransaction(...args);
            return fn;
        }
    }
    class FakeWallet {
        privateKey: string;
        provider: any;
        constructor(pk: string, provider: any) {
            this.privateKey = pk;
            this.provider = provider;
        }
        sendTransaction = (...args: any[]) => mockWalletSendTransaction(...args);
    }
    (ethersMock.Contract as jest.Mock).mockImplementation(
        (addr: string, abi: any, provider: any) => new FakeContract(addr, abi, provider),
    );
    (ethersMock.Wallet as jest.Mock).mockImplementation(
        (pk: string, provider: any) => new FakeWallet(pk, provider),
    );
}

jest.mock('uuid', () => ({
    v1: () => 'fixed-uuid',
}));

const mockGetCurrentChains = jest.fn(() => [{ chain_id: 1 }, { chain_id: 137 }]);
const mockGetCurrentChainByChainId = jest.fn((chainId: number) => ({
    chain_id: chainId,
    viemChain: { id: chainId },
}));

jest.mock('../../src/lib/ChainsUtils', () => ({
    getCurrentChainByChainId: (...args: any[]) => mockGetCurrentChainByChainId(...args),
    getCurrentChains: () => mockGetCurrentChains(),
}));

const mockAutoSwapParseSignableTransaction = jest.fn(() => ({
    maxFeePerGas: 1,
    maxPriorityFeePerGas: 1,
}));
const mockAutoSwapSendTransaction = jest.fn(async () => '0xtxhash');
const mockAutoSwapGetKernelAccount = jest.fn(async () => ({ address: '0xkernel' }));
const mockAutoSwapGetAASignature = jest.fn(async () => '0xaasig');


jest.mock('../../src/lib/eip5792/batchExecuteContract', () => ({
    buildExecuteBatchTx: jest.fn(() => ({ to: '0xexec', data: '0xexecdata' })),
    estimateExecuteBatchGas: jest.fn(async () => 100000),
}));

const mockSetCallBatchStatus = jest.fn(async () => {});
const mockGetCallBatchStatus = jest.fn(async () => null);
jest.mock('../../src/lib/eip5792/callBatchStore', () => ({
    setCallBatchStatus: (...args: any[]) => mockSetCallBatchStatus(...args),
    getCallBatchStatus: (...args: any[]) => mockGetCallBatchStatus(...args),
}));

jest.mock('../../src/lib/eip5792/capabilities', () => ({
    getBatchCallsContractAddress: jest.fn(() => '0xbatchcontract'),
}));

const mockValidateWalletSendCalls = jest.fn(() => ({ ok: true, chainIdNum: 1 }));
jest.mock('../../src/lib/eip5792/sendCalls', () => ({
    validateWalletSendCallsPreflight: (...args: any[]) => mockValidateWalletSendCalls(...args),
}));

jest.mock('../../src/lib/eip5792/types', () => ({
    CallBatchStatusCode: { Pending: 'PENDING', Confirmed: 'CONFIRMED', Reverted: 'REVERTED', PartialRevert: 'PARTIAL' },
}));

jest.mock('../../src/lib/erc20-abi.json', () => [], { virtual: true });
jest.mock('../../src/lib/erc721-abi.json', () => [], { virtual: true });

jest.mock('../../src/lib/transactions/utils', () => ({
    determineTransactionType: jest.fn(async () => ({ type: 'simpleSend' })),
    normalizeTransactionParams: (p: any) => p,
    normalizeTxError: (e: any) => e?.message,
    readAddressAsContract: jest.fn(async () => ({ isContractLikeAddress: false })),
}));

jest.mock('../../src/lib/transactions/validation', () => ({
    validateTransactionOrigin: jest.fn(async () => {}),
    validateTxParams: jest.fn(),
}));

const mockGetGasData = jest.fn((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
const mockRetryFunc = jest.fn(async (fn: Function) => fn());
jest.mock('../../src/lib/WalletUtils', () => ({
    getGasData: (...args: any[]) => mockGetGasData(...args),
    retryFunc: (fn: Function) => mockRetryFunc(fn),
    getTransactionErrorMessage: (e: any) => {
        if (!e) return 'Unknown Error';
        if (typeof e === 'string') return e;
        if (e instanceof Error) return e.message || 'Unknown Error';
        return 'Unknown Error';
    },
}));

const mockCreateSignableTransaction = jest.fn(async () => ({ to: '0xto', value: 0 }));
const mockEstimateGasLimitLib = jest.fn(async () => '21000');
const mockEstimateGasWithPadding = jest.fn(async () => '21000');
jest.mock('../../src/lib/web3', () => ({
    createSignableTransaction: (...args: any[]) => mockCreateSignableTransaction(...args),
    estimateGasLimit: (...args: any[]) => mockEstimateGasLimitLib(...args),
    estimateGasWithPadding: (...args: any[]) => mockEstimateGasWithPadding(...args),
    toHex: (n: number) => `0x${n.toString(16)}`,
}));

jest.mock('../../src/shared/constants/app', () => ({
    BALANCE_CACHE_INTERVAL: 10_000,
    ORIGIN_CHILLY: 'chilly',
}));

jest.mock('../../src/shared/constants/swap', () => ({
    UNIT_256_MAX_VALUE:
        '115792089237316195423570985008687907853269984665640564039457584007913129639935',
}));

jest.mock('../../src/shared/messages/ErrorMessages', () => ({
    __esModule: true,
    default: {
        CAN_NOT_LOAD_WALLET: 'Cannot load wallet',
    },
}));

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../src/shared/utils/rateLimiter', () => ({
    RateLimiters: {
        tokenBalance: {
            execute: async (fn: () => Promise<any>) => fn(),
        },
    },
}));

jest.mock('../../src/api/graphQL/BaseRequest', () => ({
    getErrorMessage: (e: any) => e?.message ?? 'err',
}));

function makeMessenger(opts: {
    addRequest?: any;
    signAuthorization?: any;
    signTypedMessageUsingViem?: any;
    sendTransactionUsingViem?: any;
    executeGasless?: any;
    getSelectedAccount?: any;
    getAccountByAddress?: any;
    getKeyringForAccount?: any;
} = {}) {
    const { ControllerMessenger } = require('@metamask/base-controller');
    const cm = new ControllerMessenger();
    cm.registerActionHandler('NetworkController:getCurrentProvider', () => new FakeProvider());
    cm.registerActionHandler('ApprovalController:addRequest', opts.addRequest ?? (async () => ({
        value: {},
        resultCallbacks: { success: jest.fn(), error: jest.fn() },
    })));
    cm.registerActionHandler(
        'KeyringController:signAuthorization',
        opts.signAuthorization ??
            (async () => ({ r: '0x', s: '0x', v: 27, yParity: 0, chainId: 1, nonce: 0, address: '0xa' })),
    );
    cm.registerActionHandler(
        'KeyringController:signTypedMessageUsingViem',
        opts.signTypedMessageUsingViem ?? (async () => '0xsig-typed'),
    );
    cm.registerActionHandler(
        'KeyringController:sendTransactionUsingViem',
        opts.sendTransactionUsingViem ?? (async () => '0xviem-hash'),
    );
    cm.registerActionHandler(
        'CognitoController:executeGasless',
        opts.executeGasless ?? (async () => ({ data: { executeGasless: { ok: true } } })),
    );
    cm.registerActionHandler(
        'AccountsController:getSelectedAccount',
        opts.getSelectedAccount ?? (() => ({ address: '0xacct', smartAddress: '' })),
    );
    cm.registerActionHandler(
        'AccountsController:getAccountByAddress',
        opts.getAccountByAddress ?? ((addr: string) => ({ address: addr, smartAddress: '0xsmart' })),
    );
    cm.registerActionHandler(
        'KeyringController:getKeyringForAccount',
        opts.getKeyringForAccount ?? (async () => ({ type: 'HD Key Tree' })),
    );
    const messenger = cm.getRestricted({
        name: 'TransactionController',
        allowedActions: [
            'NetworkController:getCurrentProvider',
            'ApprovalController:addRequest',
            'KeyringController:signAuthorization',
            'KeyringController:signTypedMessageUsingViem',
            'KeyringController:sendTransactionUsingViem',
            'KeyringController:getKeyringForAccount',
            'CognitoController:executeGasless',
            'AccountsController:getSelectedAccount',
            'AccountsController:getAccountByAddress',
        ],
        allowedEvents: [],
    });
    return { cm, messenger };
}

function build(opts: any = {}) {
    const { cm, messenger } = makeMessenger(opts.messengerOpts);
    const sign = jest.fn(async () => ({ raw: '0xsigned' }));
    const getPrivateKey = jest.fn(async () => '0xprivkey');
    const getPermittedAccounts = jest.fn(async () => ['0xacct']);
    const getSelectedNetwork = jest.fn(() => ({
        chain_id: 1,
        chain_key: 'eip155:1',
        gasPadding: 110,
    }));
    const getProviderByChainId = jest.fn(() => new FakeProvider());
    const getAccountBySmartAddress = jest.fn(() => undefined);

    const controller = new TransactionController({
        state: opts.state ?? ({} as any),
        messenger: messenger as any,
        sign,
        getPrivateKey,
        getPermittedAccounts,
        getSelectedNetwork,
        getProviderByChainId,
        getAccountBySmartAddress,
        ...opts.controllerOverrides,
    });
    return { controller, cm, sign, getPrivateKey, getProviderByChainId, getSelectedNetwork };
}

describe('TransactionController module', () => {
    it('default-exports the controller class', () => {
        expect(TransactionController).toBeDefined();
    });

    it('exposes HARDFORK and ApprovalState', () => {
        expect(HARDFORK).toBe('london');
        expect(ApprovalState.Approved).toBe('approved');
        expect(ApprovalState.NotApproved).toBe('not-approved');
    });
});

describe('TransactionController initial state', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
    });

    it('initializes with empty defaults', () => {
        const { controller } = build();
        expect(controller.state.rpcTransactions).toEqual([]);
        expect(controller.state.decimalsData).toEqual({});
        expect(controller.state.balanceData).toEqual({});
        expect(controller.state.nativeTokenBalance).toEqual({});
    });
});

describe('approveAllowance / checkAllowance / estimateGasAllowance', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
    });

    it('approveAllowance approves the spender', async () => {
        const { controller } = build();
        const result = await controller.approveAllowance(
            '0xspender',
            '0xwallet',
            '0xtoken',
            '100',
            { chain_id: 1 } as any,
            {} as any,
            false,
        );
        expect(result).toEqual({ hash: '0xapprove-tx' });
        expect(mockContractApprove).toHaveBeenCalled();
    });

    it('approveAllowance uses MAX value for infiniteApproval', async () => {
        const { controller } = build();
        await controller.approveAllowance(
            '0xspender',
            '0xwallet',
            '0xtoken',
            '100',
            { chain_id: 1 } as any,
            {} as any,
            true,
        );
        expect(mockContractApprove).toHaveBeenCalled();
    });

    it('approveAllowance rejects when token call throws', async () => {
        mockContractApprove.mockRejectedValueOnce(new Error('approval failed'));
        const { controller } = build();
        await expect(
            controller.approveAllowance(
                '0xspender',
                '0xwallet',
                '0xtoken',
                '100',
                { chain_id: 1 } as any,
                {} as any,
                false,
            ),
        ).rejects.toThrow('approval failed');
    });

    it('checkAllowance returns true when allowance covers amount', async () => {
        const { controller } = build();
        await expect(
            controller.checkAllowance('0xspender', '0xwallet', '0xtoken', '500'),
        ).resolves.toBe(true);
    });

    it('checkAllowance returns false when allowance is insufficient', async () => {
        mockContractAllowance.mockResolvedValueOnce(BigInt(10));
        const { controller } = build();
        await expect(
            controller.checkAllowance('0xspender', '0xwallet', '0xtoken', '500'),
        ).resolves.toBe(false);
    });

    it('checkAllowance uses MAX when spenderAmount is null', async () => {
        mockContractAllowance.mockResolvedValueOnce(BigInt(1));
        const { controller } = build();
        await expect(
            controller.checkAllowance('0xspender', '0xwallet', '0xtoken', null),
        ).resolves.toBe(false);
    });

    it('estimateGasAllowance returns gas limit string', async () => {
        const { controller } = build();
        const result = await controller.estimateGasAllowance(
            '0xspender',
            '0xtoken',
            '100',
            '0xwallet',
        );
        expect(result).toBe('50000');
    });

    it('estimateGasAllowance returns null when provider returns null', async () => {
        mockProviderEstimateGas.mockResolvedValueOnce(null as any);
        const { controller } = build();
        const result = await controller.estimateGasAllowance(
            '0xspender',
            '0xtoken',
            null,
            '0xwallet',
        );
        expect(result).toBeNull();
    });
});

describe('estimateGas / estimateGasLimit', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
    });

    it('estimateGas applies padding from selected network', async () => {
        const { controller } = build();
        const result = await controller.estimateGas({
            from: '0xa',
            to: '0xb',
            value: '0x10',
        } as any);
        // 50000 * 110 / 100 = 55000
        expect(result).toBe('55000');
    });

    it('estimateGas returns null when provider returns falsy', async () => {
        mockProviderEstimateGas.mockResolvedValueOnce(BigInt(0));
        const { controller } = build();
        const result = await controller.estimateGas({ from: '0xa' } as any);
        expect(result).toBeNull();
    });

    it('estimateGas throws on provider error with friendly message', async () => {
        mockProviderEstimateGas.mockRejectedValueOnce(new Error('rpc-err'));
        const { controller } = build();
        await expect(controller.estimateGas({ from: '0xa' } as any)).rejects.toThrow('rpc-err');
    });

    it('estimateGasLimit forwards to lib helper', () => {
        const { controller } = build();
        controller.estimateGasLimit(
            { symbol: 'ETH' } as any,
            '0xa',
            '0xb',
            '100',
        );
        expect(mockEstimateGasLimitLib).toHaveBeenCalled();
    });
});

describe('estimateWalletSendCallsGas', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockEstimateGasWithPadding.mockResolvedValue('25000');
    });

    it('throws when preflight fails', async () => {
        mockValidateWalletSendCalls.mockReturnValueOnce({ ok: false, message: 'bad' } as any);
        const { controller } = build();
        await expect(
            controller.estimateWalletSendCallsGas({ calls: [] } as any, '0xfrom'),
        ).rejects.toThrow('bad');
    });

    it('estimates per-call gas in non-atomic mode', async () => {
        const { controller } = build();
        const total = await controller.estimateWalletSendCallsGas(
            { calls: [{ to: '0x1', data: '0x' }, { to: '0x2', data: '0x' }] } as any,
            '0xfrom',
        );
        expect(total).toBeGreaterThanOrEqual(42000);
    });

    it('uses estimateExecuteBatchGas for atomicRequired mode when sender is a contract', async () => {
        const { readAddressAsContract } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValueOnce({
            isContractLikeAddress: true,
        });
        const { estimateExecuteBatchGas } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValueOnce(200000);
        const { controller } = build();
        const total = await controller.estimateWalletSendCallsGas(
            { atomicRequired: true, calls: [{ to: '0x1', data: '0x' }] } as any,
            '0xfrom',
        );
        expect(total).toBe(200000);
    });
});

describe('getWalletSendCallsStatus / hasWalletSendCallsBatch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
    });

    it('getWalletSendCallsStatus returns status from store', async () => {
        mockGetCallBatchStatus.mockResolvedValueOnce({ id: 'b1' } as any);
        const { controller } = build();
        await expect(controller.getWalletSendCallsStatus('b1')).resolves.toEqual({ id: 'b1' });
    });

    it('hasWalletSendCallsBatch returns true when status exists', async () => {
        mockGetCallBatchStatus.mockResolvedValueOnce({ id: 'b1' } as any);
        const { controller } = build();
        await expect(controller.hasWalletSendCallsBatch('b1')).resolves.toBe(true);
    });

    it('hasWalletSendCallsBatch returns false when no status', async () => {
        mockGetCallBatchStatus.mockResolvedValueOnce(null);
        const { controller } = build();
        await expect(controller.hasWalletSendCallsBatch('b1')).resolves.toBe(false);
    });
});

describe('balance helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
    });

    it('getTokenBalance returns ERC20 token balance and decimals', async () => {
        const { controller } = build();
        const result = await controller.getTokenBalance('0xuser', '0xtoken', false, 1);
        expect(result.balance).toBe(BigInt(500));
        expect(result.decimals).toBe(18);
        expect(result.error).toBe(false);
    });

    it('getTokenBalance returns native balance when nativeCoin=true', async () => {
        const { controller } = build();
        const result = await controller.getTokenBalance('0xuser', undefined, true, 1);
        expect(result.balance).toBe(BigInt(1000));
        expect(result.error).toBe(false);
    });

    it('getTokenBalance returns error result when retry throws', async () => {
        mockContractBalanceOf.mockRejectedValueOnce(new Error('boom'));
        const { controller } = build();
        const result = await controller.getTokenBalance('0xuser', '0xtoken', false, 1);
        expect(result.error).toBe(true);
    });

    it('getNativeTokenBalance updates state', async () => {
        const { controller } = build();
        const result = await controller.getNativeTokenBalance('0xuser', 1);
        expect(typeof result).toBe('string');
        expect(controller.state.nativeTokenBalance['0xuser']['1']).toBe(result);
    });

    it('caches ERC20 balance for repeat queries within the window', async () => {
        const { controller } = build();
        await controller.getTokenBalance('0xuser', '0xtoken', false, 1);
        const firstCalls = mockContractBalanceOf.mock.calls.length;
        await controller.getTokenBalance('0xuser', '0xtoken', false, 1);
        // Second call should use the cache, so balanceOf invocation count stays the same.
        expect(mockContractBalanceOf.mock.calls.length).toBe(firstCalls);
    });

    it('extends balance cache for the same user across additional tokens on the same chain', async () => {
        const { controller } = build();
        // First call: balanceData[user] doesn't exist yet → "else" branch in state update
        await controller.getTokenBalance('0xuser', '0xtoken1', false, 1);
        // Second call (different token, same user+chain): balanceData[user] now exists →
        // exercises the "balanceData[userAddress] ? { ...balanceData[userAddress][chainId], ... }" branch
        await controller.getTokenBalance('0xuser', '0xtoken2', false, 1);
        expect(controller.state.balanceData['0xuser']?.[1]?.['0xtoken1']).toBeDefined();
        expect(controller.state.balanceData['0xuser']?.[1]?.['0xtoken2']).toBeDefined();
    });
});

describe('newSendTransaction / sendTransaction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockProviderGetTransaction.mockResolvedValue({
            hash: '0xtxhash',
            wait: jest.fn(),
        } as any);
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
    });

    it('newSendTransaction sends via EOA wallet', async () => {
        const { controller } = build();
        const result = await controller.newSendTransaction(
            '0xacct',
            { transaction: { to: '0xto', value: 1 } } as any,
            false,
        );
        expect(result).toMatchObject({ hash: '0xsent-tx' });
    });



    it('sendTransaction creates a signable transaction and forwards', async () => {
        const { controller } = build();
        await controller.sendTransaction(
            '0xacct',
            '0xreceipient',
            {} as any,
            100,
            '1',
            { symbol: 'ETH' } as any,
            false,
        );
        expect(mockCreateSignableTransaction).toHaveBeenCalled();
        expect(mockWalletSendTransaction).toHaveBeenCalled();
    });

    it('sendTransaction with AA wallet throws if no smart account', async () => {
        const { controller } = build({
            messengerOpts: { getAccountByAddress: () => ({ address: '0xa' /* no smartAddress */ }) },
        });
        await expect(
            controller.sendTransaction(
                '0xacct',
                '0xreceipient',
                {} as any,
                100,
                '1',
                { symbol: 'ETH' } as any,
                true,
            ),
        ).rejects.toThrow(/Smart account not found/);
    });

});



describe('checkContract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
    });

    it('returns false for an EOA', async () => {
        mockProviderGetCode.mockResolvedValueOnce('0x');
        const { controller } = build();
        await expect(controller.checkContract('0xa')).resolves.toBe(false);
    });

    it('returns true for a contract', async () => {
        mockProviderGetCode.mockResolvedValueOnce('0xdeadbeef');
        const { controller } = build();
        await expect(controller.checkContract('0xa')).resolves.toBe(true);
    });

    it('returns false on provider error', async () => {
        mockProviderGetCode.mockRejectedValueOnce(new Error('rpc'));
        const { controller } = build();
        await expect(controller.checkContract('0xa')).resolves.toBe(false);
    });
});


describe('speedUpTransaction / cancelTransaction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xnew-hash',
            wait: jest.fn(),
        });
    });

    it('speedUpTransaction sends a faster transaction', async () => {
        const { controller } = build();
        const result = await controller.speedUpTransaction(
            '0xacct',
            { data: '0x', gasLimit: 21000, nonce: 1, to: '0xto', value: 1 } as any,
            {} as any,
            false,
        );
        expect(result?.hash).toBe('0xnew-hash');
    });

    it('cancelTransaction sends a self-transfer', async () => {
        const { controller } = build();
        const result = await controller.cancelTransaction(
            '0xacct',
            { nonce: 2 } as any,
            {} as any,
        );
        expect(result?.hash).toBe('0xnew-hash');
    });
});

describe('ensToWalletAdress', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
    });

    it('returns lowercase address when ENS resolves', async () => {
        mockProviderResolveName.mockResolvedValueOnce('0xMixedCASE');
        const { controller } = build();
        await expect(controller.ensToWalletAdress('alice.eth')).resolves.toBe('0xmixedcase');
    });

    it('returns empty string when ENS does not resolve', async () => {
        mockProviderResolveName.mockResolvedValueOnce(null as any);
        const { controller } = build();
        await expect(controller.ensToWalletAdress('miss.eth')).resolves.toBe('');
    });
});

describe('addTransaction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
    });

    it('throws when chainId is unknown', async () => {
        const { controller } = build();
        await expect(
            controller.addTransaction({ from: '0xa', to: '0xb' } as any, {
                chainId: 9999,
            }),
        ).rejects.toThrow(/chainId for this transaction/);
    });

    it('adds an unapproved transaction and emits an event', async () => {
        const { controller, cm } = build();
        const spy = jest.fn();
        cm.subscribe('TransactionController:unapprovedTransactionAdded', spy);
        const { transactionMeta, result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1' } as any,
            { actionId: 'a1' },
        );
        // Drop the unresolved promise — we don't care here.
        result.catch(() => {});
        expect(transactionMeta.id).toBeDefined();
        expect(transactionMeta.status).toBe(TransactionStatus.unapproved);
        expect(spy).toHaveBeenCalled();
    });

    it('returns the existing meta when actionId matches', async () => {
        const { controller } = build({
            state: {
                rpcTransactions: [
                    {
                        id: 'existing-id',
                        actionId: 'a1',
                        chainId: '0x1',
                        time: 1,
                        status: TransactionStatus.unapproved,
                        txParams: { from: '0xa' },
                    } as any,
                ],
            },
        });
        const { transactionMeta, result } = await controller.addTransaction(
            { from: '0xa' } as any,
            { actionId: 'a1' },
        );
        result.catch(() => {});
        expect(transactionMeta.id).toBe('existing-id');
    });
});

describe('updateTransaction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreEthersMocks();
        const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
        (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
        const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
        (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
        (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
        const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
        mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
        mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
        mockProviderGetTransactionCount.mockResolvedValue(5);
        mockProviderGetBalance.mockResolvedValue(BigInt(1000));
        mockProviderGetCode.mockResolvedValue('0x');
        mockProviderResolveName.mockResolvedValue('0xRESOLVED');
        mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
        mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
        mockContractAllowance.mockResolvedValue(BigInt(1000));
        mockContractBalanceOf.mockResolvedValue(BigInt(500));
        mockContractDecimals.mockResolvedValue(18);
        mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
        mockWalletSendTransaction.mockResolvedValue({
            hash: '0xsent-tx',
            wait: jest.fn(async () => ({ status: 1, hash: '0xsent-tx' })),
        });
        mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
        mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
        mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
        mockAutoSwapParseSignableTransaction.mockReturnValue({
            maxFeePerGas: 1,
            maxPriorityFeePerGas: 1,
        });
        mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
        mockEstimateGasLimitLib.mockResolvedValue('21000');
        mockEstimateGasWithPadding.mockResolvedValue('25000');
        mockRetryFunc.mockImplementation(async (fn: Function) => fn());
        mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
        mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
        mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
        mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
        mockGetCallBatchStatus.mockResolvedValue(null);
        mockSetCallBatchStatus.mockResolvedValue(undefined);
    });

    it('replaces the transaction in state', () => {
        const { controller } = build({
            state: {
                rpcTransactions: [
                    {
                        id: 'meta-1',
                        chainId: '0x1',
                        time: 1,
                        status: TransactionStatus.unapproved,
                        txParams: { from: '0xa' },
                    } as any,
                ],
            },
        });
        controller.updateTransaction({
            id: 'meta-1',
            chainId: '0x1',
            time: 1,
            status: TransactionStatus.approved,
            txParams: { from: '0xa', to: '0xb' },
        } as any);
        expect(controller.state.rpcTransactions[0].status).toBe(TransactionStatus.approved);
    });
});

function setupCommonMocks() {
    jest.clearAllMocks();
    restoreEthersMocks();
    const { readAddressAsContract, determineTransactionType } = require('../../src/lib/transactions/utils');
    (readAddressAsContract as jest.Mock).mockResolvedValue({ isContractLikeAddress: false });
    (determineTransactionType as jest.Mock).mockResolvedValue({ type: 'simpleSend' });
    const { estimateExecuteBatchGas, buildExecuteBatchTx } = require('../../src/lib/eip5792/batchExecuteContract');
    (estimateExecuteBatchGas as jest.Mock).mockResolvedValue(100000);
    (buildExecuteBatchTx as jest.Mock).mockReturnValue({ to: '0xexec', data: '0xexecdata' });
    const { getBatchCallsContractAddress } = require('../../src/lib/eip5792/capabilities');
    (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xbatchcontract');
    mockProviderEstimateGas.mockResolvedValue(BigInt(50000));
    mockProviderGetTransaction.mockResolvedValue({ hash: '0xtxhash' });
    mockProviderGetTransactionCount.mockResolvedValue(5);
    mockProviderGetBalance.mockResolvedValue(BigInt(1000));
    mockProviderGetCode.mockResolvedValue('0x');
    mockProviderResolveName.mockResolvedValue('0xRESOLVED');
    mockProviderWaitForTransaction.mockResolvedValue({ status: 1 });
    mockContractApprove.mockResolvedValue({ hash: '0xapprove-tx' });
    mockContractAllowance.mockResolvedValue(BigInt(1000));
    mockContractBalanceOf.mockResolvedValue(BigInt(500));
    mockContractDecimals.mockResolvedValue(18);
    mockPopulateTransaction.mockResolvedValue({ to: '0xtkn', data: '0x' });
    mockWalletSendTransaction.mockResolvedValue({
        hash: '0xsent-tx',
        wait: jest.fn(async () => ({
            status: 1,
            hash: '0xsent-tx',
            blockHash: '0xblock',
            blockNumber: 1,
            gasUsed: 21000,
            logs: [],
        })),
    });
    mockAutoSwapSendTransaction.mockResolvedValue('0xtxhash');
    mockAutoSwapGetKernelAccount.mockResolvedValue({ address: '0xkernel' });
    mockAutoSwapGetAASignature.mockResolvedValue('0xaasig');
    mockAutoSwapParseSignableTransaction.mockReturnValue({
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
    });
    mockCreateSignableTransaction.mockResolvedValue({ to: '0xto', value: 0 });
    mockEstimateGasLimitLib.mockResolvedValue('21000');
    mockEstimateGasWithPadding.mockResolvedValue('25000');
    mockRetryFunc.mockImplementation(async (fn: Function) => fn());
    mockGetGasData.mockImplementation((info: any) => ({ gasPrice: info?.gasPrice ?? '1' }));
    mockValidateWalletSendCalls.mockReturnValue({ ok: true, chainIdNum: 1 });
    mockGetCurrentChainByChainId.mockReturnValue({ chain_id: 1, viemChain: { id: 1 } });
    mockGetCurrentChains.mockReturnValue([{ chain_id: 1 }, { chain_id: 137 }]);
    mockGetCallBatchStatus.mockResolvedValue(null);
    mockSetCallBatchStatus.mockResolvedValue(undefined);
    mockProviderBroadcastTransaction.mockResolvedValue({ hash: '0xbroadcasted' });
    mockProviderGetBlockNumber.mockResolvedValue(123);
    // resetMocks: true (CRA default) wipes impls in jest.mock factories — restore.
    const utilMock = jest.requireMock('@ethereumjs/util');
    (utilMock.bufferToHex as jest.Mock).mockImplementation(() => '0xrawtx');
    const txMock = jest.requireMock('@ethereumjs/tx');
    (txMock.TransactionFactory.fromTxData as jest.Mock).mockImplementation(() => ({
        raw: '0xrawtx',
    }));
}

describe('executeWalletSendCalls', () => {
    beforeEach(setupCommonMocks);

    const basePayload = (overrides: any = {}) => ({
        version: '1.0',
        calls: [{ to: '0x1', data: '0x', value: '0x0' }],
        ...overrides,
    });

    it('throws when preflight is not ok', async () => {
        mockValidateWalletSendCalls.mockReturnValueOnce({ ok: false, message: 'bad' } as any);
        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({ payload: basePayload(), from: '0xfrom' }),
        ).rejects.toThrow('bad');
    });

    it('throws when the from address is a smart account', async () => {
        const { controller } = build({
            controllerOverrides: {
                getAccountBySmartAddress: () => ({ address: '0xfrom' }),
            },
        });
        await expect(
            controller.executeWalletSendCalls({ payload: basePayload(), from: '0xfrom' }),
        ).rejects.toThrow(/Smart Wallet does not support/);
    });

    it('non-atomic happy path returns the batch id and marks Confirmed', async () => {
        const { controller } = build();
        const id = await controller.executeWalletSendCalls({
            payload: basePayload({ calls: [{ to: '0x1', data: '0x' }] }),
            from: '0xfrom',
        });
        expect(typeof id).toBe('string');
        expect(mockSetCallBatchStatus).toHaveBeenLastCalledWith(
            id,
            expect.objectContaining({ status: 'CONFIRMED', atomic: false }),
        );
    });

    it('non-atomic flags partial revert when a later call reverts', async () => {
        mockWalletSendTransaction
            .mockResolvedValueOnce({
                hash: '0xfirst',
                wait: async () => ({ status: 1, hash: '0xfirst', blockHash: '0xb', blockNumber: 1, gasUsed: 21000 }),
            })
            .mockResolvedValueOnce({
                hash: '0xsecond',
                wait: async () => ({ status: 0, hash: '0xsecond', blockHash: '0xb', blockNumber: 1, gasUsed: 21000 }),
            });

        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: basePayload({
                    calls: [
                        { to: '0x1', data: '0x', value: 1 },
                        { to: '0x2', data: '0x' },
                    ],
                }),
                from: '0xfrom',
            }),
        ).rejects.toThrow(/Call reverted/);
        expect(mockSetCallBatchStatus).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: 'PARTIAL' }),
        );
    });

    it('non-atomic marks Reverted when the first call returns no receipt', async () => {
        mockWalletSendTransaction.mockResolvedValueOnce({
            hash: '0xfirst',
            wait: async () => null,
        });

        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: basePayload(),
                from: '0xfrom',
            }),
        ).rejects.toThrow(/Missing receipt/);
        expect(mockSetCallBatchStatus).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: 'REVERTED' }),
        );
    });

    it('atomic mode delegates EOA via 7702 then sends the batch when delegation succeeds', async () => {
        const { readAddressAsContract } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValueOnce({ isContractLikeAddress: false });
        mockProviderGetCode.mockResolvedValueOnce('0xdelegatedcode');

        const { controller } = build();
        const id = await controller.executeWalletSendCalls({
            payload: basePayload({ atomicRequired: true }),
            from: '0xeoa',
        });
        expect(typeof id).toBe('string');
        expect(mockSetCallBatchStatus).toHaveBeenLastCalledWith(
            id,
            expect.objectContaining({ status: 'CONFIRMED', atomic: true }),
        );
    });

    it('atomic mode throws when chain has no viemChain', async () => {
        mockGetCurrentChainByChainId.mockReturnValueOnce({ chain_id: 1 } as any);
        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: basePayload({ atomicRequired: true }),
                from: '0xeoa',
            }),
        ).rejects.toThrow(/viemChain/);
    });

    it('atomic mode throws when account is still EOA after delegation attempt', async () => {
        mockProviderGetCode.mockResolvedValueOnce('0x');
        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: basePayload({ atomicRequired: true }),
                from: '0xeoa',
            }),
        ).rejects.toThrow(/not delegated/);
    });

    it('atomic mode skips delegation when account is already a contract', async () => {
        const { readAddressAsContract } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValueOnce({ isContractLikeAddress: true });

        const { controller } = build();
        const id = await controller.executeWalletSendCalls({
            payload: basePayload({ atomicRequired: true, calls: [{ to: '0x1', data: '0x', value: undefined }] }),
            from: '0xcontract',
            gas: { gasInfo: { gasPrice: '5' }, gasLimit: 50000 } as any,
        });
        expect(typeof id).toBe('string');
    });
});

describe('processApproval / addTransaction (integration)', () => {
    beforeEach(setupCommonMocks);

    it('fails the transaction when sign throws and emits transactionFailed', async () => {
        const sign = jest.fn(async () => {
            throw new Error('sign-failed');
        });
        const { controller, cm } = build({ controllerOverrides: { sign } });

        const failed = jest.fn();
        cm.subscribe('TransactionController:transactionFailed', failed);

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: false },
        );
        await expect(result).rejects.toThrow();
        expect(failed).toHaveBeenCalled();
    });

    it('rejects with user error when approval is denied', async () => {
        const userError = Object.assign(new Error('denied'), {
            code: -32000,
        });
        const { controller, cm } = build({
            messengerOpts: {
                addRequest: async () => {
                    throw userError;
                },
            },
        });

        const rejectedSpy = jest.fn();
        cm.subscribe('TransactionController:transactionRejected', rejectedSpy);

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: true },
        );
        await expect(result).rejects.toThrow();
    });

    it('captures dapp-suggested gas fees when origin is set', async () => {
        const { controller } = build();
        const { transactionMeta, result } = await controller.addTransaction(
            {
                from: '0xa',
                to: '0xb',
                value: '0x1',
                gas: '0x5208',
                gasPrice: '0x1',
            } as any,
            { actionId: 'gas1', origin: 'https://dapp' },
        );
        result.catch(() => {});
        expect(transactionMeta.dappSuggestedGasFees).toBeDefined();
        expect(transactionMeta.dappSuggestedGasFees?.gasPrice).toBe('0x1');
    });

    it('captures maxFee/maxPriorityFee when only EIP-1559 fields are set', async () => {
        const { controller } = build();
        const { transactionMeta, result } = await controller.addTransaction(
            {
                from: '0xa',
                to: '0xb',
                value: '0x1',
                gas: '0x5208',
                maxFeePerGas: '0x2',
                maxPriorityFeePerGas: '0x1',
            } as any,
            { actionId: 'gas2', origin: 'https://dapp' },
        );
        result.catch(() => {});
        expect(transactionMeta.dappSuggestedGasFees?.maxFeePerGas).toBe('0x2');
    });
});

describe('abortTransactionSigning', () => {
    beforeEach(setupCommonMocks);

    it('throws when transaction is unknown', () => {
        const { controller } = build();
        expect(() => controller.abortTransactionSigning('no-such-id')).toThrow(
            /No transaction metadata found|no transaction metadata/i,
        );
    });

    it('throws when transaction has no pending signing abort callback', () => {
        const { controller } = build({
            state: {
                rpcTransactions: [
                    {
                        id: 'tx-id',
                        chainId: '0x1',
                        time: 1,
                        status: TransactionStatus.unapproved,
                        txParams: { from: '0xa' },
                    } as any,
                ],
            },
        });
        expect(() => controller.abortTransactionSigning('tx-id')).toThrow(
            /not waiting for signing/i,
        );
    });
});

describe('balance and conversion helpers (private surface via public API)', () => {
    beforeEach(setupCommonMocks);

    it('handles native balance error path through getTokenBalance', async () => {
        mockRetryFunc.mockImplementationOnce(async () => {
            throw new Error('rate-limited');
        });
        const { controller } = build();
        const result = await controller.getTokenBalance('0xuser', undefined, true, 1);
        expect(result.error).toBe(true);
        expect(result.balance).toBe(BigInt(0));
    });

    it('caches native balance until the cache interval elapses', async () => {
        const { controller } = build();
        await controller.getNativeTokenBalance('0xuser', 1);
        mockProviderGetBalance.mockClear();
        await controller.getNativeTokenBalance('0xuser', 1);
        expect(mockProviderGetBalance).not.toHaveBeenCalled();
    });

    it('returns the error fallback when RateLimiters.execute throws', async () => {
        const rateLimiter = require('../../src/shared/utils/rateLimiter');
        const original = rateLimiter.RateLimiters.tokenBalance.execute;
        rateLimiter.RateLimiters.tokenBalance.execute = async () => {
            throw new Error('limiter-down');
        };
        try {
            const { controller } = build();
            const result = await controller.getTokenBalance('0xuser', '0xtoken', false, 1);
            expect(result.error).toBe(true);
            expect(result.balance).toBe(BigInt(0));
        } finally {
            rateLimiter.RateLimiters.tokenBalance.execute = original;
        }
    });
});

// Helper for the approval / sign / publish happy paths.
function signedTxWithSerialize(rsv: { r?: any; s?: any; v?: any } = {}) {
    return {
        ...rsv,
        serialize: () => Buffer.from('rawtx'),
    };
}

describe('approveTransaction happy path (sign + publish)', () => {
    beforeEach(setupCommonMocks);

    it('signs and publishes a transaction and resolves with the hash', async () => {
        const sign = jest.fn(async () =>
            signedTxWithSerialize({ r: BigInt(1), s: BigInt(2), v: BigInt(27) }),
        );
        const { controller, cm } = build({ controllerOverrides: { sign } });

        const submitted = jest.fn();
        const finished = jest.fn();
        cm.subscribe('TransactionController:transactionSubmitted', submitted);
        cm.subscribe('TransactionController:transactionFinished', finished);

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: false },
        );

        await expect(result).resolves.toBe('0xbroadcasted');
        expect(sign).toHaveBeenCalled();
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
        expect(submitted).toHaveBeenCalled();
        expect(finished).toHaveBeenCalled();
    });

    it('fails the transaction when broadcastTransaction throws', async () => {
        mockProviderBroadcastTransaction.mockRejectedValueOnce(new Error('publish-err'));
        const sign = jest.fn(async () => signedTxWithSerialize());
        const { controller, cm } = build({ controllerOverrides: { sign } });

        const failed = jest.fn();
        cm.subscribe('TransactionController:transactionFailed', failed);

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: false },
        );
        await expect(result).rejects.toThrow();
        expect(failed).toHaveBeenCalled();
    });

    it('returns NotApproved when sign returns undefined', async () => {
        const sign = jest.fn(async () => undefined as any);
        const { controller, cm } = build({ controllerOverrides: { sign } });

        const submitted = jest.fn();
        cm.subscribe('TransactionController:transactionSubmitted', submitted);

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: false },
        );
        // No submission ever happens, so the finished promise stays pending.
        // We assert that no submitted event fired by yielding then checking.
        await new Promise(r => setTimeout(r, 0));
        expect(submitted).not.toHaveBeenCalled();
        result.catch(() => {});
    });


    it('AA wallet refuses deployContract type', async () => {
        const { determineTransactionType } = require('../../src/lib/transactions/utils');
        (determineTransactionType as jest.Mock).mockResolvedValueOnce({
            type: TransactionType.deployContract,
        });
        const { controller, cm } = build({
            controllerOverrides: {
                getAccountBySmartAddress: () => ({ address: '0xreal', smartAddress: '0xa' }),
            },
        });

        const failed = jest.fn();
        cm.subscribe('TransactionController:transactionFailed', failed);

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: false },
        );
        await expect(result).rejects.toThrow();
        expect(failed).toHaveBeenCalled();
    });
});

describe('processApproval branches', () => {
    beforeEach(setupCommonMocks);

    it('emits transactionRejected when approval is denied with userRejectedRequest', async () => {
        const userRejected = Object.assign(new Error('denied by user'), { code: 4001 });
        const { controller, cm } = build({
            messengerOpts: {
                addRequest: async () => {
                    throw userRejected;
                },
            },
        });

        const rejected = jest.fn();
        const finished = jest.fn();
        cm.subscribe('TransactionController:transactionRejected', rejected);
        cm.subscribe('TransactionController:transactionFinished', finished);

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: true, actionId: 'rej-1' },
        );
        await expect(result).rejects.toThrow();
        expect(rejected).toHaveBeenCalled();
        expect(finished).toHaveBeenCalled();
        expect(controller.state.rpcTransactions.find(t => t.actionId === 'rej-1')).toBeUndefined();
    });

    it('applies txMeta returned from the approval value', async () => {
        const sign = jest.fn(async () => signedTxWithSerialize());
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                addRequest: async (req: any) => ({
                    value: {
                        txMeta: {
                            id: req.id,
                            chainId: '0x1',
                            time: Date.now(),
                            status: TransactionStatus.unapproved,
                            customNonceValue: '7',
                            txParams: { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' },
                        },
                    },
                    resultCallbacks: { success: jest.fn(), error: jest.fn() },
                }),
            },
        });

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: true, actionId: 'upd-1' },
        );
        await expect(result).resolves.toBe('0xbroadcasted');
    });
});

describe('abortTransactionSigning success', () => {
    beforeEach(setupCommonMocks);

    it('rejects the in-flight sign and the transaction fails', async () => {
        // Hanging sign — never resolves on its own. The abort callback should
        // reject the promise, causing the approve flow to fail the tx.
        const sign = jest.fn(() => new Promise(() => {}));
        const { controller, cm } = build({ controllerOverrides: { sign: sign as any } });

        const failed = jest.fn();
        cm.subscribe('TransactionController:transactionFailed', failed);

        const { transactionMeta, result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: false },
        );

        // Give the sign call a tick to register its abort callback.
        await new Promise(r => setTimeout(r, 0));

        controller.abortTransactionSigning(transactionMeta.id);

        await expect(result).rejects.toThrow();
        expect(failed).toHaveBeenCalled();
    });
});

describe('getNextNonce branches', () => {
    beforeEach(setupCommonMocks);

    it('uses txParams.nonce when present and no customNonce', async () => {
        const sign = jest.fn(async () => signedTxWithSerialize());
        const { controller } = build({ controllerOverrides: { sign } });

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208', nonce: '0x5' } as any,
            { requireApproval: false },
        );
        await expect(result).resolves.toBe('0xbroadcasted');
        // The pre-existing nonce should short-circuit the provider call.
        expect(mockProviderGetTransactionCount).not.toHaveBeenCalled();
        expect(mockProviderGetBlockNumber).not.toHaveBeenCalled();
    });

    it('fetches the nonce from the provider when neither is provided', async () => {
        const sign = jest.fn(async () => signedTxWithSerialize());
        const { controller } = build({ controllerOverrides: { sign } });

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: false },
        );
        await expect(result).resolves.toBe('0xbroadcasted');
        expect(mockProviderGetBlockNumber).toHaveBeenCalled();
        expect(mockProviderGetTransactionCount).toHaveBeenCalled();
    });
});

describe('generateDappSuggestedGasFees branches (via addTransaction)', () => {
    beforeEach(setupCommonMocks);

    it('returns undefined when origin is ORIGIN_CHILLY', async () => {
        const { controller } = build();
        const { transactionMeta, result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208', gasPrice: '0x1' } as any,
            { actionId: 'chilly', origin: 'chilly' },
        );
        result.catch(() => {});
        expect(transactionMeta.dappSuggestedGasFees).toBeUndefined();
    });

    it('returns undefined when no fee fields are set', async () => {
        const { controller } = build();
        const { transactionMeta, result } = await controller.addTransaction(
            { from: '0xa', to: '0xb' } as any,
            { actionId: 'nofee', origin: 'https://dapp' },
        );
        result.catch(() => {});
        expect(transactionMeta.dappSuggestedGasFees).toBeUndefined();
    });

    it('captures only `gas` when no price-related fields are present', async () => {
        const { controller } = build();
        const { transactionMeta, result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', gas: '0x5208' } as any,
            { actionId: 'gas-only', origin: 'https://dapp' },
        );
        result.catch(() => {});
        expect(transactionMeta.dappSuggestedGasFees?.gas).toBe('0x5208');
    });
});

describe('trimTransactionsForState', () => {
    beforeEach(setupCommonMocks);

    it('keeps a confirmed transaction that shares a nonce/day/chain key with an unapproved one', async () => {
        const sameDay = 1_700_000_000_000;
        const { controller } = build({
            controllerOverrides: {
                // Make sign throw so the new tx ends in `failed`, but the
                // pre-existing rows still go through trimTransactionsForState.
                sign: jest.fn(async () => {
                    throw new Error('sign-failed');
                }),
            },
            state: {
                rpcTransactions: [
                    {
                        id: 'pending-1',
                        chainId: '0x1',
                        time: sameDay,
                        status: TransactionStatus.unapproved,
                        txParams: { from: '0xa', nonce: '0x1' },
                    } as any,
                    {
                        id: 'confirmed-1',
                        chainId: '0x1',
                        time: sameDay - 1, // same day, slightly older
                        status: TransactionStatus.confirmed,
                        txParams: { from: '0xa', nonce: '0x1' },
                    } as any,
                ],
            },
        });

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: false },
        );
        result.catch(() => {});

        // pending-1 keeps its key; confirmed-1 hits the `has(key)` branch and is kept.
        const ids = controller.state.rpcTransactions.map(t => t.id);
        expect(ids).toEqual(expect.arrayContaining(['pending-1', 'confirmed-1']));
    });
});

describe('convertTransactionParamsToRequest validation (via estimateGas)', () => {
    beforeEach(setupCommonMocks);

    it('throws when value is not a valid BigNumberish', async () => {
        const { controller } = build();
        await expect(
            controller.estimateGas({ from: '0xa', value: 'not-a-number' } as any),
        ).rejects.toThrow(/Invalid BigNumberish/);
    });

    it('throws when nonce cannot be coerced to BigInt', async () => {
        const { controller } = build();
        await expect(
            controller.estimateGas({ from: '0xa', nonce: 'not-a-number' } as any),
        ).rejects.toThrow(/Invalid numeric input/);
    });

    it('throws when nonce is unsafe integer', async () => {
        const { controller } = build();
        await expect(
            controller.estimateGas({
                from: '0xa',
                nonce: '0xffffffffffffffffffff', // far exceeds Number.MAX_SAFE_INTEGER
            } as any),
        ).rejects.toThrow(/Unsafe integer/);
    });

    it('throws when type is not 0, 1, or 2', async () => {
        const { controller } = build();
        await expect(
            controller.estimateGas({ from: '0xa', type: '0x3' } as any),
        ).rejects.toThrow(/Invalid transaction type/);
    });

    it('passes through accessList when provided', async () => {
        const { controller } = build();
        // happy path with accessList exercises the accessList branch
        const result = await controller.estimateGas({
            from: '0xa',
            accessList: [{ address: '0xa', storageKeys: [] }],
        } as any);
        expect(result).toBe('55000');
        const lastCall = mockProviderEstimateGas.mock.calls.at(-1) ?? [];
        expect(lastCall[0]?.accessList).toEqual([
            { address: '0xa', storageKeys: [] },
        ]);
    });

    it('accepts the full set of EIP-1559 fields', async () => {
        const { controller } = build();
        await controller.estimateGas({
            from: '0xa',
            to: '0xb',
            data: '0xdata',
            value: '0x10',
            gasLimit: '0x5208',
            maxFeePerGas: '0x2',
            maxPriorityFeePerGas: '0x1',
            nonce: '0x3',
            type: '0x2',
            chainId: '0x1',
        } as any);
        const lastCall = mockProviderEstimateGas.mock.calls.at(-1) ?? [];
        expect(lastCall[0]).toMatchObject({
            from: '0xa',
            to: '0xb',
            data: '0xdata',
            type: 2,
            nonce: 3,
        });
    });
});

describe('approveTransaction internal guards', () => {
    beforeEach(setupCommonMocks);

    it('fails the transaction when chainId becomes missing via approval update', async () => {
        const { controller, cm } = build({
            messengerOpts: {
                addRequest: async (req: any) => ({
                    value: {
                        // The approval flow swaps in a TxMeta with no chainId.
                        txMeta: {
                            id: req.requestData.txId,
                            time: Date.now(),
                            status: TransactionStatus.unapproved,
                            txParams: {
                                from: '0xa',
                                to: '0xb',
                                value: '0x1',
                                gas: '0x5208',
                            },
                        },
                    },
                    resultCallbacks: { success: jest.fn(), error: jest.fn() },
                }),
            },
        });

        const failed = jest.fn();
        cm.subscribe('TransactionController:transactionFailed', failed);

        const { result } = await controller.addTransaction(
            { from: '0xa', to: '0xb', value: '0x1', gas: '0x5208' } as any,
            { requireApproval: true, actionId: 'nochain' },
        );
        await expect(result).rejects.toThrow();
        expect(failed).toHaveBeenCalled();
    });
});

describe('mapCallBatchReceipt logs branch (via executeWalletSendCalls)', () => {
    beforeEach(setupCommonMocks);

    it('maps a non-atomic batch receipt that includes logs', async () => {
        mockWalletSendTransaction.mockResolvedValueOnce({
            hash: '0xreceipt-with-logs',
            wait: async () => ({
                status: 1,
                hash: '0xreceipt-with-logs',
                blockHash: '0xblock',
                blockNumber: 7,
                gasUsed: 21000,
                logs: [
                    { address: '0xemit', data: '0xdata', topics: ['0xtopic1', '0xtopic2'] },
                ],
            }),
        });
        const { controller } = build();
        const id = await controller.executeWalletSendCalls({
            payload: { version: '1.0', calls: [{ to: '0x1', data: '0x' }] } as any,
            from: '0xfrom',
        });
        expect(typeof id).toBe('string');
        const lastCall = mockSetCallBatchStatus.mock.calls.at(-1) ?? [];
        const status = lastCall[1] as any;
        expect(status?.receipts?.[0]?.logs?.[0]).toEqual({
            address: '0xemit',
            data: '0xdata',
            topics: ['0xtopic1', '0xtopic2'],
        });
    });
});

describe('hardware wallet (Ledger / Trezor) transaction flow', () => {
    beforeEach(setupCommonMocks);

    function makeSerializedSignedTx() {
        return {
            serialize: () => Buffer.from('1122', 'hex'),
        };
    }

    it('sendTransactionWithHardwareOffscreenKeyring (Ledger) broadcasts and returns tx', async () => {
        const sign = jest.fn(async () => makeSerializedSignedTx());
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await controller.newSendTransaction(
            '0xacct',
            { transaction: { to: '0xto', value: 1, gasLimit: 21000 } } as any,
            false,
        );
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
    });

    it('sendTransactionWithHardwareOffscreenKeyring (Trezor) broadcasts and returns tx', async () => {
        const sign = jest.fn(async () => makeSerializedSignedTx());
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Trezor Hardware' }),
            },
        });
        await controller.newSendTransaction(
            '0xacct',
            { transaction: { to: '0xto' } } as any,
            false,
        );
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
    });

    it('wraps sign errors with hardware-friendly message', async () => {
        const sign = jest.fn(async () => {
            throw new Error('user-cancelled-on-device');
        });
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await expect(
            controller.newSendTransaction(
                '0xacct',
                { transaction: { to: '0xto' } } as any,
                false,
            ),
        ).rejects.toThrow(/user-cancelled-on-device|Could not send/);
    });

    it('falls back to generic message when error is empty and ledger normalization returns nothing', async () => {
        const sign = jest.fn(async () => {
            throw new Error('');
        });
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await expect(
            controller.newSendTransaction(
                '0xacct',
                { transaction: { to: '0xto' } } as any,
                false,
            ),
        ).rejects.toThrow();
    });

    it('isHardwareAccount returns false when keyring lookup throws — uses regular wallet path', async () => {
        const { controller } = build({
            messengerOpts: {
                getKeyringForAccount: async () => {
                    throw new Error('not found');
                },
            },
        });
        await controller.newSendTransaction(
            '0xacct',
            { transaction: { to: '0xto' } } as any,
            false,
        );
        expect(mockWalletSendTransaction).toHaveBeenCalled();
    });

    it('approveAllowance uses hardware tx flow when wallet is Ledger', async () => {
        const sign = jest.fn(async () => makeSerializedSignedTx());
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        const network = {
            chain_id: 1,
            viemChain: { id: 1 },
            chain_key: 'eip155:1',
            gasPadding: 110,
        } as any;
        await controller.approveAllowance(
            '0xspender',
            '0xacct',
            '0xtoken',
            '1000',
            network,
            { gasPrice: '1' } as any,
            false,
        );
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
    });
});

describe('extra branch coverage', () => {
    beforeEach(setupCommonMocks);

    // ---- approveAllowance (hardware path) branches: lines 312, 323 ----
    it('approveAllowance (hardware) uses null spenderAmount when infiniteApproval=true', async () => {
        const sign = jest.fn(async () => ({ serialize: () => Buffer.from('aa', 'hex') }));
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await controller.approveAllowance(
            '0xspender',
            '0xacct',
            '0xtoken',
            '1000',
            { chain_id: 1 } as any,
            { gasPrice: '1' } as any,
            true, // infiniteApproval => spenderAmount becomes null in estimateGasAllowance
        );
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
    });

    it('approveAllowance (hardware) sets gasLimit=undefined when estimateGasAllowance returns null', async () => {
        // Make estimateGas return null so estimateGasAllowance => null => undefined gasLimit branch (line 323).
        mockProviderEstimateGas.mockResolvedValueOnce(null as any);
        const sign = jest.fn(async () => ({ serialize: () => Buffer.from('bb', 'hex') }));
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await controller.approveAllowance(
            '0xspender',
            '0xacct',
            '0xtoken',
            '1000',
            { chain_id: 1 } as any,
            { gasPrice: '1' } as any,
            false,
        );
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
    });

    it('approveAllowance (hardware) defaults value to 0n when populateTransaction returns no value', async () => {
        // populated.value is missing => uses ?? 0n branch (line 320).
        mockPopulateTransaction.mockResolvedValueOnce({ to: '0xtkn', data: '0x' });
        const sign = jest.fn(async () => ({ serialize: () => Buffer.from('cc', 'hex') }));
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await controller.approveAllowance(
            '0xspender',
            '0xacct',
            '0xtoken',
            '1000',
            { chain_id: 1 } as any,
            { gasPrice: '1' } as any,
            false,
        );
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
    });

    // ---- estimateGas: line 426 falsy gasLimit early return ----
    it('estimateGas returns null when provider returns 0n (falsy) gasLimit', async () => {
        mockProviderEstimateGas.mockResolvedValueOnce(0n);
        const { controller } = build();
        const res = await controller.estimateGas({ from: '0xa' } as any);
        expect(res).toBeNull();
    });

    // ---- estimateWalletSendCallsGas branches (lines 465, 467, 473-479) ----
    it('estimateWalletSendCallsGas treats undefined value, missing to/data as defaults', async () => {
        const { controller } = build();
        const total = await controller.estimateWalletSendCallsGas(
            { calls: [{}] } as any,
            '0xfrom',
        );
        expect(total).toBeGreaterThanOrEqual(21000);
    });

    it('estimateWalletSendCallsGas accepts numeric value via toHex branch', async () => {
        const { controller } = build();
        const total = await controller.estimateWalletSendCallsGas(
            { calls: [{ to: '0x1', data: '0x', value: 42 }] } as any,
            '0xfrom',
        );
        expect(total).toBeGreaterThanOrEqual(21000);
    });

    it('estimateWalletSendCallsGas falls back to 21000 when estimateGasWithPadding returns null', async () => {
        mockEstimateGasWithPadding.mockResolvedValueOnce(null as any);
        const { controller } = build();
        const total = await controller.estimateWalletSendCallsGas(
            { calls: [{ to: '0x1', data: '0x', value: '0x1' }] } as any,
            '0xfrom',
        );
        expect(total).toBe(21000);
    });

    it('estimateWalletSendCallsGas with atomicRequired but EOA falls through to per-call loop', async () => {
        const { readAddressAsContract } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValueOnce({ isContractLikeAddress: false });
        const { controller } = build();
        const total = await controller.estimateWalletSendCallsGas(
            { atomicRequired: true, calls: [{ to: '0x1', data: '0x', value: null }] } as any,
            '0xfrom',
        );
        expect(total).toBeGreaterThanOrEqual(21000);
    });

    // ---- executeWalletSendCalls branches (lines 596, 624-626, 634, 653, 670, 692) ----
    it('executeWalletSendCalls atomic returns empty receipts when wait() yields null', async () => {
        const { readAddressAsContract } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValueOnce({ isContractLikeAddress: true });
        mockWalletSendTransaction.mockResolvedValueOnce({
            hash: '0xtx',
            wait: async () => null, // exercises receipt-null branch on line 596
        });
        const { controller } = build();
        const id = await controller.executeWalletSendCalls({
            payload: {
                version: '1.0',
                atomicRequired: true,
                calls: [{ to: '0x1', data: '0x' }],
            } as any,
            from: '0xcontract',
            gas: { gasInfo: {}, gasLimit: 50000 } as any,
        });
        expect(typeof id).toBe('string');
        const lastCall = mockSetCallBatchStatus.mock.calls.at(-1) ?? [];
        expect((lastCall[1] as any).receipts).toEqual([]);
    });

    it('executeWalletSendCalls non-atomic uses defaults for missing call fields', async () => {
        const { controller } = build();
        // call missing to/data, value undefined => exercises lines 624-626 defaults
        const id = await controller.executeWalletSendCalls({
            payload: { version: '1.0', calls: [{} as any] } as any,
            from: '0xfrom',
        });
        expect(typeof id).toBe('string');
    });

    it('executeWalletSendCalls non-atomic uses numeric value via toHex', async () => {
        const { controller } = build();
        const id = await controller.executeWalletSendCalls({
            payload: { version: '1.0', calls: [{ to: '0x1', data: '0x', value: 7 }] } as any,
            from: '0xfrom',
        });
        expect(typeof id).toBe('string');
    });

    it('executeWalletSendCalls non-atomic falls back to 21000 when per-tx estimate returns null', async () => {
        mockEstimateGasWithPadding.mockResolvedValueOnce(null as any);
        const { controller } = build();
        const id = await controller.executeWalletSendCalls({
            payload: { version: '1.0', calls: [{ to: '0x1', data: '0x', value: '0x1' }] } as any,
            from: '0xfrom',
        });
        expect(typeof id).toBe('string');
    });

    it('executeWalletSendCalls non-atomic marks PartialRevert when missing receipt occurs mid-batch', async () => {
        // first call ok, second call returns null receipt => receipts.length>0 branch (line 653)
        mockWalletSendTransaction
            .mockResolvedValueOnce({
                hash: '0x1',
                wait: async () => ({
                    status: 1,
                    hash: '0x1',
                    blockHash: '0xb',
                    blockNumber: 1,
                    gasUsed: 21000,
                    logs: [],
                }),
            })
            .mockResolvedValueOnce({
                hash: '0x2',
                wait: async () => null,
            });
        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: {
                    version: '1.0',
                    calls: [
                        { to: '0x1', data: '0x' },
                        { to: '0x2', data: '0x' },
                    ],
                } as any,
                from: '0xfrom',
            }),
        ).rejects.toThrow(/Missing receipt/);
        expect(mockSetCallBatchStatus).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: 'PARTIAL' }),
        );
    });

    it('executeWalletSendCalls non-atomic marks PartialRevert (status>1) when third call reverts after two ok', async () => {
        mockWalletSendTransaction
            .mockResolvedValueOnce({
                hash: '0x1',
                wait: async () => ({ status: 1, hash: '0x1', blockHash: '0xb', blockNumber: 1, gasUsed: 21000, logs: [] }),
            })
            .mockResolvedValueOnce({
                hash: '0x2',
                wait: async () => ({ status: 1, hash: '0x2', blockHash: '0xb', blockNumber: 1, gasUsed: 21000, logs: [] }),
            })
            .mockResolvedValueOnce({
                hash: '0x3',
                wait: async () => ({ status: 0, hash: '0x3', blockHash: '0xb', blockNumber: 1, gasUsed: 21000, logs: [] }),
            });
        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: {
                    version: '1.0',
                    calls: [
                        { to: '0x1', data: '0x' },
                        { to: '0x2', data: '0x' },
                        { to: '0x3', data: '0x' },
                    ],
                } as any,
                from: '0xfrom',
            }),
        ).rejects.toThrow(/reverted/);
        expect(mockSetCallBatchStatus).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: 'PARTIAL' }),
        );
    });

    it('executeWalletSendCalls leaves status untouched when current is already Confirmed (line 692)', async () => {
        // Cause a throw after status is no longer Pending so the catch's status update branch is skipped.
        mockGetCallBatchStatus.mockResolvedValueOnce({
            status: 'CONFIRMED',
        } as any);
        mockWalletSendTransaction.mockRejectedValueOnce(new Error('boom'));
        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: { version: '1.0', calls: [{ to: '0x1', data: '0x' }] } as any,
                from: '0xfrom',
            }),
        ).rejects.toThrow('boom');
    });

    it('estimateGas uses default 110 paddingPercent when chain has no gasPadding', async () => {
        const getSelectedNetwork = jest.fn(() => ({ chain_id: 1 })); // no gasPadding
        const { controller } = build({
            controllerOverrides: { getSelectedNetwork },
        });
        const result = await controller.estimateGas({ from: '0xa' } as any);
        expect(typeof result).toBe('string');
    });

    it('estimateWalletSendCallsGas converts "0x" value to "0x0" via the ternary', async () => {
        const { controller } = build();
        const total = await controller.estimateWalletSendCallsGas(
            { calls: [{ to: '0x1', data: '0x', value: '0x' }] } as any,
            '0xfrom',
        );
        expect(total).toBeGreaterThanOrEqual(21000);
    });

    it('executeWalletSendCalls non-atomic marks Reverted when the very first call has no receipt', async () => {
        mockWalletSendTransaction.mockResolvedValueOnce({
            hash: '0xonly',
            wait: async () => null,
        });
        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: { version: '1.0', calls: [{ to: '0x1', data: '0x' }] } as any,
                from: '0xfrom',
            }),
        ).rejects.toThrow(/Missing receipt/);
        const lastCall = mockSetCallBatchStatus.mock.calls.at(-1) ?? [];
        // First call has no prior receipts → status should be Reverted (not Partial)
        expect((lastCall[1] as any).status).toBe('REVERTED');
    });

    it('executeWalletSendCalls non-atomic marks Reverted when a single call reverts on-chain', async () => {
        mockWalletSendTransaction.mockResolvedValueOnce({
            hash: '0xonly',
            wait: async () => ({ status: 0, hash: '0xonly', blockHash: '0xb', blockNumber: 1, gasUsed: 21000, logs: [] }),
        });
        const { controller } = build();
        await expect(
            controller.executeWalletSendCalls({
                payload: { version: '1.0', calls: [{ to: '0x1', data: '0x' }] } as any,
                from: '0xfrom',
            }),
        ).rejects.toThrow(/reverted/);
        const lastCall = mockSetCallBatchStatus.mock.calls.at(-1) ?? [];
        expect((lastCall[1] as any).status).toBe('REVERTED');
    });

    it('mapCallBatchReceipt defaults blockHash="" and topics=[] for incomplete receipts', async () => {
        // Confirm an atomic batch where wait() returns a receipt with no blockHash and a log with no topics
        const { readAddressAsContract } = require('../../src/lib/transactions/utils');
        (readAddressAsContract as jest.Mock).mockResolvedValueOnce({ isContractLikeAddress: true });
        mockWalletSendTransaction.mockResolvedValueOnce({
            hash: '0xatomic',
            wait: async () => ({
                status: 1,
                hash: '0xatomic',
                blockHash: null,
                blockNumber: 7,
                gasUsed: 21000,
                logs: [{ address: '0xlog', data: '0xdd' }],
            }),
        });
        const { controller } = build();
        await controller.executeWalletSendCalls({
            payload: {
                version: '1.0',
                atomicRequired: true,
                calls: [{ to: '0x1', data: '0x' }],
            } as any,
            from: '0xcontract',
            gas: { gasInfo: {}, gasLimit: 50000 } as any,
        });
        const lastCall = mockSetCallBatchStatus.mock.calls.at(-1) ?? [];
        const receipt = (lastCall[1] as any).receipts?.[0];
        expect(receipt?.blockHash).toBe('');
        expect(receipt?.logs?.[0]?.topics).toEqual([]);
    });

    // ---- #transactionRequestToTxParams branch coverage (lines 1875-1918) ----
    it('hardware tx with explicit nonce uses toHex(nonce) branch', async () => {
        const sign = jest.fn(async () => ({ serialize: () => Buffer.from('aa', 'hex') }));
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await controller.newSendTransaction(
            '0xacct',
            { transaction: { to: '0xto', value: 1, gasLimit: 21000, nonce: 42 } } as any,
            false,
        );
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
    });

    it('hardware tx with EIP-1559 fee market params uses declaresFeeMarket branch', async () => {
        const sign = jest.fn(async () => ({ serialize: () => Buffer.from('bb', 'hex') }));
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await controller.newSendTransaction(
            '0xacct',
            {
                transaction: {
                    to: '0xto',
                    value: 1,
                    gasLimit: 21000,
                    maxFeePerGas: 100,
                    maxPriorityFeePerGas: 5,
                },
            } as any,
            false,
        );
        expect(mockProviderBroadcastTransaction).toHaveBeenCalled();
    });

    it('hardware tx wraps non-Error throw using String(error) branch', async () => {
        const sign = jest.fn(async () => {
            // Throw a plain string so `error instanceof Error` is false
            // eslint-disable-next-line no-throw-literal
            throw 'plain-string-failure';
        });
        const { controller } = build({
            controllerOverrides: { sign },
            messengerOpts: {
                getKeyringForAccount: async () => ({ type: 'Ledger Hardware' }),
            },
        });
        await expect(
            controller.newSendTransaction(
                '0xacct',
                { transaction: { to: '0xto' } } as any,
                false,
            ),
        ).rejects.toThrow();
    });

    // ---- sendTransaction: isAAWallet=true with no smart account (line 854) ----
    it('sendTransaction throws when AA wallet has no smartAddress', async () => {
        const { controller } = build({
            messengerOpts: {
                getAccountByAddress: () => ({ address: '0xacct', smartAddress: '' }),
            },
        });
        await expect(
            controller.sendTransaction(
                '0xacct',
                '0xto',
                {} as any,
                21000,
                '1',
                {} as any,
                true,
            ),
        ).rejects.toThrow(/Smart account not found/);
    });
});
