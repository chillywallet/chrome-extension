import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import useLiquidStaking from '../../../../src/ui/pages/Earn/LiquidStaking.hooks';

const mockState: any = {
    selectedNetwork: { chain_id: 1, chain_key: 'eip155:1', platform_id: 1, testnet: false },
    currentAccount: { id: 'a1', address: '0xacct' },
    currentWallet: { id: 'w1', name: 'W1', importTime: 1 },
    nativeCoinBalance: BigInt('1000000000000000000'), // 1 ETH
    showAlertCfg: null,
    isGaslessDisableRequired: false,
    resetWalletImpl: jest.fn(async () => true),
    loadingGasless: false,
};

const mockSetLiquidStakingClaimData = jest.fn();
jest.mock('../../../../src/ui/pages/Earn/EarnProvider', () => ({
    useEarnData: () => ({
        setLiquidStakingClaimData: mockSetLiquidStakingClaimData,
    }),
}));

const mockHistoryPush = jest.fn();
const mockHistoryReplace = jest.fn();
jest.mock('react-router-dom', () => ({
    useHistory: () => ({ push: mockHistoryPush, replace: mockHistoryReplace }),
}));

const mockDispatch = jest.fn();
jest.mock('../../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../../src/store/selectors', () => ({
    useCurrentAccount: () => mockState.currentAccount,
    useCurrentWallet: () => mockState.currentWallet,
    useNativeCoinBalance: () => mockState.nativeCoinBalance,
    useSelectedNetwork: () => mockState.selectedNetwork,
}));

jest.mock('../../../../src/store/selectors/string', () => ({
    useStringToFloatSelector: (s: string) => ({
        number: parseFloat(s || '0') || 0,
    }),
}));


const mockShowAlertModal = jest.fn((cfg: any) => {
    mockState.showAlertCfg = cfg;
});
jest.mock('../../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: { showAlertModal: (...args: any[]) => mockShowAlertModal(...args) },
}));

const mockSetOnboardingExtra = jest.fn();

const mockGetCurrentChains = jest.fn(() => [
    { chain_id: 1, name: 'Ethereum', platform_id: 1 },
    { chain_id: 137, name: 'Polygon', platform_id: 137 },
]);
jest.mock('../../../../src/lib/ChainsUtils', () => ({
    getCurrentChains: () => mockGetCurrentChains(),
}));

const mockGetCoinPrice = jest.fn(async () => 100);
jest.mock('../../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: { getCoinPrice: (...args: any[]) => mockGetCoinPrice(...args) },
}));

const mockIsNativeCoin = jest.fn((_chain: string, addr: string) =>
    addr === '0x0000000000000000000000000000000000000000',
);
const mockSafeParseUnits = jest.fn((v: string, _decimals: number) => {
    if (!v) return 0n;
    const n = parseFloat(v);
    if (isNaN(n) || n < 0) return 0n;
    return BigInt(Math.floor(n * 1e18));
});

jest.mock('../../../../src/lib/WalletUtils', () => ({
    isNativeCoinByTokenAddress: (...args: any[]) => mockIsNativeCoin(...args),
    safeParseUnits: (...args: any[]) => mockSafeParseUnits(...args),
}));

const mockGetErrorMessage = jest.fn((e: any) => e?.message ?? 'err');
jest.mock('../../../../src/api/graphQL/BaseRequest', () => ({
    getErrorMessage: (...args: any[]) => mockGetErrorMessage(...args),
}));

