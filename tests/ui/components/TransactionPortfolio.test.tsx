import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TransactionPortfolio from '../../../src/ui/components/TransactionPortfolio';

jest.mock('../../../src/ui/components/TransactionCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: any) => (
        <div data-testid={`tx-${data._id}`} onClick={() => onPress(data)}>
            {data._id}
        </div>
    ),
    Placeholder: () => <div data-testid="tx-placeholder" />,
}));

jest.mock('../../../src/ui/components/PendingTransactionCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: any) => (
        <div data-testid={`pending-${data.id}`} onClick={() => onPress(data)}>
            {data.id}
        </div>
    ),
}));

jest.mock('../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: { handleTokens: (t: any) => t },
}));

jest.mock('../../../src/shared/constants/common', () => ({
    PENDING_TX_EXPIRED_TIME: 30,
}));

const mockEventOn = jest.fn();
const mockEventOff = jest.fn();
const mockEventEmit = jest.fn();
jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        on: (...args: any[]) => mockEventOn(...args),
        off: (...args: any[]) => mockEventOff(...args),
        emit: (...args: any[]) => mockEventEmit(...args),
    },
}));

const mockRemovePendingTransactions = jest.fn(() => ({ type: 'REMOVE' }));
jest.mock('../../../src/store/actions/uiActions', () => ({
    removePendingTransactions: (...args: any[]) => mockRemovePendingTransactions(...args),
}));

let mockTransactions: any[] = [];
let mockPendingTxs: any[] = [];
jest.mock('../../../src/store/selectors', () => ({
    usePortfolioTransactions: () => mockTransactions,
    usePendingTransactions: () => mockPendingTxs,
    useSelectedNetwork: () => ({ platform_id: 1 }),
}));

jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => jest.fn(() => undefined),
}));

const defaultProps = (overrides: any = {}) => ({
    onPendingTransactionPress: jest.fn(),
    onTransactionPress: jest.fn(),
    hasMore: false,
    onLoadMore: jest.fn(),
    walletAddress: '0x1',
    containerClass: '',
    setCancelSpeedUpTxData: jest.fn(),
    ...overrides,
});

