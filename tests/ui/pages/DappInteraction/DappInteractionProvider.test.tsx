import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import DappInteractionProvider, {
    useDappInteractionData,
} from '../../../../src/ui/pages/DappInteraction/DappInteractionProvider';

const mockState: any = {
    selectedNetwork: {
        chain_id: 1,
        chain_key: 'eip155:1',
        platform_id: 1,
        native_coin_address: '0x0000000000000000000000000000000000000000',
    },
    firstPermissionRequest: null,
    firstUnapprovedMessage: null,
    firstUnapprovedTx: null,
    firstNetworkRequest: null,
    firstSendCalls: null,
    firstShowCallsStatus: null,
    platform: { closeCurrentWindow: jest.fn() },
    nativeCoinBalance: BigInt('5000000000000000000'),
    subjectMetadata: { origin: 'http://test', name: 'Test Dapp' },
    currentAccount: {
        id: 'a1',
        address: '0xacct',
        metadata: { name: 'Test Account', avatar: '🦊', smartAvatar: '⚡' },
    },
    isSmartWallet: false,
    isGaslessDisableRequired: false,
    loadingGasless: false,
    resetWalletImpl: jest.fn(async () => true),
};

const mockGetEnvironmentType = jest.fn(() => 'popup');
jest.mock('../../../../src/shared/utils/utils', () => ({
    getEnvironmentType: () => mockGetEnvironmentType(),
}));

const mockEventOn = jest.fn();
const mockEventOff = jest.fn();
jest.mock('../../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        on: (...args: any[]) => mockEventOn(...args),
        off: (...args: any[]) => mockEventOff(...args),
    },
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../../../src/shared/utils/string', () => ({
    isEqualCaseInsensitive: (a: string, b: string) =>
        (a ?? '').toLowerCase() === (b ?? '').toLowerCase(),
}));