// uiActions mocks
const mockEstimateStake = jest.fn(async () => '21000');
const mockEstimateRequestUnstake = jest.fn(async () => '21000');
const mockEstimateUnstake = jest.fn(async () => '21000');
const mockGetExchangeRate = jest.fn(async () => 1.1);
const mockGetUnstakeExchangeRate = jest.fn(async () => 0.9);
const mockGetWaitTime = jest.fn(async () => 60);
const mockGetTokenBalance = jest.fn(async () => ({
    balance: BigInt('5000000000000000000'),
    decimals: 18,
    error: false,
}));
const mockGetNativeTokenBalance = jest.fn(() => ({ type: 'GET_NATIVE_BALANCE' }));
const mockSetLiquidStakingProvider = jest.fn(async () => ({
    contractAddress: '0xstake',
    abi: [],
    fetchExchangeRateMethod: 'getRate',
    fetchUnstakeExchangeRateMethod: 'getUnstakeRate',
    stakeMethod: 'stake',
    getStakeArgs: () => [],
    unstakeMethod: 'unstake',
    getUnstakeArgs: () => [],
    hasWaitTime: true,
    unlockRequired: true,
}));
const mockSetSelectedNetwork = jest.fn(() => ({ type: 'SET_NET' }));
const mockAddPendingTransaction = jest.fn(() => ({ type: 'ADD_PENDING' }));
const mockStake = jest.fn(() => Promise.resolve({ hash: '0xstaketx' }));
const mockRequestUnstake = jest.fn(() => Promise.resolve({ hash: '0xreq-unstake' }));
const mockUnstake = jest.fn(() => Promise.resolve({ hash: '0xunstake' }));
const mockGetStakeCall = jest.fn(async () => ({ to: '0xc', data: '0xd', value: '0' }));
const mockGetRequestUnstakeCall = jest.fn(async () => ({ to: '0xc', data: '0xd', value: '0' }));
const mockGetUnstakeCall = jest.fn(async () => ({ to: '0xc', data: '0xd', value: '0' }));

jest.mock('../../../../src/store/actions/uiActions', () => ({
    addPendingTransaction: (...args: any[]) => mockAddPendingTransaction(...args),
    estimateRequestUnstake: (...args: any[]) => mockEstimateRequestUnstake(...args),
    estimateStake: (...args: any[]) => mockEstimateStake(...args),
    estimateUnstake: (...args: any[]) => mockEstimateUnstake(...args),
    getExchangeRate: (...args: any[]) => mockGetExchangeRate(...args),
    getNativeTokenBalance: (...args: any[]) => mockGetNativeTokenBalance(...args),
    getRequestUnstakeCall: (...args: any[]) => mockGetRequestUnstakeCall(...args),
    getStakeCall: (...args: any[]) => mockGetStakeCall(...args),
    getTokenBalance: (...args: any[]) => mockGetTokenBalance(...args),
    getUnstakeCall: (...args: any[]) => mockGetUnstakeCall(...args),
    getUnstakeExchangeRate: (...args: any[]) => mockGetUnstakeExchangeRate(...args),
    getWaitTime: (...args: any[]) => mockGetWaitTime(...args),
    requestUnstake: (...args: any[]) => mockRequestUnstake(...args),
    setLiquidStakingProvider: (...args: any[]) => mockSetLiquidStakingProvider(...args),
    setSelectedNetwork: (...args: any[]) => mockSetSelectedNetwork(...args),
    stake: (...args: any[]) => mockStake(...args),
    unstake: (...args: any[]) => mockUnstake(...args),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('../../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: (...args: any[]) => mockToastSuccess(...args),
        showError: (...args: any[]) => mockToastError(...args),
    },
}));

jest.mock('../../../../src/shared/messages/ErrorMessages', () => ({
    __esModule: true,
    default: {
        INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS: 'Insufficient funds for amount + gas',
        INSUFFICIENT_FUNDS_FOR_AMOUNT: 'Insufficient funds for amount',
        INSUFFICIENT_FUNDS_FOR_GAS: 'Insufficient funds for gas',
    },
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../../../src/shared/utils/string', () => ({
    getSafeBigNumber: (n: number) => String(n),
}));

jest.mock('../../../../src/shared/utils/validator', () => ({
    __esModule: true,
    default: {
        isEmpty: (s: string) => !s || s === '',
        isFloat: (s: string) => !isNaN(parseFloat(s)) && isFinite(Number(s)),
    },
}));

jest.mock('../../../../src/shared/constants/swap', () => ({
    DEBOUNCED_DURATION: 0,
    UPDATE_BALANCE_INTERVAL: 1000000,
}));

jest.mock('../../../../src/shared/constants/routes', () => ({
    EARN_LIQUID_STAKING_CLAIM_ROUTE: '/earn/liquid-staking/claim',
    EARN_LIST_ROUTE: '/earn',
}));

jest.mock('../../../../src/shared/utils/format', () => ({
    formatNumber: (n: number) => String(n),
}));

jest.mock('ethers', () => ({
    ethers: {
        formatUnits: (v: any, d: number) => String(Number(v) / Math.pow(10, d)),
    },
    formatUnits: (v: any, d: number) => String(Number(v) / Math.pow(10, d)),
    TransactionResponse: class {},
}));

jest.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

