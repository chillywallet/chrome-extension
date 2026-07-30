import React from 'react';
import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import type { ChillyAccount } from '../../../src/shared/types/Wallet';
import AccountCard from '../../../src/ui/components/AccountCard';

jest.mock('../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({
            placeholder,
            menus,
        }: {
            placeholder: React.ReactNode;
            menus: React.ReactNode;
        }) => (
            <div data-testid="account-context-menu-root">
                <div data-testid="context-menu-trigger">{placeholder}</div>
                <div>{menus}</div>
            </div>
        ),
        ContextMenuItem: ({
            title,
            onClick,
            type,
        }: {
            title: string;
            onClick: (item: unknown) => void;
            type?: 'delete';
        }) => (
            <button
                type="button"
                data-testid={`ctx-${title.replace(/\s+/g, '-').toLowerCase()}`}
                className={type === 'delete' ? 'text-red-600' : undefined}
                onClick={() => onClick({})}>
                {title}
            </button>
        ),
    };
});

function buildReduxState(theme: 'dark' | 'light') {
    return {
        globalState: {
            preferences: {
                darkMode: theme === 'dark',
                darkModeSystem: false,
            },
        },
    };
}

function renderWithStore(ui: React.ReactElement, theme: 'dark' | 'light' = 'light') {
    const store = createStore(() => buildReduxState(theme));
    return render(<Provider store={store}>{ui}</Provider>);
}

function accountFixture(overrides: Partial<ChillyAccount> = {}): ChillyAccount {
    const { metadata: metaOverrides, ...rest } = overrides;
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
            ...metaOverrides,
        },
        ...rest,
    } as ChillyAccount;
}