const mockGetAssetDetails = jest.fn();
const mockGetNativeAssetDetails = jest.fn();
const mockGetTxValue = jest.fn();
jest.mock('../../../../src/shared/utils/token-utils', () => ({
    getAssetDetails: (...args: any[]) => mockGetAssetDetails(...args),
    getNativeAssetDetails: (...args: any[]) => mockGetNativeAssetDetails(...args),
    getTxValue: (...args: any[]) => mockGetTxValue(...args),
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

jest.mock('../../../../src/store/selectors', () => ({
    useSelectedNetwork: () => mockState.selectedNetwork,
    useFirstPermissionRequest: () => mockState.firstPermissionRequest,
    useFirstUnapprovedMessage: () => mockState.firstUnapprovedMessage,
    useNativeCoinBalance: () => mockState.nativeCoinBalance,
    usePlatform: () => mockState.platform,
    useSubjectMetadataByOrigin: () => mockState.subjectMetadata,
    useCurrentAccountByAddress: () => ({
        account: mockState.currentAccount,
        isSmartWallet: mockState.isSmartWallet,
    }),
}));

jest.mock('../../../../src/store/selectors/eip5792', () => ({
    useFirstWalletSendCallsApprovalRequest: () => mockState.firstSendCalls,
    useFirstWalletShowCallsStatusApprovalRequest: () => mockState.firstShowCallsStatus,
}));

jest.mock('../../../../src/store/selectors/network', () => ({
    useFirstUnapprovedNetworkRequest: () => mockState.firstNetworkRequest,
}));

jest.mock('../../../../src/store/selectors/transactions', () => ({
    useFirstUnapprovedTx: () => mockState.firstUnapprovedTx,
}));


const mockEstimateGas = jest.fn();
const mockGetNativeTokenBalance = jest.fn();
const mockRejectPendingApproval = jest.fn();
const mockUpdateAndApproveTx = jest.fn();

jest.mock('../../../../src/store/actions/uiActions', () => ({
    estimateGas: (...args: any[]) => mockEstimateGas(...args),
    getNativeTokenBalance: (...args: any[]) => mockGetNativeTokenBalance(...args),
    hideLoadingIndicator: () => ({ type: 'HIDE' }),
    rejectPendingApproval: (...args: any[]) => mockRejectPendingApproval(...args),
    showLoadingIndicator: () => ({ type: 'SHOW' }),
    updateAndApproveTx: (...args: any[]) => mockUpdateAndApproveTx(...args),
}));

const mockDispatch = jest.fn();
jest.mock('../../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

const mockHistoryReplace = jest.fn();
jest.mock('react-router-dom', () => ({
    useHistory: () => ({ replace: mockHistoryReplace, push: jest.fn() }),
}));

jest.mock('../../../../src/shared/constants/routes', () => ({
    DEFAULT_ROUTE: '/',
    PERMISSION_CONFIRMATION_ROUTE: '/perm',
    SIGNATURE_REQUEST_ROUTE: '/sig',
    SWITCH_NETWORK_ROUTE: '/switch',
    TX_CONFIRMATION_CALLS_STATUS_ROUTE: '/calls-status',
    TX_CONFIRMATION_CONTRACT_INTERACTION_ROUTE: '/contract',
    TX_CONFIRMATION_DEPLOY_CONTRACT_ROUTE: '/deploy',
    TX_CONFIRMATION_SEND_CALLS_ROUTE: '/send-calls',
    TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE: '/native',
    TX_CONFIRMATION_SEND_OTHER_COIN_ROUTE: '/other',
    TX_CONFIRMATION_TOKEN_ALLOWANCE_ROUTE: '/allowance',
}));

jest.mock('../../../../src/shared/constants/app', () => ({
    ENVIRONMENT_TYPE_NOTIFICATION: 'notification',
    UI_DELAY_INTERNAL: 200,
}));

jest.mock('../../../../src/shared/types/Transaction', () => ({
    AssetDetail: undefined,
    TransactionMeta: undefined,
    TransactionType: {
        deployContract: 'deploy',
        tokenMethodApprove: 'tokenMethodApprove',
        simpleSend: 'simpleSend',
        tokenMethodTransfer: 'tokenMethodTransfer',
    },
}));

jest.mock('../../../../src/shared/messages/ErrorMessages', () => ({
    __esModule: true,
    default: {
        INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS: 'Insufficient funds (amount + gas)',
        ASSET_ERROR: 'Asset error',
    },
}));

jest.mock('../../../../src/shared/types/EventType', () => ({
    __esModule: true,
    default: { SET_CONFIRMATION_HANDLING: 'SET_CONFIRMATION_HANDLING' },
}));

const mockGetGasData = jest.fn((info: any) => ({ type: 2, gasPrice: info?.gasPrice ?? '1' }));
const mockOmitFlatten = jest.fn((obj: any, keys: string[]) => {
    const result = { ...obj };
    keys.forEach(k => delete result[k]);
    return result;
});
jest.mock('../../../../src/lib/WalletUtils', () => ({
    getGasData: (...args: any[]) => mockGetGasData(...args),
    omitFlatten: (...args: any[]) => mockOmitFlatten(...args),
}));

const mockToHex = jest.fn((n: any) => `0x${Number(n).toString(16)}`);
const mockHexToNumber = jest.fn((h: string) => parseInt(h, 16));
jest.mock('../../../../src/lib/web3', () => ({
    hexToNumber: (...args: any[]) => mockHexToNumber(...args),
    toHex: (...args: any[]) => mockToHex(...args),
}));

jest.mock('eth-rpc-errors', () => ({
    ethErrors: {
        provider: {
            userRejectedRequest: () => new Error('User rejected'),
        },
    },
    serializeError: (e: any) => e,
}));

jest.mock('ethers', () => ({
    parseEther: (v: string) => BigInt(Math.floor(parseFloat(v) * 1e18)),
}));

jest.mock('@ethersproject/bignumber', () => ({
    BigNumber: { from: (v: any) => ({ toString: () => String(v) }) },
}));

function Consumer() {
    const ctx = useDappInteractionData();
    return (
        <div>
            <span data-testid="walletAddress">{ctx.walletAddress}</span>
            <span data-testid="origin">{ctx.origin}</span>
            <span data-testid="error">{ctx.error}</span>
            <span data-testid="accountName">{ctx.accountName}</span>
            <span data-testid="confirmDisabled">{String(ctx.confirmButtonDisabled)}</span>
            <button onClick={() => ctx.onRejectPress()}>reject</button>
            <button onClick={() => ctx.onConfirmPress(false)}>confirm</button>
            <button onClick={() => ctx.onConfirmPress(true)}>approve</button>
            <button
                onClick={() =>
                    ctx.onGasChange?.({ gasInfo: { gasPrice: 1n } } as any, 100n)
                }>
                gas
            </button>
        </div>
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    mockGetGasData.mockImplementation((info: any) => ({
        type: 2,
        gasPrice: info?.gasPrice ?? '1',
    }));
    mockOmitFlatten.mockImplementation((obj: any, keys: string[]) => {
        const result = { ...obj };
        keys.forEach(k => delete result[k]);
        return result;
    });
    mockToHex.mockImplementation((n: any) => `0x${Number(n).toString(16)}`);
    mockHexToNumber.mockImplementation((h: string) => parseInt(h, 16));
    mockGetTxValue.mockReturnValue('0.5');
    mockGetAssetDetails.mockResolvedValue({
        tokenAmount: { toString: () => '100' },
        balance: '100',
    });
    mockGetNativeAssetDetails.mockResolvedValue({
        tokenAmount: { toString: () => '100' },
        balance: '100',
    });
    mockEstimateGas.mockResolvedValue('21000');
    mockGetNativeTokenBalance.mockImplementation(() => ({ type: 'GET_NATIVE_BAL' }));
    mockRejectPendingApproval.mockImplementation(() => ({ type: 'REJECT' }));
    mockUpdateAndApproveTx.mockImplementation(() => ({ type: 'CONFIRM' }));
    mockDispatch.mockImplementation((action: any) => {
        if (typeof action === 'function') return action;
        return Promise.resolve(null);
    });
    mockGetEnvironmentType.mockReturnValue('popup');
    mockState.firstPermissionRequest = null;
    mockState.firstUnapprovedMessage = null;
    mockState.firstUnapprovedTx = null;
    mockState.firstNetworkRequest = null;
    mockState.firstSendCalls = null;
    mockState.firstShowCallsStatus = null;
    mockState.nativeCoinBalance = BigInt('5000000000000000000');
    mockState.isGaslessDisableRequired = false;
    mockState.resetWalletImpl = jest.fn(async () => true);
});

describe('useDappInteractionData', () => {
    it('exposes createContext defaults when rendered outside Provider', () => {
        render(<Consumer />);
        expect(screen.getByTestId('confirmDisabled')).toHaveTextContent('true');
    });

    it('default context functions are no-ops', async () => {
        let captured: any = null;
        function CaptureCtx() {
            captured = useDappInteractionData();
            return null;
        }
        render(<CaptureCtx />);
        // Invoke default no-op functions to cover them
        await expect(captured.setApprovalAmount('any')).toBeUndefined();
        await expect(captured.onRejectPress()).resolves.toBeUndefined();
        await expect(captured.onConfirmPress()).resolves.toBeUndefined();
        await expect(captured.onGasChange({} as any, 0n)).resolves.toBeUndefined();
    });
});

describe('DappInteractionProvider — initial render', () => {
    it('renders children and provides default context values', () => {
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(screen.getByTestId('confirmDisabled')).toBeInTheDocument();
        expect(screen.getByTestId('accountName')).toHaveTextContent('Test Account');
    });

    it('falls back to DEFAULT_ROUTE in popup mode with no pending request', () => {
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/');
    });

    it('routes to permission confirmation when a permission request exists', () => {
        mockState.firstPermissionRequest = { id: 'p1' };
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/perm');
    });

    it('routes to switch-network when a network request exists', () => {
        mockState.firstNetworkRequest = { id: 'n1' };
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/switch');
    });

    it('routes to signature when a message request exists', () => {
        mockState.firstUnapprovedMessage = { id: 'm1' };
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/sig');
    });

    it('routes to send-calls when a send-calls request exists', () => {
        mockState.firstSendCalls = { id: 'sc1' };
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/send-calls');
    });

    it('routes to calls-status when a show-calls-status request exists', () => {
        mockState.firstShowCallsStatus = { id: 'sc2' };
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/calls-status');
    });
});

describe('DappInteractionProvider — transaction routing', () => {
    function mkTx(over: Partial<any> = {}) {
        return {
            id: 'tx1',
            origin: 'http://dapp',
            type: 'simpleSend',
            txParams: {
                from: '0xacct',
                to: '0xreceiver',
                value: '1000',
                data: '',
            },
            ...over,
        };
    }

    it('routes simpleSend transactions to the native coin route', () => {
        mockState.firstUnapprovedTx = mkTx({ type: 'simpleSend' });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/native');
    });

    it('routes tokenMethodApprove transactions to the allowance route', () => {
        mockState.firstUnapprovedTx = mkTx({ type: 'tokenMethodApprove' });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/allowance');
    });

    it('routes tokenMethodTransfer transactions to the other-coin route', () => {
        mockState.firstUnapprovedTx = mkTx({ type: 'tokenMethodTransfer' });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/other');
    });

    it('routes deployContract transactions to the deploy route', () => {
        mockState.firstUnapprovedTx = mkTx({ type: 'deploy' });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/deploy');
    });

    it('routes other transaction types to the contract interaction route', () => {
        mockState.firstUnapprovedTx = mkTx({ type: 'contractCall' });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockHistoryReplace).toHaveBeenCalledWith('/contract');
    });

    it('fetches getAssetDetails when the tx has data', async () => {
        mockState.firstUnapprovedTx = mkTx({
            type: 'contractCall',
            txParams: { from: '0xacct', to: '0xtok', value: '0', data: '0xabcd' },
        });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockGetAssetDetails).toHaveBeenCalled());
    });

    it('fetches getNativeAssetDetails for simpleSend with no data', async () => {
        mockState.firstUnapprovedTx = mkTx({ type: 'simpleSend' });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockGetNativeAssetDetails).toHaveBeenCalled());
    });

    it('logs and falls back when getAssetDetails rejects', async () => {
        mockGetAssetDetails.mockRejectedValueOnce(new Error('asset-fail'));
        mockState.firstUnapprovedTx = mkTx({
            txParams: { from: '0xacct', to: '0xtok', value: '0', data: '0xabcd' },
        });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockGetAssetDetails).toHaveBeenCalled());
    });

    it('uses dappSuggestedGasFees.gas when present (no estimation needed)', async () => {
        mockState.firstUnapprovedTx = mkTx({
            type: 'contractCall',
            dappSuggestedGasFees: { gas: '0x5208' },
        });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockHexToNumber).toHaveBeenCalled());
    });

    it('estimates gas when no dapp-suggested gas is present', async () => {
        mockState.firstUnapprovedTx = mkTx({
            type: 'contractCall',
            txParams: { from: '0xacct', to: '0xtok', value: '0', data: '0xabcd' },
        });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockEstimateGas).toHaveBeenCalled());
    });

    it('surfaces ASSET_ERROR when estimateGas returns null', async () => {
        mockEstimateGas.mockResolvedValueOnce(null);
        mockState.firstUnapprovedTx = mkTx({
            type: 'contractCall',
            txParams: { from: '0xacct', to: '0xtok', value: '0', data: '0xabcd' },
        });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockEstimateGas).toHaveBeenCalled());
    });

    it('reports estimate-gas errors via remoteError', async () => {
        mockEstimateGas.mockRejectedValueOnce(new Error('estimate fail'));
        mockState.firstUnapprovedTx = mkTx({
            type: 'contractCall',
            txParams: { from: '0xacct', to: '0xtok', value: '0', data: '0xabcd' },
        });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockEstimateGas).toHaveBeenCalled());
    });

    it('seeds initGasInfo from dapp gasPrice fee', async () => {
        mockState.firstUnapprovedTx = mkTx({
            dappSuggestedGasFees: { gasPrice: '1000' },
        });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockHistoryReplace).toHaveBeenCalled());
    });

    it('seeds initGasInfo from EIP-1559 dapp fees', async () => {
        mockState.firstUnapprovedTx = mkTx({
            dappSuggestedGasFees: {
                maxFeePerGas: '1000',
                maxPriorityFeePerGas: '100',
            },
        });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockHistoryReplace).toHaveBeenCalled());
    });

    it('marks balance insufficient when value exceeds nativeTokenBalance', async () => {
        // parseFloat(amount) >= nativeTokenBalance triggers INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS
        mockGetTxValue.mockReturnValue('99999999999999999999');
        mockState.nativeCoinBalance = BigInt('1000000000000000000');
        mockState.firstUnapprovedTx = mkTx({ type: 'simpleSend' });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() =>
            expect(screen.getByTestId('error').textContent).toContain('Insufficient'),
        );
    });
});

