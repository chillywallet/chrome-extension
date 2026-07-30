import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { ChillyAccount, ChillyWallet } from '../../../src/shared/types/Wallet';
import AccountSelectModal from '../../../src/ui/components/AccountSelectModal';

const mockUseWallets = jest.fn();
const mockUseAccounts = jest.fn();
const mockUseKeyrings = jest.fn();

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useWallets: () => mockUseWallets(),
    useAccounts: () => mockUseAccounts(),
    useKeyrings: () => mockUseKeyrings(),
}));

jest.mock('../../../src/store/selectorUtils', () => ({
    getAllAccounts: () => mockUseAccounts(),
}));

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, className, onClick }: { children?: React.ReactNode; className?: string; onClick?: () => void }) => (
            <div className={className} onClick={onClick} data-testid="motion-div">
                {children}
            </div>
        ),
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0.3,
}));

function accountFixture(overrides: Partial<ChillyAccount> = {}): ChillyAccount {
    return {
        id: 'acc-1',
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        type: 'eip155:eoa',
        options: {},
        methods: [],
        metadata: {
            name: 'Primary',
            importTime: 1,
            keyring: { type: 'HD Key Tree' },
            avatar: '🦊',
            smartAvatar: '🤖',
            ...overrides.metadata,
        },
        ...overrides,
    } as ChillyAccount;
}

function walletFixture(overrides: Partial<ChillyWallet> = {}): ChillyWallet {
    return {
        id: 'wallet-1',
        name: 'Test Wallet',
        importTime: 100,
        ...overrides,
    };
}

function setupStore(opts: {
    wallets: ChillyWallet[];
    accounts: ChillyAccount[];
    keyrings: { id: string; accounts: string[]; type: string }[];
}) {
    mockUseWallets.mockReturnValue(opts.wallets);
    mockUseAccounts.mockReturnValue(opts.accounts);
    mockUseKeyrings.mockReturnValue(opts.keyrings);
}

