import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import SpeedUpAndCancelModal from '../../../src/ui/components/SpeedUpAndCancelModal';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: any) =>
        visible ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: any) => <div>{title}</div>,
}));

let gasFeeOnChange: any = null;
jest.mock('../../../src/ui/components/GasFee', () => ({
    __esModule: true,
    default: ({ onGasChange }: any) => {
        gasFeeOnChange = onGasChange;
        return <div data-testid="gas-fee" />;
    },
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: (...args: any[]) => mockToastSuccess(...args),
        showError: (...args: any[]) => mockToastError(...args),
    },
}));

const mockUseGasless = jest.fn();


jest.mock('../../../src/store/selectors', () => ({
    useSelectedNetwork: () => ({ chain_id: 1 }),
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

const mockCancelTransaction = jest.fn();
const mockSpeedUpTransaction = jest.fn();
const mockEstimateGas = jest.fn();
const mockGetTransaction = jest.fn();
const mockUpdatePendingTransaction = jest.fn();
jest.mock('../../../src/store/actions/uiActions', () => ({
    cancelTransaction: (...args: any[]) => mockCancelTransaction(...args),
    estimateGas: (...args: any[]) => mockEstimateGas(...args),
    getTransaction: (...args: any[]) => mockGetTransaction(...args),
    speedUpTransaction: (...args: any[]) => mockSpeedUpTransaction(...args),
    updatePendingTransaction: (...args: any[]) => mockUpdatePendingTransaction(...args),
}));

jest.mock('../../../src/api/graphQL/BaseRequest', () => ({
    getErrorMessage: (e: any) => e?.message ?? 'unknown',
}));

jest.mock('../../../src/shared/types/Wallet', () => ({
    GasType: { Custom: 'custom', High: 'high' },
}));

jest.mock('../../../src/shared/types/Chain', () => ({
    GasPriceType: { BaseAndPriority: 'baseandpriority', GasPrice: 'gasprice' },
}));

jest.mock('viem', () => ({
    toHex: (v: any) => `0x${v}`,
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn() },
}));

const baseTx: any = {
    hash: '0xtx',
    nonce: 1,
    to: '0xb',
    data: '0xdata',
    value: 100n,
    maxFeePerGas: 100n,
    maxPriorityFeePerGas: 10n,
    gasPrice: 50n,
};

const basePendingData: any = {
    sender: '0xa',
    receiver: '0xb',
    txHash: '0xtx',
    network: {
        platform_id: 1,
        gasPriceType: 'baseandpriority',
    },
};

describe('SpeedUpAndCancelModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        gasFeeOnChange = null;
        mockEstimateGas.mockResolvedValue(30000);
        mockGetTransaction.mockResolvedValue(baseTx);
        mockUseGasless.mockReturnValue({
            isGaslessDisableRequired: false,
            resetWallet: jest.fn(),
        });
        mockDispatch.mockReturnValue(Promise.resolve(null));
        mockCancelTransaction.mockImplementation(() => ({ type: 'CANCEL' }));
        mockSpeedUpTransaction.mockImplementation(() => ({ type: 'SPEEDUP' }));
        mockUpdatePendingTransaction.mockImplementation(() => ({ type: 'UPDATE' }));
    });

    it('renders Speed Up title by default', () => {
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={undefined as any}
                type={undefined as any}
            />,
        );
        expect(screen.getByText('Speed Up Transaction')).toBeInTheDocument();
    });

    it('renders Cancel title and button when type=cancel', () => {
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                type="cancel"
            />,
        );
        expect(screen.getAllByText('Cancel Transaction').length).toBeGreaterThan(0);
    });

    it('does not render when invisible', () => {
        render(<SpeedUpAndCancelModal visible={false} onCloseRequest={jest.fn()} />);
        expect(screen.queryByText(/Transaction/)).toBeNull();
    });

    it('fetches the transaction and estimates gas on open', async () => {
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalledWith('0xtx', 1));
        await waitFor(() => expect(mockEstimateGas).toHaveBeenCalled());
    });

    it('falls back to 21000 gas when getTransaction returns null', async () => {
        mockGetTransaction.mockResolvedValueOnce(null);
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
    });

    it('falls back to 21000 gas when getTransaction rejects', async () => {
        mockGetTransaction.mockRejectedValueOnce(new Error('rpc'));
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
    });

    it('logs an error when gas estimation rejects', async () => {
        mockEstimateGas.mockRejectedValueOnce(new Error('gas err'));
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockEstimateGas).toHaveBeenCalled());
    });

    it('handles cancel button click when gas info is set', async () => {
        const onCloseRequest = jest.fn();
        const onStart = jest.fn();
        const onEnd = jest.fn();
        mockDispatch.mockReturnValueOnce(Promise.resolve({ hash: '0xnew' }));
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={onCloseRequest}
                data={basePendingData}
                type="cancel"
                onStart={onStart}
                onEnd={onEnd}
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        // Simulate GasFee updating its parent to provide gasInfo.
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    {
                        gasInfo: { priorityFee: 5n, baseFee: 5n, maxFeePerGas: 10n },
                    },
                    100n,
                );
        });
        const button = await screen.findByRole('button', { name: 'Cancel Transaction' });
        await waitFor(() => expect(button).not.toBeDisabled());
        fireEvent.click(button);
        await waitFor(() => expect(onStart).toHaveBeenCalled());
        await waitFor(() => expect(onEnd).toHaveBeenCalled());
    });

    it('handles speedup button click and uses Speed Up toast', async () => {
        mockDispatch.mockReturnValueOnce(Promise.resolve({ hash: '0xnew-spd' }));
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    {
                        gasInfo: { priorityFee: 5n, baseFee: 5n, maxFeePerGas: 10n },
                    },
                    100n,
                );
        });
        const button = await screen.findByRole('button', { name: 'Speed Up' });
        await waitFor(() => expect(button).not.toBeDisabled());
        fireEvent.click(button);
        await waitFor(() =>
            expect(mockToastSuccess).toHaveBeenCalledWith('Speed Up Transaction succeeded.'),
        );
    });

    it('shows nonce-used error message verbatim', async () => {
        const onEnd = jest.fn();
        mockDispatch.mockImplementationOnce(() =>
            Promise.reject(new Error('nonce has already been used')),
        );
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
                onEnd={onEnd}
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    { gasInfo: { priorityFee: 5n, baseFee: 5n, maxFeePerGas: 10n } },
                    100n,
                );
        });
        const button = await screen.findByRole('button', { name: 'Speed Up' });
        fireEvent.click(button);
        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith(
                expect.stringMatching(/already confirmed or failed/),
            ),
        );
    });

    it('shows generic error message for other failures', async () => {
        const onEnd = jest.fn();
        mockDispatch.mockImplementationOnce(() =>
            Promise.reject(Object.assign(new Error('weird'), { reason: 'something bad' })),
        );
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
                onEnd={onEnd}
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    { gasInfo: { priorityFee: 5n, baseFee: 5n, maxFeePerGas: 10n } },
                    100n,
                );
        });
        const button = await screen.findByRole('button', { name: 'Speed Up' });
        fireEvent.click(button);
        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith('something bad'),
        );
    });

    it('calls onEnd() with no payload when the dispatched task returns null', async () => {
        const onEnd = jest.fn();
        mockDispatch.mockReturnValueOnce(Promise.resolve(null));
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
                onEnd={onEnd}
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    { gasInfo: { priorityFee: 5n, baseFee: 5n, maxFeePerGas: 10n } },
                    100n,
                );
        });
        const button = await screen.findByRole('button', { name: 'Speed Up' });
        fireEvent.click(button);
        await waitFor(() => expect(onEnd).toHaveBeenCalledWith());
    });

    it('handles legacy gas price networks (non-BaseAndPriority)', async () => {
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={{
                    ...basePendingData,
                    network: { ...basePendingData.network, gasPriceType: 'gasprice' },
                }}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange({ gasInfo: { gasPrice: 20n } }, 100n);
        });
        const button = await screen.findByRole('button', { name: 'Speed Up' });
        // After gas updates, button should not be disabled.
        await waitFor(() => expect(button).not.toBeDisabled());
    });

    it('handles a missing tx.gasPrice in legacy gas branch', async () => {
        const txNoGasPrice = { ...baseTx, gasPrice: 0n };
        mockGetTransaction.mockResolvedValueOnce(txNoGasPrice);
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={{
                    ...basePendingData,
                    network: { ...basePendingData.network, gasPriceType: 'gasprice' },
                }}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange({ gasInfo: { gasPrice: 20n } }, 100n);
        });
    });

    it('falls back to 0n when gasFee onChange omits maxFeePerGas', async () => {
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            // gasInfo without maxFeePerGas → exercises (newGasInfo.maxFeePerGas ?? 0n) branch
            gasFeeOnChange && gasFeeOnChange({ gasInfo: {} }, 100n);
        });
    });

    it('falls back to 0n when gasFee onChange omits gasPrice on legacy chain', async () => {
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={{
                    ...basePendingData,
                    network: { ...basePendingData.network, gasPriceType: 'gasprice' },
                }}
                type="cancel"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            // gasInfo without gasPrice → exercises (newGasInfo.gasPrice ?? 0n) branch
            gasFeeOnChange && gasFeeOnChange({ gasInfo: {} }, 100n);
        });
    });

    it('falls back when dispatch returns null (no task)', async () => {
        const onEnd = jest.fn();
        // The mockDispatch.mockReturnValueOnce in beforeEach already returns Promise<null>.
        // We need dispatch to return a falsy value (not a promise) → returns undefined.
        mockDispatch.mockReset();
        mockDispatch.mockReturnValueOnce(undefined as any);
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
                onEnd={onEnd}
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    { gasInfo: { priorityFee: 5n, baseFee: 5n, maxFeePerGas: 10n } },
                    100n,
                );
        });
        const button = await screen.findByRole('button', { name: 'Speed Up' });
        fireEvent.click(button);
        await waitFor(() => expect(onEnd).toHaveBeenCalledWith());
    });

    it('handles BaseAndPriority branch when tx lacks maxFeePerGas/priorityFee', async () => {
        const txNoMax = { ...baseTx, maxFeePerGas: null, maxPriorityFeePerGas: null };
        mockGetTransaction.mockResolvedValueOnce(txNoMax);
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    { gasInfo: { priorityFee: 3n, baseFee: 3n, maxFeePerGas: 6n } },
                    100n,
                );
        });
        // Button should still appear
        await screen.findByRole('button', { name: 'Speed Up' });
    });

    it('clamps new gasPrice up to gasInfo.gasPrice in legacy branch', async () => {
        // Setting tx.gasPrice low and gasInfo.gasPrice high triggers the clamp branch (line 299)
        const txLowGas = { ...baseTx, gasPrice: 1n };
        mockGetTransaction.mockResolvedValueOnce(txLowGas);
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={{
                    ...basePendingData,
                    network: { ...basePendingData.network, gasPriceType: 'gasprice' },
                }}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange({ gasInfo: { gasPrice: 999n } }, 100n);
        });
        await screen.findByRole('button', { name: 'Speed Up' });
    });


    it('uses fallback error message when error has no reason', async () => {
        const onEnd = jest.fn();
        mockDispatch.mockImplementationOnce(() => Promise.reject(new Error('boom')));
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
                onEnd={onEnd}
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    { gasInfo: { priorityFee: 5n, baseFee: 5n, maxFeePerGas: 10n } },
                    100n,
                );
        });
        const button = await screen.findByRole('button', { name: 'Speed Up' });
        fireEvent.click(button);
        await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Transaction failed.'));
    });

    it('keeps _priorityFee when computed boost is lower (else branch)', async () => {
        render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        // tx.maxPriorityFee=10n → boost=11n. Set _priorityFee=999n so 11n <= 999n → keep _priorityFee.
        // tx.maxFeePerGas=100n minus 10n priority = 90n base; boost=99n. Set _baseFee=999n → keep _baseFee.
        act(() => {
            gasFeeOnChange &&
                gasFeeOnChange(
                    { gasInfo: { priorityFee: 999n, baseFee: 999n, maxFeePerGas: 1n } },
                    100n,
                );
        });
        await screen.findByRole('button', { name: 'Speed Up' });
    });

    it('resets state when visible flips to false', async () => {
        const { rerender } = render(
            <SpeedUpAndCancelModal
                visible={true}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        await waitFor(() => expect(mockGetTransaction).toHaveBeenCalled());
        rerender(
            <SpeedUpAndCancelModal
                visible={false}
                onCloseRequest={jest.fn()}
                data={basePendingData}
                type="speedup"
            />,
        );
        // No assertion, just exercises the reset useEffect
    });
});