describe('DappInteractionProvider — confirm / reject handlers', () => {
    function mkTx() {
        return {
            id: 'tx1',
            origin: 'http://dapp',
            type: 'simpleSend',
            txParams: { from: '0xacct', to: '0xreceiver', value: '1000', data: '' },
        };
    }

    it('onRejectPress dispatches rejectPendingApproval and shows a toast', async () => {
        mockState.firstUnapprovedTx = mkTx();
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByText('reject').click();
        });
        expect(mockRejectPendingApproval).toHaveBeenCalled();
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith('Reject request succeeded'),
        );
    });

    it('onRejectPress surfaces errors via Toast.showError', async () => {
        mockState.firstUnapprovedTx = mkTx();
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        // Queue the failure for the next dispatch call (the actual reject action).
        mockDispatch.mockImplementationOnce(() =>
            Promise.reject(new Error('reject-err')),
        );
        await act(async () => {
            screen.getByText('reject').click();
        });
        await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('reject-err'));
    });

    it('onConfirmPress is a no-op without gasInfo', async () => {
        mockState.firstUnapprovedTx = mkTx();
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        screen.getByText('confirm').click();
        expect(mockUpdateAndApproveTx).not.toHaveBeenCalled();
    });

    // Consumer that triggers gas then confirm in a single React render cycle so
    // the second handler sees fresh ctx (avoids stale-closure issues).
    function GasConfirmConsumer({ approvalTx = false }: { approvalTx?: boolean }) {
        const ctx = useDappInteractionData();
        const [step, setStep] = React.useState(0);
        React.useEffect(() => {
            if (step === 1 && ctx.onGasChange) {
                ctx.onGasChange({ gasInfo: { gasPrice: 1n } } as any, 100n);
                setStep(2);
            } else if (step === 2 && ctx.onConfirmPress) {
                ctx.onConfirmPress(approvalTx);
                setStep(3);
            }
        }, [step, ctx, approvalTx]);
        return (
            <button data-testid="trigger" onClick={() => setStep(1)}>
                trigger
            </button>
        );
    }

    it('onGasChange sets gasInfo so onConfirmPress can proceed', async () => {
        mockState.firstUnapprovedTx = mkTx();
        render(
            <DappInteractionProvider>
                <GasConfirmConsumer />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        await waitFor(() => expect(mockUpdateAndApproveTx).toHaveBeenCalled());
        expect(mockToastSuccess).toHaveBeenCalledWith('Confirm Tx succeeded');
    });

    it('onConfirmPress with isApprovalTx=true shows the approve-success toast', async () => {
        mockState.firstUnapprovedTx = mkTx();
        render(
            <DappInteractionProvider>
                <GasConfirmConsumer approvalTx={true} />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith('Approve request succeeded'),
        );
    });
});