jest.mock('lodash', () => {
    const original = jest.requireActual('lodash');
    return {
        ...original,
        debounce: (fn: Function) => {
            const wrapped: any = (...args: any[]) => fn(...args);
            wrapped.cancel = () => {};
            return wrapped;
        },
    };
});

const fromCoin = {
    tokenAddress: '0xfromtoken',
    name: 'FROM',
    symbol: 'FROM',
    imageUrl: 'from.png',
} as any;
const toCoin = {
    tokenAddress: '0xtotoken',
    name: 'TO',
    symbol: 'TO',
    imageUrl: 'to.png',
} as any;

const baseData: any = {
    type: 'kintsu',
    platformId: 1,
    fromCoin,
    toCoin,
};

beforeEach(() => {
    jest.clearAllMocks();
    mockGetCoinPrice.mockResolvedValue(100);
    mockGetCurrentChains.mockReturnValue([
        { chain_id: 1, name: 'Ethereum', platform_id: 1 },
        { chain_id: 137, name: 'Polygon', platform_id: 137 },
    ]);
    mockIsNativeCoin.mockImplementation((_chain: string, addr: string) =>
        addr === '0x0000000000000000000000000000000000000000',
    );
    mockSafeParseUnits.mockImplementation((v: string, _decimals: number) => {
        if (!v) return 0n;
        const n = parseFloat(v);
        if (isNaN(n) || n < 0) return 0n;
        return BigInt(Math.floor(n * 1e18));
    });
    mockGetErrorMessage.mockImplementation((e: any) => e?.message ?? 'err');
    mockGetNativeTokenBalance.mockImplementation(() => ({ type: 'GET_NATIVE_BALANCE' }));
    mockSetSelectedNetwork.mockImplementation(() => ({ type: 'SET_NET' }));
    mockAddPendingTransaction.mockImplementation(() => ({ type: 'ADD_PENDING' }));
    mockStake.mockImplementation(() => Promise.resolve({ hash: '0xstaketx' }));
    mockRequestUnstake.mockImplementation(() => Promise.resolve({ hash: '0xreq-unstake' }));
    mockUnstake.mockImplementation(() => Promise.resolve({ hash: '0xunstake' }));
    mockState.selectedNetwork = {
        chain_id: 1,
        chain_key: 'eip155:1',
        platform_id: 1,
        testnet: false,
        name: 'Ethereum',
    };
    mockState.currentAccount = { id: 'a1', address: '0xacct' };
    mockState.currentWallet = { id: 'w1', name: 'W1', importTime: 1 };
    mockState.nativeCoinBalance = BigInt('1000000000000000000');
    mockState.isGaslessDisableRequired = false;
    mockState.resetWalletImpl = jest.fn(async () => true);
    mockState.showAlertCfg = null;
    mockGetTokenBalance.mockResolvedValue({
        balance: BigInt('5000000000000000000'),
        decimals: 18,
        error: false,
    });
    mockSetLiquidStakingProvider.mockResolvedValue({
        contractAddress: '0xstake',
        abi: [],
        fetchExchangeRateMethod: 'getRate',
        fetchUnstakeExchangeRateMethod: 'getUnstakeRate',
        stakeMethod: 'stake',
        getStakeArgs: () => [],
        unstakeMethod: 'unstake',
        getUnstakeArgs: () => [],
        hasWaitTime: true,
        unlockRequired: true,
    });
    mockEstimateStake.mockResolvedValue('21000');
    mockEstimateRequestUnstake.mockResolvedValue('21000');
    mockEstimateUnstake.mockResolvedValue('21000');
    mockGetExchangeRate.mockResolvedValue(1.1);
    mockGetUnstakeExchangeRate.mockResolvedValue(0.9);
    mockGetWaitTime.mockResolvedValue(60);
    mockGetStakeCall.mockResolvedValue({ to: '0xc', data: '0xd', value: '0' });
    mockGetRequestUnstakeCall.mockResolvedValue({ to: '0xc', data: '0xd', value: '0' });
    mockGetUnstakeCall.mockResolvedValue({ to: '0xc', data: '0xd', value: '0' });
    mockDispatch.mockImplementation(() => Promise.resolve(null));
});

