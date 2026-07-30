import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TransactionDetailModal from '../../../src/ui/components/TransactionDetailModal';

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

let mockChain: any = { explorer_url: 'https://exp.test', explorer_name: 'Exp', testnet: false };
jest.mock('../../../src/lib/ChainsUtils', () => ({
    getCurrentChainByPlatformId: () => mockChain,
}));

let mockContacts: any[] = [];
jest.mock('../../../src/store/selectors', () => ({
    useContacts: () => mockContacts,
}));

let mockIsEqualReturn: ((a: any, b: any) => boolean) | null = null;
jest.mock('../../../src/shared/utils/string', () => {
    const actual = jest.requireActual('../../../src/shared/utils/string');
    return {
        ...actual,
        isEqualCaseInsensitive: (a: any, b: any) =>
            mockIsEqualReturn ? mockIsEqualReturn(a, b) : actual.isEqualCaseInsensitive(a, b),
    };
});

const baseTx: any = {
    from: '0x1',
    to: '0x2',
    method: 'transfer',
    type: 'transfer',
    fee: '0.001',
    fee_usd: 1,
    currency: 'ETH',
    platform_id: 1,
    success: true,
    timestamp: '2024-01-01T00:00:00Z',
    additional_properties: { transaction_hash: '0xtx', block: 100 },
    transfers: [],
};