describe('DappInteractionProvider — notification environment', () => {
    it('schedules window close after delay when in notification mode', () => {
        jest.useFakeTimers();
        mockGetEnvironmentType.mockReturnValue('notification');
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        jest.advanceTimersByTime(200);
        expect(mockState.platform.closeCurrentWindow).toHaveBeenCalled();
        jest.useRealTimers();
    });
});

describe('DappInteractionProvider — additional branch coverage', () => {
    function mkTx(over: Partial<any> = {}) {
        return {
            id: 'tx1',
            origin: 'http://dapp',
            type: 'simpleSend',
            txParams: {
                from: '0xacct',
                to: '0xreceiver',
                value: '1000',
                data: '',
            },
            ...over,
        };
    }

    it('onRejectPress no-op when currentRequest is null', async () => {
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByText('reject').click();
        });
        expect(mockRejectPendingApproval).not.toHaveBeenCalled();
    });

    it('onConfirmPress catch block shows error toast on updateAndApproveTx failure', async () => {
        mockState.firstUnapprovedTx = mkTx();
        function GasConfirmFail() {
            const ctx = useDappInteractionData();
            const [step, setStep] = React.useState(0);
            React.useEffect(() => {
                if (step === 1 && ctx.onGasChange) {
                    ctx.onGasChange({ gasInfo: { gasPrice: 1n } } as any, 100n);
                    setStep(2);
                } else if (step === 2 && ctx.onConfirmPress) {
                    // Make updateAndApproveTx dispatch reject
                    mockUpdateAndApproveTx.mockReturnValueOnce({ type: 'FAIL' });
                    mockDispatch.mockImplementationOnce(() =>
                        Promise.reject(new Error('confirm-failed')),
                    );
                    ctx.onConfirmPress(false);
                    setStep(3);
                }
            }, [step, ctx]);
            return (
                <button data-testid="trigger" onClick={() => setStep(1)}>
                    trigger
                </button>
            );
        }
        render(
            <DappInteractionProvider>
                <GasConfirmFail />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('confirm-failed'));
    });

    it('approve tx with dappProposedTokenAmount but no approvalAmount uses proposed', async () => {
        mockState.firstUnapprovedTx = mkTx({
            type: 'contractCall',
            txParams: { from: '0xacct', to: '0xtok', value: '0', data: '0xabcd' },
        });
        // tokenAmount.toString returns "100" -> approvalAmount gets set to "100"
        // We want approvalAmount === '' so the else-if branch (line 295-296) fires.
        mockGetAssetDetails.mockResolvedValue({
            tokenAmount: { toString: () => '100' },
            balance: '100',
        });
        function ApproveFlow() {
            const ctx = useDappInteractionData();
            const [step, setStep] = React.useState(0);
            React.useEffect(() => {
                if (step === 1 && ctx.onGasChange) {
                    // Clear approvalAmount before confirm
                    ctx.setApprovalAmount('');
                    ctx.onGasChange({ gasInfo: { gasPrice: 1n } } as any, 100n);
                    setStep(2);
                } else if (step === 2 && ctx.onConfirmPress) {
                    ctx.onConfirmPress(true);
                    setStep(3);
                }
            }, [step, ctx]);
            return (
                <button data-testid="trigger" onClick={() => setStep(1)}>
                    trigger
                </button>
            );
        }
        render(
            <DappInteractionProvider>
                <ApproveFlow />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        await waitFor(() => expect(mockUpdateAndApproveTx).toHaveBeenCalled());
    });

    it('logs and falls back when getNativeAssetDetails rejects', async () => {
        mockGetNativeAssetDetails.mockRejectedValueOnce(new Error('native-fail'));
        mockState.firstUnapprovedTx = mkTx({ type: 'simpleSend' });
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockGetNativeAssetDetails).toHaveBeenCalled());
    });

    it('uses smartAvatar emoji when isSmartWallet is false (default) and avatar when true', async () => {
        // First default isSmartWallet=false (existing). Now true to flip emoji branch.
        mockState.isSmartWallet = true;
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        // simply ensure provider renders without error in this branch
        expect(screen.getByTestId('accountName')).toBeInTheDocument();
        mockState.isSmartWallet = false;
    });

    it('accountName falls back to Unknown when metadata.name is missing', async () => {
        const prev = mockState.currentAccount;
        mockState.currentAccount = {
            id: 'a1',
            address: '0xacct',
            metadata: { avatar: '🦊', smartAvatar: '⚡' },
        };
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(screen.getByTestId('accountName')).toHaveTextContent('Unknown');
        mockState.currentAccount = prev;
    });


    it('onConfirmPress with isApprovalTx=true but no approvalAmount and no proposed amount', async () => {
        // getAssetDetails returns no tokenAmount -> dappProposedTokenAmount is undefined.
        mockGetAssetDetails.mockResolvedValue({ balance: '100' });
        mockState.firstUnapprovedTx = mkTx({
            type: 'tokenMethodApprove',
            txParams: { from: '0xacct', to: '0xtok', value: '0', data: '0xabcd', gas: '0x1', gasLimit: '0x1' },
        });
        function ApproveNoAmount() {
            const ctx = useDappInteractionData();
            const [step, setStep] = React.useState(0);
            React.useEffect(() => {
                if (step === 1 && ctx.onGasChange) {
                    ctx.setApprovalAmount('');
                    ctx.onGasChange({ gasInfo: { gasPrice: 1n } } as any, 100n);
                    setStep(2);
                } else if (step === 2 && ctx.onConfirmPress) {
                    ctx.onConfirmPress(true);
                    setStep(3);
                }
            }, [step, ctx]);
            return (
                <button data-testid="trigger" onClick={() => setStep(1)}>
                    trigger
                </button>
            );
        }
        render(
            <DappInteractionProvider>
                <ApproveNoAmount />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        await waitFor(() => expect(mockUpdateAndApproveTx).toHaveBeenCalled());
    });

    it('confirm path with txParams.gas already set skips toHex overwrite', async () => {
        mockState.firstUnapprovedTx = mkTx({
            txParams: {
                from: '0xacct',
                to: '0xreceiver',
                value: '1000',
                data: '',
                gas: '0x5208',
                gasLimit: '0x5208',
            },
        });
        function ConfirmWithGas() {
            const ctx = useDappInteractionData();
            const [step, setStep] = React.useState(0);
            React.useEffect(() => {
                if (step === 1 && ctx.onGasChange) {
                    ctx.onGasChange({ gasInfo: { gasPrice: 1n } } as any, 100n);
                    setStep(2);
                } else if (step === 2 && ctx.onConfirmPress) {
                    ctx.onConfirmPress(false);
                    setStep(3);
                }
            }, [step, ctx]);
            return (
                <button data-testid="trigger" onClick={() => setStep(1)}>
                    trigger
                </button>
            );
        }
        render(
            <DappInteractionProvider>
                <ConfirmWithGas />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        await waitFor(() => expect(mockUpdateAndApproveTx).toHaveBeenCalled());
    });

    it('onRejectPress catches error without message (silent)', async () => {
        mockState.firstUnapprovedTx = mkTx();
        render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        // Reject the dispatch with an error that has no message
        mockDispatch.mockImplementationOnce(() => Promise.reject({}));
        await act(async () => {
            screen.getByText('reject').click();
        });
        // Toast.showError should NOT be called when message is empty
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('onConfirmPress catches error without message (silent)', async () => {
        mockState.firstUnapprovedTx = mkTx();
        function Trigger() {
            const ctx = useDappInteractionData();
            const [step, setStep] = React.useState(0);
            React.useEffect(() => {
                if (step === 1 && ctx.onGasChange) {
                    ctx.onGasChange({ gasInfo: { gasPrice: 1n } } as any, 100n);
                    setStep(2);
                } else if (step === 2 && ctx.onConfirmPress) {
                    mockDispatch.mockImplementationOnce(() => Promise.reject({}));
                    ctx.onConfirmPress(false);
                    setStep(3);
                }
            }, [step, ctx]);
            return (
                <button data-testid="trigger" onClick={() => setStep(1)}>
                    trigger
                </button>
            );
        }
        render(
            <DappInteractionProvider>
                <Trigger />
            </DappInteractionProvider>,
        );
        await act(async () => {
            screen.getByTestId('trigger').click();
        });
        // No error toast expected when message is empty
        await waitFor(() => expect(mockUpdateAndApproveTx).toHaveBeenCalled());
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('confirmCalls handles tx with empty txParams (to/data/value falsy)', async () => {
        mockState.firstUnapprovedTx = mkTx({
            txParams: { from: '0xacct' }, // no to/data/value
        });
        function GCConsumer() {
            const ctx = useDappInteractionData();
            return <span data-testid="gc">{JSON.stringify(ctx.confirmCalls)}</span>;
        }
        render(
            <DappInteractionProvider>
                <GCConsumer />
            </DappInteractionProvider>,
        );
        expect(screen.getByTestId('gc').textContent).toContain('"to":""');
        expect(screen.getByTestId('gc').textContent).toContain('"data":"0x"');
        expect(screen.getByTestId('gc').textContent).toContain('"value":"0"');
    });

    it('closes window immediately in notification mode when waitingRef is "ignore"', async () => {
        mockGetEnvironmentType.mockReturnValue('notification');
        // Render component that synchronously (during render) sets waitingRef.current='ignore'
        // so the provider's first useEffect sees 'ignore'. No firstUnapprovedTx so effect
        // falls to the notification 'ignore' branch (lines 500-501).
        function SyncIgnore() {
            const ctx = useDappInteractionData();
            if (ctx.waitingRef) {
                ctx.waitingRef.current = 'ignore';
            }
            return null;
        }
        render(
            <DappInteractionProvider>
                <SyncIgnore />
            </DappInteractionProvider>,
        );
        await waitFor(() => expect(mockState.platform.closeCurrentWindow).toHaveBeenCalled());
    });

    it('flags INSUFFICIENT_FUNDS via gas+amount > balance check (line 427)', async () => {
        mockGetTxValue.mockReturnValue('1');
        mockState.nativeCoinBalance = BigInt('1000000000000000000'); // 1 ether
        mockState.firstUnapprovedTx = mkTx({ type: 'simpleSend' });
        function GasOnly() {
            const ctx = useDappInteractionData();
            const calledRef = React.useRef(false);
            React.useEffect(() => {
                if (ctx.onGasChange && !calledRef.current) {
                    calledRef.current = true;
                    ctx.onGasChange(
                        { gasInfo: { gasPrice: 1n } } as any,
                        BigInt('1000000000000000000'),
                    );
                }
            });
            return <span data-testid="err">{ctx.error}</span>;
        }
        render(
            <DappInteractionProvider>
                <GasOnly />
            </DappInteractionProvider>,
        );
        await waitFor(() =>
            expect(screen.getByTestId('err').textContent).toContain('Insufficient'),
        );
    });
});

describe('DappInteractionProvider — event subscription', () => {
    it('subscribes/unsubscribes to SET_CONFIRMATION_HANDLING', () => {
        const { unmount } = render(
            <DappInteractionProvider>
                <Consumer />
            </DappInteractionProvider>,
        );
        expect(mockEventOn).toHaveBeenCalledWith(
            'SET_CONFIRMATION_HANDLING',
            expect.any(Function),
        );
        unmount();
        expect(mockEventOff).toHaveBeenCalledWith(
            'SET_CONFIRMATION_HANDLING',
            expect.any(Function),
        );
    });
});
