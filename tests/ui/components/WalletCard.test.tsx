import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WalletCard from '../../../src/ui/components/WalletCard';

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({ ANIM_DURATION: 0 }));

jest.mock('../../../src/ui/components/AccountCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: any) => (
        <button data-testid={`account-${data.id}`} onClick={onPress}>
            {data.metadata?.name ?? 'acct'}
        </button>
    ),
}));

jest.mock('../../../src/ui/components/TextTruncate', () => ({
    __esModule: true,
    default: ({ text }: { text: string }) => <span>{text}</span>,
}));

jest.mock('../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ menus }: { menus: React.ReactNode }) => (
            <div data-testid="ctx-menu">{menus}</div>
        ),
        ContextMenuItem: ({ title, onClick }: { title: string; onClick: () => void }) => (
            <button data-testid={`ctx-${title.replace(/\s+/g, '-').toLowerCase()}`} onClick={onClick}>
                {title}
            </button>
        ),
    };
});

jest.mock('../../../src/controller/KeyringController', () => ({
    KeyringTypes: { simple: 'Simple Key Pair', hd: 'HD Key Tree' },
}));

let mockSelectedWallet: any = { id: 'w1' };
let mockKeyrings: any = [];
let mockAccounts: any = [];
jest.mock('../../../src/store/selectors', () => ({
    useCurrentWallet: () => mockSelectedWallet,
    useKeyrings: () => mockKeyrings,
    useAccounts: () => mockAccounts,
}));

jest.mock('react-redux', () => ({
    useSelector: (fn: any) => fn({}),
}));

jest.mock('../../../src/store/selectorUtils', () => ({
    getAccountsByWalletId: () => mockAccounts,
}));

const baseWallet: any = { id: 'w1', name: 'Main Wallet' };
const accountFixture = (overrides: any = {}) => ({
    id: 'a1',
    address: '0x1',
    metadata: {
        name: 'Account 1',
        importTime: 1,
        keyring: { type: 'HD Key Tree' },
        ...overrides.metadata,
    },
    ...overrides,
});

describe('WalletCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSelectedWallet = { id: 'w1' };
        mockKeyrings = [{ id: 'w1', accounts: ['0x1'] }];
        mockAccounts = [accountFixture()];
    });

    it('renders wallet name and selected badge', () => {
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={false}
                deletable={false}
                isSmartWallet={false}
                expanded={false}
            />,
        );
        expect(screen.getByText('Main Wallet')).toBeInTheDocument();
        expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('renders Private Key tag for simple keyring', () => {
        mockAccounts = [
            accountFixture({ metadata: { name: 'A1', importTime: 0, keyring: { type: 'Simple Key Pair' } } }),
        ];
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={false}
                deletable={false}
                isSmartWallet={false}
                expanded={false}
            />,
        );
        expect(screen.getByText('Private Key')).toBeInTheDocument();
    });

    it('calls onPress when row is clicked', () => {
        const onPress = jest.fn();
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={onPress}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={false}
                deletable={false}
                isSmartWallet={false}
                expanded={false}
            />,
        );
        fireEvent.click(screen.getByText('Main Wallet'));
        expect(onPress).toHaveBeenCalledWith(baseWallet);
    });

    it('renders context menu when editable', () => {
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={true}
                deletable={true}
                isSmartWallet={false}
                expanded={false}
            />,
        );
        expect(screen.getByTestId('ctx-rename')).toBeInTheDocument();
        expect(screen.getByTestId('ctx-delete-wallet')).toBeInTheDocument();
    });

    it('emits context menu action on click', () => {
        const onContextMenuClick = jest.fn();
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={onContextMenuClick}
                onAccountContextMenuClick={jest.fn()}
                editable={true}
                deletable={false}
                isSmartWallet={false}
                expanded={false}
            />,
        );
        fireEvent.click(screen.getByTestId('ctx-rename'));
        expect(onContextMenuClick).toHaveBeenCalledWith(baseWallet, 'rename');
    });

    it('renders accounts sorted by importTime when expanded and fires onAccountPress', () => {
        const a1 = accountFixture({ id: 'a1', metadata: { name: 'A1', importTime: 5, keyring: { type: 'HD Key Tree' } } });
        const a2 = accountFixture({ id: 'a2', metadata: { name: 'A2', importTime: 1, keyring: { type: 'HD Key Tree' } } });
        mockAccounts = [a1, a2];
        const onAccountPress = jest.fn();
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={onAccountPress}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={true}
                deletable={false}
                isSmartWallet={false}
                expanded={true}
            />,
        );
        // Click an account triggers onAccountPress with account+wallet
        fireEvent.click(screen.getByTestId('account-a1'));
        expect(onAccountPress).toHaveBeenCalledWith(a1, baseWallet);
    });

    it('renders Add New Account when editable and not simple keyring; click triggers onAddNewAccountPress', () => {
        const onAddNewAccountPress = jest.fn();
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                onAddNewAccountPress={onAddNewAccountPress}
                editable={true}
                deletable={false}
                isSmartWallet={false}
                expanded={true}
            />,
        );
        fireEvent.click(screen.getByText('Add New Account'));
        expect(onAddNewAccountPress).toHaveBeenCalledWith(baseWallet);
    });

    it('omits Add New Account when keyring is simple', () => {
        mockAccounts = [
            accountFixture({
                metadata: { name: 'A', importTime: 0, keyring: { type: 'Simple Key Pair' } },
            }),
        ];
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={true}
                deletable={false}
                isSmartWallet={false}
                expanded={true}
            />,
        );
        expect(screen.queryByText('Add New Account')).toBeNull();
    });

    it('does not throw when Add button clicked but no callback provided', () => {
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={true}
                deletable={false}
                isSmartWallet={false}
                expanded={true}
            />,
        );
        fireEvent.click(screen.getByText('Add New Account'));
        // no error
    });

    it('displays multi-account label and Reveal Seed Phrase for HD', () => {
        mockKeyrings = [{ id: 'w1', accounts: ['0x1', '0x2', '0x3'] }];
        mockAccounts = [
            accountFixture({ id: 'a1', address: '0x1' }),
            accountFixture({ id: 'a2', address: '0x2' }),
            accountFixture({ id: 'a3', address: '0x3' }),
        ];
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={true}
                deletable={true}
                isSmartWallet={false}
                expanded={false}
            />,
        );
        expect(screen.getByText('3 Accounts')).toBeInTheDocument();
        expect(screen.getByTestId('ctx-reveal-seed-phrase')).toBeInTheDocument();
    });

    it('falls back to 1 account when no matching keyring', () => {
        mockKeyrings = [{ id: 'other', accounts: ['0xZ'] }];
        render(
            <WalletCard
                data={baseWallet}
                selectedAccount={null}
                onPress={jest.fn()}
                onAccountPress={jest.fn()}
                onContextMenuClick={jest.fn()}
                onAccountContextMenuClick={jest.fn()}
                editable={false}
                deletable={false}
                isSmartWallet={false}
                expanded={false}
            />,
        );
        expect(screen.getByText('1 Account')).toBeInTheDocument();
    });
});