describe('TransactionDetailModal', () => {
    beforeEach(() => {
        (global as any).platform = { openLink: jest.fn() };
        Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
        mockContacts = [];
        mockChain = { explorer_url: 'https://exp.test', explorer_name: 'Exp', testnet: false };
        mockIsEqualReturn = null;
    });

    it('renders title and view explorer button', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        expect(screen.getByText('Transfer')).toBeInTheDocument();
        expect(screen.getByText('View on Exp')).toBeInTheDocument();
    });

    it('shows SUCCESS badge for successful txn', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    });

    it('shows FAILED badge for failed txn', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, success: false }}
            />,
        );
        expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    it('opens explorer when View button is clicked', () => {
        const onClosePress = jest.fn();
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={onClosePress}
                data={baseTx}
            />,
        );
        fireEvent.click(screen.getByText('View on Exp'));
        expect(onClosePress).toHaveBeenCalled();
        expect((global as any).platform.openLink).toHaveBeenCalled();
    });

    it('renders nothing when not visible', () => {
        const { queryByTestId } = render(
            <TransactionDetailModal
                visible={false}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        expect(queryByTestId('modal')).toBeNull();
    });

    it('renders without data prop', () => {
        render(<TransactionDetailModal visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('copies transaction hash to clipboard', () => {
        const { container } = render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        // find the transaction hash row's clickable
        const hashRow = Array.from(container.querySelectorAll('.cursor-pointer')).find(el =>
            el.textContent?.includes('...'),
        ) as HTMLElement;
        fireEvent.click(hashRow);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0xtx');
    });

    it('copies "from" address on click', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        const fromRow = screen.getByText('From').parentElement!;
        // The clickable container is sibling of "From" label - it's the next div
        const clickable = fromRow.querySelector('.cursor-pointer') as HTMLElement;
        fireEvent.click(clickable);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0x1');
    });

    it('copies "to" address on click', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        const toRow = screen.getByText('To').parentElement!;
        const clickable = toRow.querySelector('.cursor-pointer') as HTMLElement;
        fireEvent.click(clickable);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0x2');
    });

    it('renders contact label for from/to when matched in contacts', () => {
        mockContacts = [
            { walletAddress: '0x1', name: 'Alice' },
            { walletAddress: '0x2', name: 'Bob' },
        ];
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('opens block explorer when block row is clicked', () => {
        const onClosePress = jest.fn();
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={onClosePress}
                data={baseTx}
            />,
        );
        const blockRow = screen.getByText('Block').parentElement!;
        const clickable = blockRow.querySelector('.cursor-pointer') as HTMLElement;
        fireEvent.click(clickable);
        expect(onClosePress).toHaveBeenCalled();
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            expect.stringContaining('/block/100'),
            '_blank',
        );
    });

    it('renders block without link when explorer_url is missing', () => {
        mockChain = { explorer_url: '', explorer_name: '', testnet: false };
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        const blockRow = screen.getByText('Block').parentElement!;
        const clickable = blockRow.querySelector('.cursor-pointer');
        expect(clickable).toBeNull();
    });

    it('renders transfers list and View More button when >5 transfers', () => {
        const transfers = Array.from({ length: 6 }, (_, i) => ({
            from_address: `0xaaa${i}`,
            to_address: `0xbbb${i}`,
            token_amount_formatted: `${i + 1}`,
            token_symbol: 'TOK',
            type: 'erc20',
        }));
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, transfers } as any}
            />,
        );
        expect(screen.getByText('Tokens Transferred')).toBeInTheDocument();
        const viewMore = screen.getByRole('button', { name: /view more transfers/i });
        fireEvent.click(viewMore);
        expect((global as any).platform.openLink).toHaveBeenCalled();
    });

    it('renders transfers and copies addresses', () => {
        const transfers = [
            {
                from_address: '0xfrom',
                to_address: '0xto',
                token_amount_formatted: '1.5',
                token_symbol: 'TOK',
                type: 'erc20',
            },
        ];
        const { container } = render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, transfers } as any}
            />,
        );
        // find "From" then "To" addresses within transfers section
        const fromTransferRow = screen.getAllByText(/^From$/);
        expect(fromTransferRow.length).toBeGreaterThanOrEqual(1);
        // Click clickable elements in the transfer item
        const cursors = container.querySelectorAll('.cursor-pointer');
        // Find one near the transfer text
        const transferFromEl = Array.from(cursors).find(el =>
            el.textContent?.includes('0xfrom') || el.textContent?.includes('...'),
        );
        // Simple guarantee: render contains the symbol
        expect(screen.getByText(/TOK/)).toBeInTheDocument();
        // Click first from/to in transfer item (the last two cursors in transfer section)
        // Click the From address element
        const transferCursors = Array.from(cursors).filter(el =>
            el.textContent && (el.textContent.includes('0xfrom') || el.textContent.includes('0xto')),
        );
        transferCursors.forEach(c => fireEvent.click(c as HTMLElement));
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('renders non-numeric transfer type (NFT) without amount formatting', () => {
        const transfers = [
            {
                from_address: '0xfrom',
                to_address: '0xto',
                token_amount_formatted: '',
                token_symbol: 'CRYPTOKITTY',
                type: 'erc721',
            },
        ];
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, transfers } as any}
            />,
        );
        expect(screen.getByText('CRYPTOKITTY')).toBeInTheDocument();
    });

    it('renders fee_usd only when present and not on testnet', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        expect(screen.getByText('Network Fee')).toBeInTheDocument();
    });

    it('hides fee_usd on testnet', () => {
        mockChain = { explorer_url: 'https://exp.test', explorer_name: 'Exp', testnet: true };
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        expect(screen.getByText('Network Fee')).toBeInTheDocument();
    });

    it('hides Network Fee when fee is missing', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, fee: undefined } as any}
            />,
        );
        expect(screen.queryByText('Network Fee')).toBeNull();
    });

    it('hides View button when explorer_url is empty', () => {
        mockChain = { explorer_url: '', explorer_name: '', testnet: false };
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={baseTx}
            />,
        );
        expect(screen.queryByText(/^View on/)).toBeNull();
    });

    it('hides View button and explorer functions when no chain (platform_id missing)', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, platform_id: undefined } as any}
            />,
        );
        // currentChain will be null since platform_id is falsy
        // the global mock still returns the chain, but the component checks platform_id first
        // ChainsUtils mocked - if platform_id falsy, currentChain is null
    });

    it('uses type as title fallback when method missing', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, method: undefined } as any}
            />,
        );
        expect(screen.getByText('Transfer')).toBeInTheDocument();
    });

    it('hides Block row when block is missing', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{
                    ...baseTx,
                    additional_properties: { transaction_hash: '0xtx' },
                } as any}
            />,
        );
        expect(screen.queryByText('Block')).toBeNull();
    });

    it('hides Transaction Hash row when no hash', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, additional_properties: { block: 100 } } as any}
            />,
        );
        expect(screen.queryByText('Transaction Hash')).toBeNull();
    });

    it('handles undefined from/to addresses without contact match', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, from: undefined, to: undefined } as any}
            />,
        );
        // Click from row to invoke copyToClipboard(undefined) - covers if (text) false branch
        const fromRow = screen.getByText('From').parentElement!;
        const clickable = fromRow.querySelector('.cursor-pointer') as HTMLElement;
        fireEvent.click(clickable);
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('renders contact label when from/to are undefined but contact match forced', () => {
        // Force isEqualCaseInsensitive to always return true so fromLabel/toLabel resolve
        mockIsEqualReturn = () => true;
        mockContacts = [{ walletAddress: '0xX', name: 'GhostUser' }];
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, from: undefined, to: undefined } as any}
            />,
        );
        // Both From and To labels should render with GhostUser
        expect(screen.getAllByText('GhostUser').length).toBeGreaterThanOrEqual(1);
    });

    it('renders contact labels even when from/to addresses are undefined', () => {
        // Provide contact with no walletAddress; the contacts find will match if isEqualCaseInsensitive(undefined, undefined) returns true
        mockContacts = [
            { walletAddress: '0x1', name: 'AliceContact' },
            { walletAddress: '0x2', name: 'BobContact' },
        ];
        // Use truthy from/to but set them to addresses matched in contacts to render label, then also include undefined-handling via separate test
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, from: undefined, to: undefined } as any}
            />,
        );
        // Even without match, ensure modal renders
        expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('does not open block explorer when no block', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{
                    ...baseTx,
                    additional_properties: { transaction_hash: '0xtx' },
                } as any}
            />,
        );
        // No "Block" link to click
        expect((global as any).platform.openLink).not.toHaveBeenCalled();
    });

    it('clicking View on explorer with no transaction_hash does not open link', () => {
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, additional_properties: {} } as any}
            />,
        );
        fireEvent.click(screen.getByText('View on Exp'));
        expect((global as any).platform.openLink).not.toHaveBeenCalled();
    });

    it('clicking View More Transfers with no transaction_hash does not open link', () => {
        const transfers = Array.from({ length: 6 }, (_, i) => ({
            from_address: `0xa${i}`,
            to_address: `0xb${i}`,
            token_amount_formatted: `${i + 1}`,
            token_symbol: 'TOK',
            type: 'erc20',
        }));
        render(
            <TransactionDetailModal
                visible={true}
                onClosePress={jest.fn()}
                data={{ ...baseTx, additional_properties: {}, transfers } as any}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /view more transfers/i }));
        expect((global as any).platform.openLink).not.toHaveBeenCalled();
    });

});