describe('AccountSelectModal', () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    const acc1 = accountFixture({
        id: 'a1',
        address: '0x1111111111111111111111111111111111111111',
        metadata: { name: 'Acc One', importTime: 10, keyring: { type: 'HD Key Tree' } },
    });
    const acc2 = accountFixture({
        id: 'a2',
        address: '0x2222222222222222222222222222222222222222',
        metadata: { name: 'Acc Two', importTime: 20, keyring: { type: 'HD Key Tree' } },
    });
    const w1 = walletFixture({ id: 'w1', name: 'Wallet One', importTime: 50 });
    const w2 = walletFixture({ id: 'w2', name: 'Wallet Two', importTime: 150 });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders title and wallet sections when visible', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1],
            keyrings: [{ id: 'w1', accounts: [acc1.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[acc1]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByText('Select Accounts')).toBeInTheDocument();
        expect(screen.getByText('Wallet One')).toBeInTheDocument();
        expect(screen.getByText('Acc One')).toBeInTheDocument();
    });

    it('shows empty account list when wallet has no matching keyring', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1],
            keyrings: [],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByText('Wallet One')).toBeInTheDocument();
        expect(screen.queryByText('Acc One')).not.toBeInTheDocument();
    });

    it('uses smart address path when isSmartWallet is true', () => {
        const smartAcc = accountFixture({
            ...acc1,
            smartAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            metadata: { ...acc1.metadata, smartAvatar: '⭐' },
        });
        setupStore({
            wallets: [w1],
            accounts: [smartAcc],
            keyrings: [{ id: 'w1', accounts: [smartAcc.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet
                selectedAccounts={[smartAcc]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        /** smartAddress runs through ethers.getAddress → EIP-55 checksum */
        expect(
            screen.getByText('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa'),
        ).toBeInTheDocument();
    });

    it('shows raw address when checksum conversion fails', () => {
        const bad = accountFixture({
            id: 'bad',
            address: 'not-a-valid-address',
            metadata: { name: 'Bad', importTime: 1, keyring: { type: 'HD Key Tree' } },
        });
        setupStore({
            wallets: [w1],
            accounts: [bad],
            keyrings: [{ id: 'w1', accounts: [bad.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[bad]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByText('not-a-valid-address')).toBeInTheDocument();
    });

    it('disables Confirm when nothing is selected', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1],
            keyrings: [{ id: 'w1', accounts: [acc1.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });

    it('selects an account via Checkbox onChange adding to empty selection', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1, acc2],
            keyrings: [{ id: 'w1', accounts: [acc1.address, acc2.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        const accRow = screen.getByText('Acc One').closest(
            '.flex.flex-row.items-center.justify-between.py-2',
        );
        expect(accRow).toBeTruthy();
        const checkboxRoot = accRow!.querySelector('label.cursor-pointer');
        expect(checkboxRoot).toBeTruthy();
        fireEvent.click(checkboxRoot as Element);

        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        expect(onConfirm).toHaveBeenCalledWith([acc1]);
        expect(onClose).toHaveBeenCalled();
    });

    it('toggles selection when account row is clicked', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1, acc2],
            keyrings: [{ id: 'w1', accounts: [acc1.address, acc2.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[acc1, acc2]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        fireEvent.click(screen.getByText('Acc One'));

        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm.mock.calls[0][0]).toEqual(expect.arrayContaining([acc2]));
        expect(onConfirm.mock.calls[0][0]).not.toEqual(expect.arrayContaining([acc1]));
        expect(onClose).toHaveBeenCalled();
    });

    it('wallet header checkbox selects all accounts when partially selected', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1, acc2],
            keyrings: [{ id: 'w1', accounts: [acc1.address, acc2.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[acc1]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        const headerRow = screen.getByText('Wallet One').closest('.justify-between');
        expect(headerRow).toBeTruthy();
        const walletCheckbox = headerRow!.querySelector('label.cursor-pointer');
        expect(walletCheckbox).toBeTruthy();
        fireEvent.click(walletCheckbox as Element);

        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        expect(onConfirm.mock.calls[0][0]).toHaveLength(2);
        expect(onClose).toHaveBeenCalled();
    });

    it('wallet header checkbox clears wallet selection so Confirm stays disabled', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1, acc2],
            keyrings: [{ id: 'w1', accounts: [acc1.address, acc2.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[acc1, acc2]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        const headerRow = screen.getByText('Wallet One').closest('.justify-between');
        fireEvent.click(headerRow!.querySelector('label.cursor-pointer') as Element);

        expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });

    it('Close button calls onClose', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1],
            keyrings: [{ id: 'w1', accounts: [acc1.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[acc1]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('resynchronizes selection from props when modal becomes visible again', () => {
        setupStore({
            wallets: [w1],
            accounts: [acc1, acc2],
            keyrings: [{ id: 'w1', accounts: [acc1.address, acc2.address], type: 'HD Key Tree' }],
        });

        const { rerender } = render(
            <AccountSelectModal
                visible={false}
                isSmartWallet={false}
                selectedAccounts={[acc1]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        rerender(
            <AccountSelectModal
                visible={true}
                isSmartWallet={false}
                selectedAccounts={[acc2]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        expect(onConfirm.mock.calls[0][0]).toEqual([acc2]);
    });

    it('renders smart wallet row with empty address when smartAddress is undefined', () => {
        const noSmartAcc = accountFixture({
            id: 'no-smart',
            address: '0x3333333333333333333333333333333333333333',
            metadata: { name: 'NoSmart', importTime: 1, keyring: { type: 'HD Key Tree' } },
        });
        setupStore({
            wallets: [w1],
            accounts: [noSmartAcc],
            keyrings: [{ id: 'w1', accounts: [noSmartAcc.address], type: 'HD Key Tree' }],
        });

        render(
            <AccountSelectModal
                visible
                isSmartWallet
                selectedAccounts={[]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByText('NoSmart')).toBeInTheDocument();
    });

    it('lists multiple wallets sorted by import time', () => {
        setupStore({
            wallets: [w2, w1],
            accounts: [acc1, acc2],
            keyrings: [
                { id: 'w1', accounts: [acc1.address], type: 'HD Key Tree' },
                { id: 'w2', accounts: [acc2.address], type: 'HD Key Tree' },
            ],
        });

        const { container } = render(
            <AccountSelectModal
                visible
                isSmartWallet={false}
                selectedAccounts={[acc1]}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        const headings = container.querySelectorAll('.text-xs.font-medium');
        const names = Array.from(headings).map(el => el.textContent);
        expect(names.indexOf('Wallet One')).toBeLessThan(names.indexOf('Wallet Two'));
    });
});