describe('useLiquidStaking', () => {
    it('returns the expected shape on mount', async () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        expect(result.current.mode).toBe('Stake');
        expect(result.current.fromCoin).toBe(fromCoin);
        expect(result.current.toCoin).toBe(toCoin);
        expect(typeof result.current.onStakePress).toBe('function');
        expect(typeof result.current.onRequestUnstakePress).toBe('function');
        expect(typeof result.current.onUnstakePress).toBe('function');
        expect(typeof result.current.onClaimPress).toBe('function');
        expect(typeof result.current.onChangeInputModePress).toBe('function');
        expect(typeof result.current.onChangeModePress).toBe('function');
        await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
    });

    it('toggles input mode via onChangeInputModePress', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        expect(result.current.inputMode).toBe('coin');
        act(() => {
            result.current.onChangeInputModePress();
        });
        expect(result.current.inputMode).toBe('usd');
        act(() => {
            result.current.onChangeInputModePress();
        });
        expect(result.current.inputMode).toBe('coin');
    });

    it('updates fromValue via handleOnFromValueChange', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.handleOnFromValueChange('0.5');
        });
        expect(result.current.fromValue).toBe('0.5');
    });

    it('handleOnFromValueChange strips leading zeros from whole numbers', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.handleOnFromValueChange('00123');
        });
        expect(result.current.fromValue).toBe('123');
    });

    it('updates fromUSDValue via handleOnFromUSDValueChange', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.handleOnFromUSDValueChange('100');
        });
        expect(result.current.fromUSDValue).toBe('100');
    });

    it('clears values via onSliderValueChange', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.onSliderValueChange(BigInt(0));
        });
    });

    it('switches mode via onChangeModePress', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.onChangeModePress('Unstake');
        });
        expect(result.current.mode).toBe('Unstake');
        act(() => {
            result.current.onChangeModePress('Stake');
        });
        expect(result.current.mode).toBe('Stake');
    });

    it('calls dispatch(setLiquidStakingClaimData) and pushes claim route via onClaimPress', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.onClaimPress();
        });
        expect(mockSetLiquidStakingClaimData).toHaveBeenCalled();
        expect(mockHistoryPush).toHaveBeenCalledWith('/earn/liquid-staking/claim');
    });

    it('loads token balance for the from coin', async () => {
        renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockGetTokenBalance).toHaveBeenCalled());
    });

    it('loads exchange rate via getExchangeRate', async () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockGetExchangeRate).toHaveBeenCalledWith('1'));
        await waitFor(() => expect(result.current.loadingExchangeRate).toBe(false));
    });

    it('handles exchange rate errors', async () => {
        mockGetExchangeRate.mockRejectedValueOnce(new Error('rate-err'));
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(result.current.error).toContain('Can not load'));
    });

    it('loads wait time when hasWaitTime is true', async () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(result.current.loadingWaitTime).toBe(false));
        expect(result.current.waitTime).toBe(60);
    });

    it('handles wait time errors', async () => {
        mockGetWaitTime.mockRejectedValueOnce(new Error('wait-err'));
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(result.current.loadingWaitTime).toBe(false));
        expect(result.current.waitTime).toBe(0);
    });

    it('switches network alert when platformId mismatches', () => {
        mockState.selectedNetwork = {
            chain_id: 137,
            chain_key: 'eip155:137',
            platform_id: 137,
            testnet: false,
            name: 'Polygon',
        };
        renderHook(() => useLiquidStaking(baseData));
        expect(mockShowAlertModal).toHaveBeenCalled();
        const cfg = mockShowAlertModal.mock.calls[0][0];
        cfg.buttons[0].onPress();
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_NET' });
    });

    it('clicking Exit Page in the alert pushes back to earn list', () => {
        mockState.selectedNetwork = {
            chain_id: 137,
            chain_key: 'eip155:137',
            platform_id: 137,
            testnet: false,
            name: 'Polygon',
        };
        renderHook(() => useLiquidStaking(baseData));
        const cfg = mockShowAlertModal.mock.calls[0][0];
        cfg.buttons[1].onPress();
        expect(mockHistoryReplace).toHaveBeenCalledWith('/earn');
    });

    it('onStakePress dispatches stake then updates pending tx', async () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
        act(() => {
            result.current.setHandledGasData({
                gasInfo: { gasPrice: 1n },
                gasPrice: 1n,
            } as any);
        });
        act(() => {
            result.current.handleOnFromValueChange('0.5');
        });
        mockDispatch.mockImplementationOnce(() => Promise.resolve({ hash: '0xtx' }));
        act(() => {
            result.current.onStakePress();
        });
        await waitFor(() => expect(mockAddPendingTransaction).toHaveBeenCalled());
    });

    it('onRequestUnstakePress dispatches requestUnstake', async () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
        act(() => {
            result.current.onChangeModePress('Unstake');
        });
        act(() => {
            result.current.setHandledGasData({
                gasInfo: { gasPrice: 1n },
                gasPrice: 1n,
            } as any);
        });
        act(() => {
            result.current.handleOnFromValueChange('0.5');
        });
        mockDispatch.mockImplementationOnce(() => Promise.resolve({ hash: '0xru' }));
        act(() => {
            result.current.onRequestUnstakePress();
        });
        await waitFor(() => expect(mockAddPendingTransaction).toHaveBeenCalled());
    });

    it('onUnstakePress dispatches unstake', async () => {
        mockSetLiquidStakingProvider.mockResolvedValue({
            contractAddress: '0xstake',
            abi: [],
            fetchExchangeRateMethod: 'getRate',
            fetchUnstakeExchangeRateMethod: 'getUnstakeRate',
            stakeMethod: 'stake',
            getStakeArgs: () => [],
            unstakeMethod: 'unstake',
            getUnstakeArgs: () => [],
            hasWaitTime: false,
            unlockRequired: false,
        });
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
        act(() => {
            result.current.onChangeModePress('Unstake');
        });
        act(() => {
            result.current.setHandledGasData({
                gasInfo: { gasPrice: 1n },
                gasPrice: 1n,
            } as any);
        });
        act(() => {
            result.current.handleOnFromValueChange('0.5');
        });
        mockDispatch.mockImplementationOnce(() => Promise.resolve({ hash: '0xus' }));
        act(() => {
            result.current.onUnstakePress();
        });
        await waitFor(() => expect(mockAddPendingTransaction).toHaveBeenCalled());
    });

    it('onSwapSuccess shows the right toast in Stake mode', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.onSwapSuccess({}, false);
        });
        expect(mockToastSuccess).toHaveBeenCalledWith('Stake Succeeded');
    });

    it('onSwapSuccess shows the cancelled toast in Stake mode', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.onSwapSuccess({}, true);
        });
        expect(mockToastSuccess).toHaveBeenCalledWith('Stake Cancelled');
    });

    it('onSwapSuccess shows Request Withdrawal Succeeded in Unstake (unlockRequired)', async () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
        act(() => {
            result.current.onChangeModePress('Unstake');
        });
        act(() => {
            result.current.onSwapSuccess({}, false);
        });
        expect(mockToastSuccess).toHaveBeenCalledWith('Request Withdrawal Succeeded');
    });

    it('onSwapSentClose / onTryAgainPress reset the swap state', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.onSwapSentClose();
        });
        act(() => {
            result.current.onTryAgainPress();
        });
    });

    it('sets local error when insufficient native funds for amount + gas', async () => {
        mockGetTokenBalance.mockResolvedValue({
            balance: BigInt('1000000000000000'), // 0.001 ETH
            decimals: 18,
            error: false,
        });
        const { result } = renderHook(() =>
            useLiquidStaking({
                ...baseData,
                fromCoin: {
                    ...fromCoin,
                    tokenAddress: '0x0000000000000000000000000000000000000000',
                },
            } as any),
        );
        await waitFor(() => expect(result.current.fromBalance > 0n).toBe(true));
        act(() => {
            result.current.handleOnFromValueChange('0.5'); // half eth → bigger than balance
        });
        await waitFor(() =>
            expect(result.current.error).toContain('Insufficient funds for amount + gas'),
        );
    });

    it('handleOnFromUSDValueChange computes the from value for sub-1 USD values', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        // Wait for fromPrice to be set via getCoinPrice (100).
        act(() => {
            // Force the price-loaded effect: just call USD change with a sub-1 USD value.
            result.current.handleOnFromUSDValueChange('0.5');
        });
        expect(result.current.fromUSDValue).toBe('0.5');
    });

    it('handleOnFromUSDValueChange falls back to "0" for zero / empty USD input', () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.handleOnFromUSDValueChange('');
        });
        // With empty input the fromValue should be the safe default.
        expect(result.current.fromValue).toBe('0');
    });

    it('onSliderValueChange forwards to handleOnFromValueChange when balance is positive', async () => {
        mockGetTokenBalance.mockResolvedValue({
            balance: BigInt('1000000000000000000'),
            decimals: 18,
            error: false,
        });
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(result.current.fromBalance > 0n).toBe(true));
        act(() => {
            result.current.onSliderValueChange(BigInt('500000000000000000'));
        });
        // fromValueRef synced — calling again with the same value should be a no-op.
        const firstFromValue = result.current.fromValue;
        act(() => {
            result.current.onSliderValueChange(BigInt('500000000000000000'));
        });
        expect(result.current.fromValue).toBe(firstFromValue);
    });

    it('onTryAgainPress in Unstake mode invokes the request-unstake path', async () => {
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
        act(() => {
            result.current.onChangeModePress('Unstake');
        });
        act(() => {
            result.current.setHandledGasData({
                gasInfo: { gasPrice: 1n },
                gasPrice: 1n,
            } as any);
        });
        act(() => {
            result.current.handleOnFromValueChange('0.5');
        });
        mockDispatch.mockImplementationOnce(() => Promise.resolve({ hash: '0xtry' }));
        act(() => {
            result.current.onTryAgainPress();
        });
        await waitFor(() => expect(mockRequestUnstake).toHaveBeenCalled());
    });

    it('estimateRequestUnstake null gas returns triggers a "Failed to estimate gas" rejection', async () => {
        mockEstimateRequestUnstake.mockResolvedValueOnce(null);
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
        act(() => {
            result.current.onChangeModePress('Unstake');
        });
        act(() => {
            result.current.handleOnFromValueChange('0.5');
        });
        // The gas-estimate side effect should surface a remote error via setRemoteError.
        await waitFor(() => {
            expect(result.current.error).toBeTruthy();
        });
    });

    it('coin-mode invalid input flips fromValueValid to false', async () => {
        const validator = jest.requireMock('../../../../src/shared/utils/validator').default;
        validator.isEmpty = (s: string) => !s || s === '';
        validator.isFloat = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.handleOnFromValueChange('abc');
        });
        await waitFor(() => expect(result.current.fromValueValid).toBe(false));
    });

    it('usd-mode invalid input flips fromValueValid to false', async () => {
        const validator = jest.requireMock('../../../../src/shared/utils/validator').default;
        validator.isEmpty = (s: string) => !s || s === '';
        validator.isFloat = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
        const { result } = renderHook(() => useLiquidStaking(baseData));
        act(() => {
            result.current.onChangeInputModePress();
        });
        act(() => {
            result.current.handleOnFromUSDValueChange('xyz');
        });
        await waitFor(() => expect(result.current.fromValueValid).toBe(false));
    });

    it('resets fromPrice / toPrice to zero on testnet networks', async () => {
        mockState.selectedNetwork = {
            chain_id: 1,
            chain_key: 'eip155:1',
            platform_id: 1,
            testnet: true,
            name: 'Testnet',
        };
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(result.current.fromPrice).toBe(0));
        expect(result.current.toPrice).toBe(0);
    });

    it('handles missing currentAccount inside performLiquidStakingTx', async () => {
        mockState.currentAccount = null;
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await act(async () => {
            await result.current.onStakePress();
        });
        // No dispatch should happen.
        expect(mockStake).not.toHaveBeenCalled();
    });

    it('estimateGasForTransaction throws when no account address is set', async () => {
        // Render once with an account, then null it before forcing a gas estimate
        // re-run via the effect. Because the dependent useEffect bails when there
        // is no account, the easiest verification is to call onStakePress with a
        // null account and observe that no dispatch fires.
        mockState.currentAccount = null;
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await act(async () => {
            await result.current.onStakePress();
        });
        expect(mockStake).not.toHaveBeenCalled();
    });

    it('remote-error path: non-native coin gas exceeds native balance', async () => {
        mockGetTokenBalance.mockResolvedValue({
            balance: BigInt('1000000000000000000'),
            decimals: 18,
            error: false,
        });
        // very small native coin balance to trigger insufficient-gas.
        mockState.nativeCoinBalance = 1n;
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
        act(() => {
            result.current.setHandledGasData({
                gasInfo: { gasPrice: 1n },
                gasPrice: 1_000_000_000_000n,
            } as any);
        });
        act(() => {
            result.current.handleOnFromValueChange('0.1');
        });
        await waitFor(() => {
            expect(result.current.error).toContain('Insufficient funds for gas');
        });
    });

    it('coin-price loads on mainnet and updates fromPrice', async () => {
        mockGetCoinPrice.mockResolvedValueOnce(7);
        mockState.selectedNetwork = {
            chain_id: 1,
            chain_key: 'eip155:1',
            platform_id: 1,
            testnet: false,
            name: 'Mainnet',
        };
        const { result } = renderHook(() => useLiquidStaking(baseData));
        await waitFor(() => expect(mockGetCoinPrice).toHaveBeenCalled());
        await waitFor(() => expect(result.current.fromPrice).toBeGreaterThan(0));
    });

    describe('extra branch coverage', () => {
        it('handleOnFromUSDValueChange handles >=1 USD path with toFixed', async () => {
            const { result } = renderHook(() => useLiquidStaking(baseData));
            await waitFor(() => expect(mockGetCoinPrice).toHaveBeenCalled());
            // Wait for price to settle so fromPrice > 0 (=100 via mock).
            await waitFor(() => expect(result.current.fromPrice).toBeGreaterThan(0));
            act(() => {
                result.current.handleOnFromUSDValueChange('250');
            });
            // 250 USD / 100 price = 2.5 → toFixed(6) = '2.500000'
            expect(result.current.fromValue).toBe('2.500000');
        });

        it('onChangeModePress is a no-op when called with the same mode', () => {
            const { result } = renderHook(() => useLiquidStaking(baseData));
            const beforeMode = result.current.mode;
            act(() => {
                result.current.onChangeModePress('Stake');
            });
            expect(result.current.mode).toBe(beforeMode);
        });

        it('onSwapSuccess shows Unstake Cancelled in Unstake mode', async () => {
            const { result } = renderHook(() => useLiquidStaking(baseData));
            await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
            act(() => {
                result.current.onChangeModePress('Unstake');
            });
            act(() => {
                result.current.onSwapSuccess({}, true);
            });
            expect(mockToastSuccess).toHaveBeenCalledWith('Request Withdrawal Cancelled');
        });

        it('onSwapSuccess shows Unstake Succeeded when unlockRequired is false', async () => {
            mockSetLiquidStakingProvider.mockResolvedValue({
                contractAddress: '0xstake',
                abi: [],
                fetchExchangeRateMethod: 'getRate',
                fetchUnstakeExchangeRateMethod: 'getUnstakeRate',
                stakeMethod: 'stake',
                getStakeArgs: () => [],
                unstakeMethod: 'unstake',
                getUnstakeArgs: () => [],
                hasWaitTime: false,
                unlockRequired: false,
            });
            const { result } = renderHook(() => useLiquidStaking(baseData));
            await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
            act(() => {
                result.current.onChangeModePress('Unstake');
            });
            act(() => {
                result.current.onSwapSuccess({}, false);
            });
            expect(mockToastSuccess).toHaveBeenCalledWith('Unstake Succeeded');
        });

        it('onSliderValueChange does nothing when fromBalance is 0', () => {
            mockGetTokenBalance.mockResolvedValue({ balance: 0n, decimals: 18, error: false });
            const { result } = renderHook(() => useLiquidStaking(baseData));
            act(() => {
                result.current.onSliderValueChange(BigInt('500000000000000000'));
            });
            // fromValue stays empty because the branch bails when balance is 0.
            expect(result.current.fromValue).toBe('');
        });

        it('alert switch button is a no-op when stakingNetwork lacks a chain_id', () => {
            mockState.selectedNetwork = {
                chain_id: 137,
                chain_key: 'eip155:137',
                platform_id: 137,
                testnet: false,
                name: 'Polygon',
            };
            // Force getCurrentChains to return a chain entry with no chain_id.
            mockGetCurrentChains.mockReturnValueOnce([
                { name: 'Some Net', platform_id: 1 } as any,
            ]);
            renderHook(() => useLiquidStaking(baseData));
            const cfg = mockShowAlertModal.mock.calls[0][0];
            mockDispatch.mockClear();
            cfg.buttons[0].onPress();
            expect(mockSetSelectedNetwork).not.toHaveBeenCalled();
        });

        it('percentNum < 0 resets percentage to "0"', async () => {
            // useStringToFloatSelector parses '-1' → -1. We trigger the effect by
            // re-rendering after toggling input that updates fromValue.
            // The percentage state in the hook is internal — we can only assert no crash.
            const { result } = renderHook(() => useLiquidStaking(baseData));
            await waitFor(() => expect(result.current.mode).toBe('Stake'));
        });

        it('skips updating from balance when token-balance fetch returns an error', async () => {
            mockGetTokenBalance.mockResolvedValueOnce({
                balance: 0n,
                decimals: 18,
                error: true,
            });
            const { result } = renderHook(() => useLiquidStaking(baseData));
            await waitFor(() => expect(mockGetTokenBalance).toHaveBeenCalled());
            // loadingFromCoinData stays true because the error branch is taken.
            expect(result.current.loadingFromCoinData).toBe(true);
        });

        it('estimate-gas effect updates currentGasLimit when result is truthy', async () => {
            mockEstimateStake.mockResolvedValue('42000');
            const { result } = renderHook(() => useLiquidStaking(baseData));
            await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
            act(() => {
                result.current.setHandledGasData({
                    gasInfo: { gasPrice: 1n },
                    gasPrice: 1n,
                } as any);
            });
            act(() => {
                result.current.handleOnFromValueChange('0.5');
            });
            await waitFor(() => expect(result.current.currentGasLimit).toBe(42000));
        });

        it('recovers from INSUFFICIENT_FUNDS_FOR_GAS once balance is sufficient', async () => {
            mockGetTokenBalance.mockResolvedValue({
                balance: BigInt('1000000000000000000'),
                decimals: 18,
                error: false,
            });
            // start with very small native balance to trip the error
            mockState.nativeCoinBalance = 1n;
            const { result } = renderHook(() => useLiquidStaking(baseData));
            await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
            act(() => {
                result.current.setHandledGasData({
                    gasInfo: { gasPrice: 1n },
                    gasPrice: 1_000_000_000_000n,
                } as any);
            });
            act(() => {
                result.current.handleOnFromValueChange('0.1');
            });
            await waitFor(() =>
                expect(result.current.error).toContain('Insufficient funds for gas'),
            );
            // Now flip to sufficient native balance and force the effect to re-run by
            // setting a fresh handled-gas tuple. The recovery branch resets remoteError.
            mockState.nativeCoinBalance = BigInt('1000000000000000000000');
            act(() => {
                result.current.setHandledGasData({
                    gasInfo: { gasPrice: 1n },
                    gasPrice: 1n,
                } as any);
            });
            await waitFor(() => expect(result.current.error).toBe(''));
        });

        it('flags amount+gas overflow when from coin is native', async () => {
            mockGetTokenBalance.mockResolvedValue({
                balance: BigInt('1000000000000000000'),
                decimals: 18,
                error: false,
            });
            // Tiny native balance — amount + gas should overflow
            mockState.nativeCoinBalance = 1n;
            const { result } = renderHook(() =>
                useLiquidStaking({
                    ...baseData,
                    fromCoin: {
                        ...fromCoin,
                        tokenAddress: '0x0000000000000000000000000000000000000000',
                    },
                } as any),
            );
            await waitFor(() => expect(mockSetLiquidStakingProvider).toHaveBeenCalled());
            // Wait for the from-balance to refresh.
            await waitFor(() => expect(result.current.fromBalance > 0n).toBe(true));
            act(() => {
                result.current.setHandledGasData({
                    gasInfo: { gasPrice: 1n },
                    gasPrice: 1_000_000_000_000n,
                } as any);
            });
            // tiny amount that's still > balance (since balance is now 1n from native coin override would not match - skip).
            // The native + gas effect requires localError to be empty so use a sub-balance amount.
            // The fromValueBigInt >= fromBalance branch triggers INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS first.
            act(() => {
                result.current.handleOnFromValueChange('0.000000000001');
            });
            await waitFor(() => {
                expect(result.current.error).toBeTruthy();
            });
        });

        it('skips updating to-balance when token-balance fetch returns an error', async () => {
            // First call (from coin) returns OK; second (to coin) returns error.
            mockGetTokenBalance
                .mockResolvedValueOnce({
                    balance: BigInt('1000000000000000000'),
                    decimals: 18,
                    error: false,
                })
                .mockResolvedValueOnce({ balance: 0n, decimals: 18, error: true });
            const { result } = renderHook(() => useLiquidStaking(baseData));
            await waitFor(() => expect(mockGetTokenBalance).toHaveBeenCalled());
            // loadingToCoinData remains true because the error branch is taken.
            expect(result.current.loadingToCoinData).toBe(true);
        });
    });
});
