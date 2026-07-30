import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SwapSentModal from '../../../src/ui/components/SwapSentModal';
import logger from '../../../src/shared/utils/logger';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children, onClose }: any) =>
        visible ? (
            <div data-testid="modal">
                <button data-testid="modal-close" onClick={onClose}>
                    modal-close
                </button>
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/PendingTxtMenu', () => ({
    __esModule: true,
    default: () => <div data-testid="pending-menu" />,
}));

jest.mock('../../../src/shared/utils/Images', () => ({
    Images: { iconError: 'err.png', iconSuccess: 'ok.png' },
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: {
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    updatePendingTransactionStatus: jest.fn(),
}));

const mockUseSelectedNetwork = jest.fn();
jest.mock('../../../src/store/selectors', () => ({
    useSelectedNetwork: () => mockUseSelectedNetwork(),
}));

const defaultNetwork = {
    chain_id: 1,
    explorer_url: 'https://exp.test',
    explorer_name: 'Exp',
    platform_id: 1,
};

describe('SwapSentModal', () => {
    beforeEach(() => {
        mockDispatch.mockImplementation(() => Promise.resolve('sent'));
        mockUseSelectedNetwork.mockReturnValue(defaultNetwork);
        (global as any).platform = { openLink: jest.fn() };
    });

    it('renders Transaction Sent text', () => {
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        expect(screen.getByText('Transaction Sent')).toBeInTheDocument();
        expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('renders successText only on Success status', () => {
        const { rerender } = render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                successText="all good"
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        expect(screen.getByText('all good')).toBeInTheDocument();

        rerender(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                successText="all good"
                txtData={{ status: 'failed', txHash: '0xtx' } as any}
            />,
        );
        expect(screen.queryByText('all good')).toBeNull();
    });

    it('renders Pending status for sending', () => {
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sending', txHash: '0xtx' } as any}
            />,
        );
        expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders Cancelled when sent + cancelling', () => {
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx', cancelling: true } as any}
            />,
        );
        expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('renders Try Again on failed status', () => {
        const onTryAgainPress = jest.fn();
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'failed', txHash: '0xtx' } as any}
                onTryAgainPress={onTryAgainPress}
            />,
        );
        fireEvent.click(screen.getByText('Try Again'));
        expect(onTryAgainPress).toHaveBeenCalled();
    });

    it('does not render Try Again on success', () => {
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
                onTryAgainPress={jest.fn()}
            />,
        );
        expect(screen.queryByText('Try Again')).toBeNull();
    });

    it('Close button calls onCloseRequest', () => {
        const onCloseRequest = jest.fn();
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={onCloseRequest}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        fireEvent.click(screen.getByText('Close'));
        expect(onCloseRequest).toHaveBeenCalled();
    });

    it('Modal onClose triggers onCloseRequest (covers line 129)', () => {
        const onCloseRequest = jest.fn();
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={onCloseRequest}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        fireEvent.click(screen.getByTestId('modal-close'));
        expect(onCloseRequest).toHaveBeenCalled();
    });

    it('uses provided network prop over default selected network', () => {
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
                network={
                    {
                        chain_id: 2,
                        explorer_url: 'https://other.test',
                        explorer_name: 'OtherExp',
                        platform_id: 2,
                    } as any
                }
            />,
        );
        expect(screen.getByText('View on OtherExp')).toBeInTheDocument();
    });

    it('opens explorer link when View button clicked', () => {
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        fireEvent.click(screen.getByText('View on Exp'));
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            'https://exp.test/tx/0xtx',
            '_blank',
        );
    });

    it('renders PendingTxtMenu when onMenuPress and txtData provided', () => {
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
                onMenuPress={jest.fn()}
            />,
        );
        expect(screen.getByTestId('pending-menu')).toBeInTheDocument();
    });

    it('does not render View button when explorer_url is missing', () => {
        // selectedNetwork without explorer_url
        mockUseSelectedNetwork.mockReturnValue({
            chain_id: 1,
            platform_id: 1,
            explorer_name: '',
        });
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        expect(screen.queryByText(/^View on/)).toBeNull();
    });

    it('handles undefined selectedNetwork gracefully (covers line 66 buttonTitle empty fallback)', () => {
        mockUseSelectedNetwork.mockReturnValue(undefined as any);
        const { container } = render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        // No View button rendered
        expect(container.textContent).not.toMatch(/View on/);
    });

    it('triggers updateTxtStatus on dispatch resolution for sent status', async () => {
        const setTxtData = jest.fn();
        const onSwapSuccess = jest.fn();
        mockDispatch.mockImplementation(() => Promise.resolve('sent'));
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={setTxtData}
                onSwapSuccess={onSwapSuccess}
                txtData={{ status: 'sending', txHash: '0xtx', trackData: { foo: 1 } } as any}
            />,
        );
        await waitFor(() => expect(onSwapSuccess).toHaveBeenCalled());
        expect(setTxtData).toHaveBeenCalled();
    });

    it('triggers updateTxtStatus on dispatch resolution for failed status (covers logger.log)', async () => {
        const setTxtData = jest.fn();
        mockDispatch.mockImplementation(() => Promise.resolve('failed'));
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={setTxtData}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sending', txHash: '0xtx' } as any}
            />,
        );
        await waitFor(() => expect(setTxtData).toHaveBeenCalled());
        expect((logger.log as jest.Mock)).toHaveBeenCalledWith('Swap Failed', expect.any(Object));
    });

    it('recurses updateStatus while still sending (covers line 110)', async () => {
        const setTxtData = jest.fn();
        let calls = 0;
        mockDispatch.mockImplementation(() => {
            calls++;
            if (calls === 1) return Promise.resolve('sending');
            return Promise.resolve('sent');
        });
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={setTxtData}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sending', txHash: '0xtx', trackData: {} } as any}
            />,
        );
        // Should have called dispatch at least twice (once initial, once recursive)
        await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(2));
    });

    it('does not run updateStatus when txtData has no txHash', () => {
        mockDispatch.mockClear();
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={undefined}
            />,
        );
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('does not run updateStatus when status is already final (sent)', async () => {
        mockDispatch.mockClear();
        render(
            <SwapSentModal
                visible={true}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        // Status already 'sent' -> the effect does not invoke dispatch
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('renders nothing when not visible', () => {
        const { queryByTestId } = render(
            <SwapSentModal
                visible={false}
                onCloseRequest={jest.fn()}
                setTxtData={jest.fn()}
                onSwapSuccess={jest.fn()}
                txtData={{ status: 'sent', txHash: '0xtx' } as any}
            />,
        );
        expect(queryByTestId('modal')).toBeNull();
    });
});
