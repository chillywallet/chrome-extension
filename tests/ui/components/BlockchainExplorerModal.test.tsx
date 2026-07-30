import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { ChainData } from '../../../src/shared/types/Chain';
import { GasPriceType } from '../../../src/shared/types/Chain';
import logger from '../../../src/shared/utils/logger';
import BlockchainExplorerModal, { Placeholder } from '../../../src/ui/components/BlockchainExplorerModal';
import { useSelectedNetwork } from '../../../src/store/selectors';

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
            <div className={className} data-testid="motion-div">
                {children}
            </div>
        ),
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0.3,
}));

const mockGetCurrentChains = jest.fn();

jest.mock('../../../src/lib/ChainsUtils', () => ({
    getCurrentChains: () => mockGetCurrentChains(),
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useSelectedNetwork: jest.fn(),
}));


const mockAccountsState: any = { accounts: {} };
jest.mock('../../../src/store/store', () => ({
    getReduxStore: () => ({
        getState: () => ({
            globalState: { internalAccounts: mockAccountsState },
        }),
    }),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: {
        log: jest.fn(),
    },
}));

function chainFixture(overrides: Partial<ChainData> = {}): ChainData {
    return {
        name: 'Ethereum',
        short_name: 'ETH',
        native_coin_symbol: 'ETH',
        native_coin_address: '0x0',
        native_coin_name: 'Ethereum',
        chain: 'ethereum',
        chain_id: 1,
        platform_id: 1027,
        explorer_url: 'https://etherscan.io',
        explorer_name: 'Etherscan',
        chain_key: 'ethereum',
        icon: '',
        gasPriceType: GasPriceType.GasPrice,
        swapSupport: true,
        smartWalletSupport: true,
        testnet: false,
        ...overrides,
    };
}