describe('AccountCard', () => {
    const defaultProps = {
        onPress: jest.fn(),
        onContextMenuClick: jest.fn(),
        editable: false,
        deletable: false,
        isSmartWallet: false,
        selected: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders account name and checksummed address', () => {
        const data = accountFixture({ metadata: { name: 'Named', importTime: 0, keyring: { type: 'HD Key Tree' } } });
        renderWithStore(<AccountCard {...defaultProps} data={data} />);
        expect(screen.getByText('Named')).toBeInTheDocument();
        expect(screen.getByText('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')).toBeInTheDocument();
    });

    it('calls onPress with account when the row button is clicked', () => {
        const onPress = jest.fn();
        const data = accountFixture();
        renderWithStore(<AccountCard {...defaultProps} data={data} onPress={onPress} />);
        fireEvent.click(screen.getByRole('button', { name: /primary/i }));
        expect(onPress).toHaveBeenCalledWith(data);
    });

    it('prevents default on row click', () => {
        const onPress = jest.fn();
        const data = accountFixture();
        renderWithStore(<AccountCard {...defaultProps} data={data} onPress={onPress} />);
        const btn = screen.getByRole('button', { name: /primary/i });
        const ev = createEvent.click(btn, { bubbles: true, cancelable: true });
        const pd = jest.spyOn(ev, 'preventDefault');
        fireEvent(btn, ev);
        expect(pd).toHaveBeenCalled();
        expect(onPress).toHaveBeenCalled();
    });

    it('applies selected styling on the row', () => {
        const { container } = renderWithStore(
            <AccountCard {...defaultProps} data={accountFixture()} selected={true} />,
        );
        const row = container.firstChild as HTMLElement;
        expect(row.className).toContain('bg-primary/10');
        expect(row.querySelector('.bg-primary')).toBeTruthy();
    });

    it('uses smartAddress and smartAvatar when isSmartWallet is true', () => {
        const data = accountFixture({
            smartAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            metadata: {
                name: 'Smart',
                importTime: 0,
                keyring: { type: 'HD Key Tree' },
                smartAvatar: '🎯',
            },
        });
        renderWithStore(<AccountCard {...defaultProps} data={data} isSmartWallet={true} />);
        expect(screen.getByText('🎯')).toBeInTheDocument();
        expect(screen.getByText('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')).toBeInTheDocument();
    });

    it('shows empty address line when address checksum fails', () => {
        const data = accountFixture({ address: '0xinvalid' });
        const { container } = renderWithStore(<AccountCard {...defaultProps} data={data} />);
        const truncates = container.querySelectorAll('.text-gray-400');
        expect(truncates.length).toBeGreaterThan(0);
        expect(within(truncates[truncates.length - 1] as HTMLElement).queryByText(/0x/)).toBeNull();
    });


    it('does not show verifying spinner for smart wallet', () => {
        const data = accountFixture({
            smartAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            metadata: {
                name: 'S',
                importTime: 0,
                keyring: { type: 'HD Key Tree' },
                verifying: true,
                smartAvatar: '🤖',
            },
        });
        const { container } = renderWithStore(
            <AccountCard {...defaultProps} data={data} isSmartWallet={true} />,
        );
        expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    });





    it('does not show ALREADY_OWNED warning or default gift for smart wallet', () => {
        const data = accountFixture({
            smartAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            metadata: {
                name: 'SmartDup',
                importTime: 0,
                keyring: { type: 'HD Key Tree' },
                status: 'ALREADY_OWNED',
                isDefault: true,
                smartAvatar: '🧩',
            },
        });
        const { container } = renderWithStore(
            <AccountCard {...defaultProps} data={data} isSmartWallet={true} />,
        );
        expect(container.querySelector('.text-yellow-600')).toBeNull();
        expect(container.querySelector('[data-tooltip-id="chilly-tooltip"]')).toBeNull();
    });

    it('does not render context menu when not editable', () => {
        renderWithStore(<AccountCard {...defaultProps} data={accountFixture()} editable={false} />);
        expect(screen.queryByTestId('account-context-menu-root')).toBeNull();
    });

    it('fires onContextMenuClick for edit action when editable', () => {
        const onContextMenuClick = jest.fn();
        renderWithStore(
            <AccountCard
                {...defaultProps}
                data={accountFixture()}
                editable={true}
                onContextMenuClick={onContextMenuClick}
            />,
        );
        fireEvent.click(screen.getByTestId('ctx-edit-account'));
        expect(onContextMenuClick).toHaveBeenCalledWith(expect.any(Object), 'edit');
    });

    it('fires onContextMenuClick for view address and private key', () => {
        const onContextMenuClick = jest.fn();
        renderWithStore(
            <AccountCard
                {...defaultProps}
                data={accountFixture()}
                editable={true}
                onContextMenuClick={onContextMenuClick}
            />,
        );
        fireEvent.click(screen.getByTestId('ctx-view-address'));
        fireEvent.click(screen.getByTestId('ctx-view-private-key'));
        expect(onContextMenuClick).toHaveBeenCalledWith(expect.any(Object), 'view_address');
        expect(onContextMenuClick).toHaveBeenCalledWith(expect.any(Object), 'get_private_key');
    });


    it('omits Verify Wallet when verifying', () => {
        renderWithStore(
            <AccountCard
                {...defaultProps}
                data={accountFixture({
                    metadata: {
                        name: 'X',
                        importTime: 0,
                        keyring: { type: 'HD Key Tree' },
                        verifying: true,
                    },
                })}
                editable={true}
            />,
        );
        expect(screen.queryByTestId('ctx-verify-wallet')).toBeNull();
    });


    it('omits Set As Rewards Wallet for smart wallet even when CONNECTED', () => {
        renderWithStore(
            <AccountCard
                {...defaultProps}
                data={accountFixture({
                    smartAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                    metadata: {
                        name: 'SW',
                        importTime: 0,
                        keyring: { type: 'HD Key Tree' },
                        status: 'CONNECTED',
                        isDefault: false,
                        smartAvatar: '⚡',
                    },
                })}
                editable={true}
                isSmartWallet={true}
            />,
        );
        expect(screen.queryByTestId('ctx-set-as-rewards-wallet')).toBeNull();
    });

    it('shows Delete Account when deletable and routes delete type styling via menu item', () => {
        const onContextMenuClick = jest.fn();
        renderWithStore(
            <AccountCard
                {...defaultProps}
                data={accountFixture()}
                editable={true}
                deletable={true}
                onContextMenuClick={onContextMenuClick}
            />,
        );
        const del = screen.getByTestId('ctx-delete-account');
        expect(del.className).toContain('text-red-600');
        fireEvent.click(del);
        expect(onContextMenuClick).toHaveBeenCalledWith(expect.any(Object), 'delete');
    });
});