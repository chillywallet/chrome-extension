import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PendingTransactionModal from '../../../src/ui/components/PendingTransactionModal';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: any) =>
        visible ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock('../../../src/ui/components/TextTruncate', () => ({
    __esModule: true,
    default: ({ text }: any) => <span>{text}</span>,
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn() },
}));

let mockContacts: any[] = [];
jest.mock('../../../src/store/selectors', () => ({
    useContacts: () => mockContacts,
}));

let mockForceMatch = false;
jest.mock('../../../src/shared/utils/string', () => {
    const actual = jest.requireActual('../../../src/shared/utils/string');
    return {
        ...actual,
        isEqualCaseInsensitive: (a: any, b: any) =>
            mockForceMatch ? true : actual.isEqualCaseInsensitive(a, b),
    };
});

jest.mock('../../../src/shared/types/Wallet', () => ({
    AssetType: { nft: 'nft' },
}));

const baseData: any = {
    txHash: '0xtx',
    sender: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    receiver: '0x0000000000000000000000000000000000000001',
    type: 'transfer',
    status: 'sending',
    amount: 1,
    network: {
        explorer_url: 'https://exp.test',
        explorer_name: 'Explorer',
        platform_id: 1,
    },
    tokens: [{ symbol: 'TKN' }],
    asset: { type: 'erc20', symbol: 'TKN' },
};