const WALLET_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const WALLET_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('BlockchainExplorerModal', () => {
    let openLinkSpy: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGetCurrentChains.mockReturnValue([
            chainFixture({ chain_id: 1, name: 'Ethereum', testnet: false }),
            chainFixture({
                chain_id: 137,
                name: 'Polygon',
                testnet: false,
                chain_key: 'polygon',
                explorer_url: 'https://polygonscan.com',
                explorer_name: 'Polygonscan',
            }),
            chainFixture({
                chain_id: 11155111,
                name: 'Sepolia',
                testnet: true,
                chain_key: 'ethereum_sepolia',
                explorer_url: 'https://sepolia.etherscan.io',
                explorer_name: 'Sepolia Etherscan',
            }),
            chainFixture({
                chain_id: 999,
                name: 'Ghost Chain',
                explorer_url: '',
            }),
        ]);

        (useSelectedNetwork as jest.Mock).mockReturnValue(chainFixture({ chain_id: 1 }));

        mockAccountsState.accounts = {
            a: { address: WALLET_A, metadata: {} },
            b: { address: WALLET_B, metadata: {} },
        };

        openLinkSpy = jest.fn();
        (global as unknown as { platform: { openLink: jest.Mock } }).platform = {
            ...(global as unknown as { platform?: { openLink: jest.Mock } }).platform,
            openLink: openLinkSpy,
        };
    });

    function renderModal(override?: Partial<{ visible: boolean }>) {
        const onClose = jest.fn();
        return {
            ...render(
                <MemoryRouter initialEntries={['/']}>
                    <BlockchainExplorerModal visible={override?.visible ?? true} onClose={onClose} />
                </MemoryRouter>,
            ),
            onClose,
        };
    }

    it('renders nothing meaningful when visible is false', async () => {
        renderModal({ visible: false });
        expect(screen.queryByText('Chain')).not.toBeInTheDocument();
        expect(screen.queryByText('Wallet')).not.toBeInTheDocument();
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
    });

    it('shows header, tabs and wallet heading', async () => {
        renderModal();

        expect(await screen.findByText('Chain')).toBeInTheDocument();
        expect(screen.getByText('Wallet')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Mainnet' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Testnet' })).toBeInTheDocument();
    });





    it('omits chains without explorer_url from network lists', async () => {
        renderModal();

        await screen.findByText('Ethereum');
        expect(screen.queryByText('Ghost Chain')).not.toBeInTheDocument();
    });

    it('opens Etherscan for the Ethereum mainnet and selected wallet', async () => {
        renderModal();

        await screen.findByText(WALLET_A);

        fireEvent.click(
            screen
                .getByText('Ethereum')
                .closest('.flex.flex-row.items-center')!
                .querySelector('input[type="checkbox"]')!,
        );

        const walletRow = screen.getByText(WALLET_A).closest('.cursor-pointer');
        fireEvent.click(within(walletRow as HTMLElement).getByRole('checkbox'));

        fireEvent.click(await screen.findByRole('button', { name: /View on Etherscan/ }));

        expect(openLinkSpy).toHaveBeenCalledWith(
            `https://etherscan.io/address/${WALLET_A}`,
            '_blank',
        );
    });

    it('uses Polygonscan URL when Polygon is selected', async () => {
        renderModal();

        await screen.findByText(WALLET_B);

        fireEvent.click(
            screen
                .getByText('Polygon')
                .closest('.flex.flex-row.items-center')!
                .querySelector('input[type="checkbox"]')!,
        );

        const walletRow = screen.getByText(WALLET_B).closest('.cursor-pointer');
        fireEvent.click(within(walletRow as HTMLElement).getByRole('checkbox'));

        fireEvent.click(
            await screen.findByRole('button', { name: /View on Polygonscan/ }),
        );

        expect(openLinkSpy).toHaveBeenCalledWith(`https://polygonscan.com/address/${WALLET_B}`, '_blank');
    });

    it('uses testnet explorer when that network is selected', async () => {
        renderModal();

        await screen.findByText(WALLET_B);

        fireEvent.click(screen.getByRole('tab', { name: 'Testnet' }));

        fireEvent.click(
            screen.getByText('Sepolia').closest('.flex.flex-row.items-center')!
                .querySelector('input[type="checkbox"]')!,
        );

        const walletRow = screen.getByText(WALLET_B).closest('.cursor-pointer');
        fireEvent.click(within(walletRow as HTMLElement).getByRole('checkbox'));

        fireEvent.click(
            await screen.findByRole('button', {
                name: /View on Sepolia Etherscan/,
            }),
        );

        expect(openLinkSpy).toHaveBeenCalledWith(`https://sepolia.etherscan.io/address/${WALLET_B}`, '_blank');
    });

    it('does not render explorer button until a wallet radio is checked', async () => {
        renderModal();
        await screen.findByText(WALLET_A);

        expect(screen.queryByRole('button', { name: /View on / })).not.toBeInTheDocument();

        const walletRow = screen.getByText(WALLET_A).closest('.cursor-pointer');
        fireEvent.click(within(walletRow as HTMLElement).getByRole('checkbox'));

        expect(await screen.findByRole('button', { name: /View on / })).toBeInTheDocument();
    });

    it('clears explorer action when wallet selection is toggled off', async () => {
        renderModal();
        await screen.findByText(WALLET_A);

        const checkbox = within(
            screen.getByText(WALLET_A).closest('.cursor-pointer') as HTMLElement,
        ).getByRole('checkbox');

        fireEvent.click(checkbox);
        expect(await screen.findByRole('button', { name: /View on / })).toBeInTheDocument();

        fireEvent.click(checkbox);
        expect(screen.queryByRole('button', { name: /View on / })).not.toBeInTheDocument();
    });

    it('calls onClose from header Close control', async () => {
        const { onClose } = renderModal();

        fireEvent.click(await screen.findByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('BlockchainExplorerModal Placeholder', () => {
    it('renders skeleton rows', () => {
        const { container } = render(<Placeholder />);
        expect(container.querySelectorAll('.animate-pulse').length).toBe(2);
    });
});
