import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TransactionCard, { Placeholder } from '../../../src/ui/components/TransactionCard';

jest.mock('../../../src/ui/components/AssetLogo', () => ({
    __esModule: true,
    default: ({ src }: { src?: string }) => <div data-testid="asset-logo" data-src={src ?? ''} />,
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn() },
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    getCoinByTokenAddress: jest.fn().mockResolvedValue({ logo: 'coin.png' }),
}));

let mockContacts: any[] = [];
let mockPlatformId = 1;
jest.mock('../../../src/store/selectors', () => ({
    useContacts: () => mockContacts,
}));
jest.mock('../../../src/store/selectors/wallet', () => ({
    useCurrentPlatformId: () => mockPlatformId,
}));

const baseTx: any = {
    timestamp: '2024-01-01T00:00:00Z',
    method: 'transfer',
    type: 'transfer',
    fee: '0.001',
    fee_usd: 1.0,
    currency: 'ETH',
    platform_id: 1,
    success: true,
    wallet_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    to: '0x0000000000000000000000000000000000000001',
    transfers: [],
};

describe('TransactionCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockContacts = [];
        mockPlatformId = 1;
        Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
    });

    it('Placeholder renders', () => {
        const { container } = render(<Placeholder />);
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('renders the transaction name', async () => {
        render(<TransactionCard data={baseTx} onPress={jest.fn()} />);
        await screen.findByText('Transfer');
    });

    it('calls onPress when clicked', async () => {
        const onPress = jest.fn();
        render(<TransactionCard data={baseTx} onPress={onPress} />);
        await screen.findByText('Transfer');
        fireEvent.click(screen.getByText('Transfer'));
        expect(onPress).toHaveBeenCalledWith(baseTx);
    });

    it('uses contact name when matched', async () => {
        mockContacts = [
            {
                walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
                name: 'Alice',
            },
        ];
        render(<TransactionCard data={baseTx} onPress={jest.fn()} />);
        await screen.findByText('Alice');
    });

    it('shows alert icon when transaction failed', async () => {
        const { container } = render(
            <TransactionCard data={{ ...baseTx, success: false }} onPress={jest.fn()} />,
        );
        await screen.findByText('Transfer');
        expect(container.querySelector('[name="alert"]')).toBeInTheDocument();
    });

    it('copies wallet address on copy icon click', async () => {
        render(<TransactionCard data={baseTx} onPress={jest.fn()} />);
        await screen.findByText('Transfer');
        const { container } = render(
            <TransactionCard data={baseTx} onPress={jest.fn()} />,
        );
        const copyBtn = container.querySelector('.cursor-pointer.text-gray-400') as HTMLElement;
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseTx.wallet_address);
    });

    it('aggregates erc20 transfers (in and out) into formatted tokenAmount', async () => {
        const txWithTransfers: any = {
            ...baseTx,
            transfers: [
                {
                    from_address: baseTx.wallet_address,
                    to_address: '0xabc',
                    token_amount_formatted: '1.5',
                    token_symbol: 'TKN',
                    type: 'erc20',
                    token_meta: { logo: 'tkn.png' },
                },
                {
                    from_address: baseTx.wallet_address,
                    to_address: '0xabc',
                    token_amount_formatted: '2.5',
                    token_symbol: 'TKN',
                    type: 'erc20',
                    token_meta: { logo: 'tkn.png' },
                },
                {
                    from_address: '0xabc',
                    to_address: baseTx.wallet_address,
                    token_amount_formatted: '3',
                    token_symbol: 'OTH',
                    type: 'native',
                    token_meta: { logo: 'oth.png' },
                },
            ],
        };
        render(<TransactionCard data={txWithTransfers} onPress={jest.fn()} />);
        // Out total 4, In 3
        await screen.findByText(/-4 TKN/);
        expect(screen.getByText(/\+3 OTH/)).toBeInTheDocument();
    });

    it('shows NFT token symbol and stops aggregating when an NFT transfer is found', async () => {
        const txNft: any = {
            ...baseTx,
            transfers: [
                {
                    from_address: baseTx.wallet_address,
                    to_address: '0xabc',
                    token_amount_formatted: '',
                    token_symbol: 'CRYPTOKITTY',
                    type: 'erc721',
                    token_meta: { logo: 'nft.png' },
                },
            ],
        };
        render(<TransactionCard data={txNft} onPress={jest.fn()} />);
        await screen.findByText('CRYPTOKITTY');
    });

    it('ignores transfers when wallet_address is not involved', async () => {
        const txOther: any = {
            ...baseTx,
            transfers: [
                {
                    from_address: '0xother1',
                    to_address: '0xother2',
                    token_amount_formatted: '1',
                    token_symbol: 'X',
                    type: 'erc20',
                    token_meta: { logo: 'x.png' },
                },
            ],
        };
        render(<TransactionCard data={txOther} onPress={jest.fn()} />);
        // Should render but no +/- token amount
        await screen.findByText('Transfer');
        expect(screen.queryByText(/\+1 X|-1 X/)).toBeNull();
    });

    it('does not copy when wallet_address is missing', async () => {
        const txNoWallet: any = { ...baseTx, wallet_address: '' };
        const { container } = render(
            <TransactionCard data={txNoWallet} onPress={jest.fn()} />,
        );
        await screen.findByText('Transfer');
        const copyBtn = container.querySelector('.cursor-pointer.text-gray-400') as HTMLElement;
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('falls back to "type" when method is missing', async () => {
        const tx: any = { ...baseTx, method: undefined, type: 'mint' };
        render(<TransactionCard data={tx} onPress={jest.fn()} />);
        await screen.findByText('Mint');
    });

    it('renders empty name when both method and type missing', async () => {
        const tx: any = { ...baseTx, method: undefined, type: undefined };
        const { container } = render(<TransactionCard data={tx} onPress={jest.fn()} />);
        // Wait microtask for effect
        await waitFor(() => expect(container.querySelector('.font-semibold')).toBeInTheDocument());
    });

    it('aggregates transfers with empty token_amount_formatted as 0', async () => {
        const txEmptyAmt: any = {
            ...baseTx,
            transfers: [
                {
                    from_address: baseTx.wallet_address,
                    to_address: '0xabc',
                    token_amount_formatted: '',
                    token_symbol: 'EMP',
                    type: 'erc20',
                    token_meta: null,
                },
                {
                    from_address: baseTx.wallet_address,
                    to_address: '0xabc',
                    token_amount_formatted: '',
                    token_symbol: 'EMP',
                    type: 'erc20',
                    token_meta: null,
                },
            ],
        };
        render(<TransactionCard data={txEmptyAmt} onPress={jest.fn()} />);
        await screen.findByText(/-0 EMP/);
    });

    it('handles different symbol same direction as separate entries', async () => {
        const tx: any = {
            ...baseTx,
            transfers: [
                {
                    from_address: baseTx.wallet_address,
                    to_address: '0xabc',
                    token_amount_formatted: '1',
                    token_symbol: 'A',
                    type: 'erc20',
                    token_meta: null,
                },
                {
                    from_address: baseTx.wallet_address,
                    to_address: '0xabc',
                    token_amount_formatted: '2',
                    token_symbol: 'B',
                    type: 'erc20',
                    token_meta: null,
                },
            ],
        };
        render(<TransactionCard data={tx} onPress={jest.fn()} />);
        await screen.findByText(/-1 A, -2 B/);
    });

    it('handles missing fee, currency and fee_usd defaults', async () => {
        const tx: any = {
            ...baseTx,
            fee: undefined,
            fee_usd: undefined,
            currency: undefined,
            wallet_address: '',
        };
        render(<TransactionCard data={tx} onPress={jest.fn()} />);
        await screen.findByText('Transfer');
    });

    it('keeps same symbol with opposite directions as separate amounts', async () => {
        const tx: any = {
            ...baseTx,
            transfers: [
                {
                    from_address: baseTx.wallet_address,
                    to_address: '0xabc',
                    token_amount_formatted: '1',
                    token_symbol: 'SYM',
                    type: 'erc20',
                    token_meta: null,
                },
                {
                    from_address: '0xabc',
                    to_address: baseTx.wallet_address,
                    token_amount_formatted: '2',
                    token_symbol: 'SYM',
                    type: 'erc20',
                    token_meta: null,
                },
            ],
        };
        render(<TransactionCard data={tx} onPress={jest.fn()} />);
        await screen.findByText(/-1 SYM, \+2 SYM/);
    });
});