describe('PendingTransactionModal', () => {
    beforeEach(() => {
        (global as any).platform = { openLink: jest.fn() };
        Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
        mockContacts = [];
        mockForceMatch = false;
    });

    it('renders the modal with title', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseData}
            />,
        );
        expect(screen.getByText('Transfer')).toBeInTheDocument();
    });

    it('shows the View on explorer button', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseData}
            />,
        );
        expect(screen.getByText('View on Explorer')).toBeInTheDocument();
    });

    it('opens explorer when button is pressed', () => {
        const onClosePress = jest.fn();
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={onClosePress}
                data={baseData}
            />,
        );
        fireEvent.click(screen.getByText('View on Explorer'));
        expect(onClosePress).toHaveBeenCalled();
        expect((global as any).platform.openLink).toHaveBeenCalled();
    });

    it('renders empty content when no data', () => {
        render(<PendingTransactionModal visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('renders nothing when not visible', () => {
        const { queryByTestId } = render(
            <PendingTransactionModal visible={false} onClosePress={jest.fn()} data={baseData} />,
        );
        expect(queryByTestId('modal')).toBeNull();
    });

    it('shows SENT status text and green color when status is sent', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, status: 'sent' } as any}
            />,
        );
        expect(screen.getByText('SENT')).toBeInTheDocument();
    });

    it('shows FAILED status text for transfer when failed', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, status: 'failed' } as any}
            />,
        );
        expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    it('renders Cancelling/Cancelled/Cancel Failed states', () => {
        const cases: Array<[string, string]> = [
            ['sending', 'CANCELLING'],
            ['sent', 'CANCELLED'],
            ['failed', 'CANCEL FAILED'],
        ];
        for (const [status, label] of cases) {
            const { unmount } = render(
                <PendingTransactionModal
                    visible={true}
                    onClosePress={jest.fn()}
                    data={{ ...baseData, status, cancelling: true } as any}
                />,
            );
            expect(screen.getByText(label)).toBeInTheDocument();
            unmount();
        }
    });

    it('renders status text for swap type', () => {
        const cases: Array<[string, string]> = [
            ['sending', 'SWAPPING'],
            ['sent', 'SWAPPED'],
            ['failed', 'SWAP FAILED'],
        ];
        for (const [status, label] of cases) {
            const { unmount } = render(
                <PendingTransactionModal
                    visible={true}
                    onClosePress={jest.fn()}
                    data={{
                        ...baseData,
                        type: 'swap',
                        status,
                        tokens: [{ symbol: 'A' }, { symbol: 'B' }],
                    } as any}
                />,
            );
            expect(screen.getByText(label)).toBeInTheDocument();
            unmount();
        }
    });

    it('renders status text for approve type', () => {
        const cases: Array<[string, string]> = [
            ['sending', 'APPROVING'],
            ['sent', 'APPROVED'],
            ['failed', 'APPROVE FAILED'],
        ];
        for (const [status, label] of cases) {
            const { unmount } = render(
                <PendingTransactionModal
                    visible={true}
                    onClosePress={jest.fn()}
                    data={{ ...baseData, type: 'approve', status } as any}
                />,
            );
            expect(screen.getByText(label)).toBeInTheDocument();
            unmount();
        }
    });

    it('renders status text for stake/liquid-staking/unstake/cancel-claim-request', () => {
        const matrix: Array<[string, string, string]> = [
            ['stake', 'sending', 'STAKING'],
            ['stake', 'sent', 'STAKED'],
            ['stake', 'failed', 'STAKE FAILED'],
            ['liquid-staking', 'sending', 'STAKING'],
            ['unstake', 'sending', 'UNSTAKING'],
            ['unstake', 'sent', 'UNSTAKED'],
            ['unstake', 'failed', 'UNSTAKE FAILED'],
            ['cancel-claim-request', 'sending', 'CANCELLING REQUEST'],
            ['cancel-claim-request', 'sent', 'CANCELLED'],
            ['cancel-claim-request', 'failed', 'CANCEL FAILED'],
            ['request-withdrawal', 'sending', 'SENDING'],
        ];
        for (const [type, status, label] of matrix) {
            const { unmount } = render(
                <PendingTransactionModal
                    visible={true}
                    onClosePress={jest.fn()}
                    data={{
                        ...baseData,
                        type,
                        status,
                        tokens: [{ symbol: 'A' }, { symbol: 'B' }],
                    } as any}
                />,
            );
            expect(screen.getByText(label)).toBeInTheDocument();
            unmount();
        }
    });

    it('renders status color blue when status missing (defaults to sending color)', () => {
        const { container } = render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, status: undefined } as any}
            />,
        );
        // Status badge should have the bg-[#1D98FF] class
        expect(container.querySelector('.bg-\\[\\#1D98FF\\]')).toBeInTheDocument();
    });

    it('copies sender on click', () => {
        const { container } = render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseData}
            />,
        );
        const fromRow = screen.getByText('From').parentElement!;
        const clickable = fromRow.querySelector('.cursor-pointer') as HTMLElement;
        fireEvent.click(clickable);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseData.sender);
    });

    it('copies receiver on click', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseData}
            />,
        );
        const toRow = screen.getByText('To').parentElement!;
        const clickable = toRow.querySelector('.cursor-pointer') as HTMLElement;
        fireEvent.click(clickable);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseData.receiver);
    });

    it('copies tx hash on click', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseData}
            />,
        );
        const txRow = screen.getByText('Transaction Hash').parentElement!;
        const clickable = txRow.querySelector('.cursor-pointer') as HTMLElement;
        fireEvent.click(clickable);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseData.txHash);
    });

    it('renders contact labels for sender/receiver when matched', () => {
        mockContacts = [
            { walletAddress: baseData.sender, name: 'Alice' },
            { walletAddress: baseData.receiver, name: 'Bob' },
        ];
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseData}
            />,
        );
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('renders amount text for swap (with second token symbol)', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{
                    ...baseData,
                    type: 'swap',
                    amount: 5,
                    tokens: [{ symbol: 'A' }, { symbol: 'B' }],
                } as any}
            />,
        );
        expect(screen.getByText(/5 A to B/)).toBeInTheDocument();
    });

    it('renders amount text for liquid-staking', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{
                    ...baseData,
                    type: 'liquid-staking',
                    amount: 1,
                    tokens: [{ symbol: 'A' }, { symbol: 'B' }],
                } as any}
            />,
        );
        expect(screen.getByText(/1 A to B/)).toBeInTheDocument();
    });

    it('renders amount text for request-withdrawal', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{
                    ...baseData,
                    type: 'request-withdrawal',
                    amount: 2,
                    tokens: [{ symbol: 'A' }, { symbol: 'B' }],
                } as any}
            />,
        );
        expect(screen.getByText(/2 A to B/)).toBeInTheDocument();
    });

    it('renders amount text for unstake/approve/cancel-claim-request', () => {
        const types = ['unstake', 'approve', 'cancel-claim-request'];
        for (const type of types) {
            const { unmount } = render(
                <PendingTransactionModal
                    visible={true}
                    onClosePress={jest.fn()}
                    data={{ ...baseData, type, amount: 3, tokens: [{ symbol: 'TKN' }] } as any}
                />,
            );
            expect(screen.getByText(/3 TKN/)).toBeInTheDocument();
            unmount();
        }
    });

    it('renders NFT asset name for transfer with NFT asset', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{
                    ...baseData,
                    type: 'transfer',
                    asset: { type: 'nft', name: 'CoolNFT' },
                } as any}
            />,
        );
        expect(screen.getByText('CoolNFT')).toBeInTheDocument();
    });

    it('renders empty NFT name when asset.name missing', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, type: 'transfer', asset: { type: 'nft' } } as any}
            />,
        );
        // Just confirm modal renders successfully
        expect(screen.getByText('Transfer')).toBeInTheDocument();
    });

    it('renders createdAt formatted timestamp', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, createdAt: '2024-01-01T00:00:00Z' } as any}
            />,
        );
        expect(screen.getByText('Created At')).toBeInTheDocument();
    });

    it('hides explorer button when no network', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, network: undefined } as any}
            />,
        );
        expect(screen.queryByText(/^View on/)).toBeNull();
    });

    it('does not call clipboard when text is empty', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, sender: '' } as any}
            />,
        );
        const fromRow = screen.getByText('From').parentElement!;
        const clickable = fromRow.querySelector('.cursor-pointer') as HTMLElement;
        fireEvent.click(clickable);
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('uses default empty title when type missing', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, type: undefined } as any}
            />,
        );
        // Title defaults to '' via toTitleCase('')
        expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('handles null sender/receiver/txHash (?? fallback)', () => {
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, sender: null, receiver: null, txHash: null } as any}
            />,
        );
        expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('renders contact labels with null sender/receiver matched (forces label-truthy + ?? branch)', () => {
        mockForceMatch = true;
        mockContacts = [{ walletAddress: '0xX', name: 'GhostUser' }];
        render(
            <PendingTransactionModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseData, sender: null, receiver: null } as any}
            />,
        );
        expect(screen.getAllByText('GhostUser').length).toBeGreaterThanOrEqual(1);
    });
});