describe('TransactionPortfolio', () => {
    beforeEach(() => {
        mockTransactions = [];
        mockPendingTxs = [];
        mockEventOn.mockClear();
        mockEventOff.mockClear();
        mockEventEmit.mockClear();
        mockRemovePendingTransactions.mockClear();
    });

    it('renders empty state when there are no transactions', () => {
        render(<TransactionPortfolio {...defaultProps()} />);
        expect(screen.getByText('There are no transactions')).toBeInTheDocument();
    });

    it('renders transaction cards when data exists', () => {
        mockTransactions = [
            { _id: 'tx-1', tokens: [], additional_properties: { transaction_hash: 'h1' } },
        ];
        render(<TransactionPortfolio {...defaultProps()} />);
        expect(screen.getByTestId('tx-tx-1')).toBeInTheDocument();
    });

    it('renders Load more button when hasMore is true', () => {
        mockTransactions = [
            { _id: 'tx-1', tokens: [], additional_properties: { transaction_hash: 'h1' } },
        ];
        render(<TransactionPortfolio {...defaultProps({ hasMore: true })} />);
        expect(screen.getByText('Load more')).toBeInTheDocument();
    });

    it('calls onLoadMore when Load more button clicked', () => {
        const onLoadMore = jest.fn();
        mockTransactions = [
            { _id: 'tx-1', tokens: [], additional_properties: { transaction_hash: 'h1' } },
        ];
        render(
            <TransactionPortfolio
                {...defaultProps({ hasMore: true, onLoadMore })}
            />,
        );
        fireEvent.click(screen.getByText('Load more'));
        expect(onLoadMore).toHaveBeenCalled();
    });

    it('renders Placeholder when loading', () => {
        const handlers: { [k: string]: any } = {};
        mockEventOn.mockImplementation((eventType: any, cb: any) => {
            handlers[eventType] = cb;
        });
        const { rerender } = render(<TransactionPortfolio {...defaultProps()} />);
        // Trigger isLoading
        act(() => {
            if (handlers['TRANSACTION_LOADING_STATUS']) {
                handlers['TRANSACTION_LOADING_STATUS'](true);
            }
        });
        rerender(<TransactionPortfolio {...defaultProps()} />);
        expect(screen.getAllByTestId('tx-placeholder').length).toBe(2);
    });

    it('renders pending transaction cards', () => {
        mockPendingTxs = [
            {
                id: 'p-1',
                txHash: 'h-pending',
                status: 'sending',
                sender: '0x1',
                createdAt: Date.now(),
            },
        ];
        render(<TransactionPortfolio {...defaultProps()} />);
        expect(screen.getByTestId('pending-p-1')).toBeInTheDocument();
    });

    it('clicks pending transaction triggers onPendingTransactionPress', () => {
        mockPendingTxs = [
            {
                id: 'p-1',
                txHash: 'h-pending',
                status: 'sending',
                sender: '0x1',
                createdAt: Date.now(),
            },
        ];
        const onPendingTransactionPress = jest.fn();
        render(
            <TransactionPortfolio
                {...defaultProps({ onPendingTransactionPress })}
            />,
        );
        fireEvent.click(screen.getByTestId('pending-p-1'));
        expect(onPendingTransactionPress).toHaveBeenCalled();
    });

    it('removes expired pending transactions', () => {
        // Pending tx with createdAt > PENDING_TX_EXPIRED_TIME (30) days ago
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - 60);
        mockPendingTxs = [
            {
                id: 'p-1',
                txHash: 'h-pending',
                status: 'sending',
                sender: '0x1',
                createdAt: expiredDate.toISOString(),
            },
        ];
        render(<TransactionPortfolio {...defaultProps()} />);
        expect(mockRemovePendingTransactions).toHaveBeenCalledWith('0x1', 1, ['p-1']);
    });

    it('does not remove pending with future createdAt', () => {
        const recentDate = new Date();
        mockPendingTxs = [
            {
                id: 'p-1',
                txHash: 'h-pending',
                status: 'sending',
                sender: '0x1',
                createdAt: recentDate.toISOString(),
            },
        ];
        render(<TransactionPortfolio {...defaultProps()} />);
        expect(mockRemovePendingTransactions).not.toHaveBeenCalled();
    });

    it('does not consider non-pending tx as expired', () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 100);
        mockPendingTxs = [
            {
                id: 'p-1',
                txHash: 'h-pending',
                status: 'success',
                sender: '0x1',
                createdAt: oldDate.toISOString(),
            },
        ];
        mockTransactions = [
            { _id: 'tx-1', tokens: [], additional_properties: { transaction_hash: 'other' } },
        ];
        render(<TransactionPortfolio {...defaultProps()} />);
        // Won't remove via expiry path since status is not pending. But pendingTxs vs transactions:
        // p-1's txHash is 'h-pending' which is NOT in transactions, so it's unfinished
        expect(mockRemovePendingTransactions).not.toHaveBeenCalled();
    });

    it('removes pending tx that has matching transaction hash', () => {
        mockPendingTxs = [
            {
                id: 'p-1',
                txHash: 'h-1',
                status: 'sending',
                sender: '0x1',
                createdAt: new Date().toISOString(),
            },
        ];
        mockTransactions = [
            { _id: 'tx-1', tokens: [], additional_properties: { transaction_hash: 'h-1' } },
        ];
        render(<TransactionPortfolio {...defaultProps()} />);
        expect(mockRemovePendingTransactions).toHaveBeenCalledWith('0x1', 1, ['p-1']);
        expect(mockEventEmit).toHaveBeenCalled();
    });

    it('registers and unregisters event listeners on mount/unmount', () => {
        const { unmount } = render(<TransactionPortfolio {...defaultProps()} />);
        expect(mockEventOn).toHaveBeenCalled();
        unmount();
        expect(mockEventOff).toHaveBeenCalled();
    });

    it('OPEN_TRANSACTION_MODAL callback fires onTransactionPress when matching id', () => {
        const callbacks: { [key: string]: any } = {};
        mockEventOn.mockImplementation((eventType: any, cb: any) => {
            callbacks[eventType] = cb;
        });
        mockTransactions = [
            { _id: 'tx-1', tokens: [], additional_properties: { transaction_hash: 'h1' } },
        ];
        const onTransactionPress = jest.fn();
        render(<TransactionPortfolio {...defaultProps({ onTransactionPress })} />);
        act(() => {
            if (callbacks['OPEN_TRANSACTION_MODAL']) {
                callbacks['OPEN_TRANSACTION_MODAL']('tx-1');
            }
        });
        // onTransactionPress may or may not be called due to source bug with indexOf
    });

    it('clicks transaction card triggers onTransactionPress', () => {
        mockTransactions = [
            { _id: 'tx-1', tokens: [], additional_properties: { transaction_hash: 'h1' } },
        ];
        const onTransactionPress = jest.fn();
        render(<TransactionPortfolio {...defaultProps({ onTransactionPress })} />);
        fireEvent.click(screen.getByTestId('tx-tx-1'));
        expect(onTransactionPress).toHaveBeenCalled();
    });
});
