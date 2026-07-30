import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import WalletRequest from '../../../src/api/graphQL/WalletRequest';
import { ADD_NEW_WALLET_ROUTE } from '../../../src/shared/constants/routes';
import { ChillyAccount, ChillyWallet } from '../../../src/shared/types/Wallet';
import eventManager from '../../../src/shared/utils/eventManager';
import {
    hideLoadingIndicator,
    refreshDefaultWallet,
    removeAccount,
    removeWallet,
    verifyAllAccounts,
} from '../../../src/store/actions/uiActions';
import AccountMenu from '../../../src/ui/components/AccountMenu';
import Toast from '../../../src/ui/components/Toast';

const mockUseCurrentWallet = jest.fn();
const mockUseWallets = jest.fn();

jest.mock('../../../src/store/selectors', () => ({
    useCurrentWallet: () => mockUseCurrentWallet(),
    useWallets: () => mockUseWallets(),
}));

const mockDispatch = jest.fn();

jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ children, visible, onClose }: { children: React.ReactNode; visible: boolean; onClose: () => void }) =>
        visible ? (
            <div data-testid="account-menu-modal">
                <button type="button" data-testid="modal-close" onClick={onClose}>
                    close-modal
                </button>
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: { title: string; onClosePress: () => void }) => (
        <div>
            <span data-testid="header-title">{title}</span>
            <button type="button" data-testid="header-close" onClick={onClosePress}>
                header-close
            </button>
        </div>
    ),
}));

jest.mock('../../../src/ui/components/WalletCard', () => ({
    __esModule: true,
    default: (props: {
        data: ChillyWallet;
        expanded: boolean;
        onPress: (w: ChillyWallet) => void;
        onContextMenuClick: (w: ChillyWallet, action: string) => void;
        onAccountContextMenuClick: (a: ChillyAccount, action: string) => void;
    }) => (
        <div data-testid={`wallet-card-${props.data.id}`}>
            <span data-testid={`expanded-flag-${props.data.id}`}>{String(props.expanded)}</span>
            <button type="button" data-testid={`toggle-${props.data.id}`} onClick={() => props.onPress(props.data)}>
                toggle-{props.data.id}
            </button>
            <button type="button" data-testid={`ctx-wallet-rename-${props.data.id}`} onClick={() => props.onContextMenuClick(props.data, 'rename')}>
                wallet-rename
            </button>
            <button type="button" data-testid={`ctx-wallet-seed-${props.data.id}`} onClick={() => props.onContextMenuClick(props.data, 'reveal_seed_phrase')}>
                wallet-seed
            </button>
            <button type="button" data-testid={`ctx-wallet-delete-${props.data.id}`} onClick={() => props.onContextMenuClick(props.data, 'delete')}>
                wallet-delete
            </button>
            <button
                type="button"
                data-testid={`ctx-account-edit-${props.data.id}`}
                onClick={() =>
                    props.onAccountContextMenuClick(
                        {
                            address: '0xabc',
                            metadata: { name: 'Acc', importTime: 1, keyring: { type: 'hd' } },
                        } as ChillyAccount,
                        'edit',
                    )
                }>
                acct-edit
            </button>
            <button
                type="button"
                data-testid={`ctx-account-pk-${props.data.id}`}
                onClick={() =>
                    props.onAccountContextMenuClick(
                        {
                            address: '0xabc',
                            metadata: { name: 'Acc', importTime: 1, keyring: { type: 'hd' } },
                        } as ChillyAccount,
                        'get_private_key',
                    )
                }>
                acct-pk
            </button>
            <button
                type="button"
                data-testid={`ctx-account-view-${props.data.id}`}
                onClick={() =>
                    props.onAccountContextMenuClick(
                        {
                            address: '0xAbC',
                            metadata: { name: 'Acc', importTime: 1, keyring: { type: 'hd' } },
                        } as ChillyAccount,
                        'view_address',
                    )
                }>
                acct-view
            </button>
            <button
                type="button"
                data-testid={`ctx-account-verify-${props.data.id}`}
                onClick={() =>
                    props.onAccountContextMenuClick(
                        {
                            address: '0xabc',
                            metadata: { name: 'Acc', importTime: 1, keyring: { type: 'hd' } },
                        } as ChillyAccount,
                        'verify_wallet',
                    )
                }>
                acct-verify
            </button>
            <button
                type="button"
                data-testid={`ctx-account-default-${props.data.id}`}
                onClick={() =>
                    props.onAccountContextMenuClick(
                        {
                            address: '0xAbC',
                            metadata: { name: 'Acc', importTime: 1, keyring: { type: 'hd' } },
                        } as ChillyAccount,
                        'set_as_default',
                    )
                }>
                acct-default
            </button>
            <button
                type="button"
                data-testid={`ctx-account-delete-${props.data.id}`}
                onClick={() =>
                    props.onAccountContextMenuClick(
                        {
                            address: '0xabc',
                            metadata: { name: 'TestAcc', importTime: 1, keyring: { type: 'hd' } },
                        } as ChillyAccount,
                        'delete',
                    )
                }>
                acct-delete
            </button>
        </div>
    ),
}));

jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        showAlertModal: jest.fn(),
        showSeedPhraseModal: jest.fn(),
        showPrivateKeyModal: jest.fn(),
        showWalletAddressModal: jest.fn(),
        emit: jest.fn(),
    },
}));

jest.mock('../../../src/api/graphQL/WalletRequest', () => ({
    __esModule: true,
    default: {
        setWalletAsDefault: jest.fn(),
    },
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    hideLoadingIndicator: jest.fn(() => ({ type: 'hideLoadingIndicator' })),
    showLoadingIndicator: jest.fn(() => ({ type: 'showLoadingIndicator' })),
    removeAccount: jest.fn(() => async () => {}),
    removeWallet: jest.fn(() => async () => {}),
    verifyAllAccounts: jest.fn(),
    refreshDefaultWallet: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: jest.fn(),
        showError: jest.fn(),
    },
}));

const walletEarly: ChillyWallet = { id: 'w-early', name: 'Early', importTime: 100 };
const walletLate: ChillyWallet = { id: 'w-late', name: 'Late', importTime: 200 };

const defaultProps = {
    visible: true,
    isSmartWallet: false,
    selectedAccount: null as ChillyAccount | null,
    onClosePress: jest.fn(),
    onAccountPress: jest.fn(),
    onAddNewAccountPress: jest.fn(),
    onEditAccountPress: jest.fn(),
    onEditWalletPress: jest.fn(),
    editable: true,
};

describe('AccountMenu', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseWallets.mockReturnValue([walletLate, walletEarly]);
        mockUseCurrentWallet.mockReturnValue(walletEarly);
        mockDispatch.mockImplementation(async (action: unknown) => {
            if (typeof action === 'function') {
                return await (action as (d: typeof mockDispatch, getState: () => unknown) => Promise<unknown>)(
                    mockDispatch,
                    () => ({}),
                );
            }
            return action;
        });
        (global as unknown as { platform?: { openExtensionInBrowser: jest.Mock } }).platform = {
            openExtensionInBrowser: jest.fn(),
        };
    });

    it('renders nothing when not visible', () => {
        render(<AccountMenu {...defaultProps} visible={false} />);
        expect(screen.queryByTestId('account-menu-modal')).not.toBeInTheDocument();
    });

    it('shows Wallets title for non-smart and Smart Wallets for smart', () => {
        const { rerender } = render(<AccountMenu {...defaultProps} />);
        expect(screen.getByTestId('header-title')).toHaveTextContent('Wallets');

        rerender(<AccountMenu {...defaultProps} isSmartWallet />);
        expect(screen.getByTestId('header-title')).toHaveTextContent('Smart Wallets');
    });

    it('sorts wallets by importTime ascending', () => {
        render(<AccountMenu {...defaultProps} />);
        const cards = screen.getAllByTestId(/wallet-card-/);
        expect(cards[0]).toHaveAttribute('data-testid', 'wallet-card-w-early');
        expect(cards[1]).toHaveAttribute('data-testid', 'wallet-card-w-late');
    });

    it('calls onClosePress from modal and header close', () => {
        const onClosePress = jest.fn();
        render(<AccountMenu {...defaultProps} onClosePress={onClosePress} />);

        fireEvent.click(screen.getByTestId('modal-close'));
        fireEvent.click(screen.getByTestId('header-close'));

        expect(onClosePress).toHaveBeenCalledTimes(2);
    });

    it('toggles expanded wallet when the same card is pressed twice', () => {
        render(<AccountMenu {...defaultProps} />);

        expect(screen.getByTestId('expanded-flag-w-early')).toHaveTextContent('true');

        fireEvent.click(screen.getByTestId('toggle-w-early'));
        expect(screen.getByTestId('expanded-flag-w-early')).toHaveTextContent('false');

        fireEvent.click(screen.getByTestId('toggle-w-early'));
        expect(screen.getByTestId('expanded-flag-w-early')).toHaveTextContent('true');
    });

    it('expands a different wallet when another card is pressed', () => {
        render(<AccountMenu {...defaultProps} />);

        expect(screen.getByTestId('expanded-flag-w-early')).toHaveTextContent('true');
        expect(screen.getByTestId('expanded-flag-w-late')).toHaveTextContent('false');

        fireEvent.click(screen.getByTestId('toggle-w-late'));

        expect(screen.getByTestId('expanded-flag-w-early')).toHaveTextContent('false');
        expect(screen.getByTestId('expanded-flag-w-late')).toHaveTextContent('true');
    });

    it('opens Add New Wallet route when editable', () => {
        render(<AccountMenu {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /add new wallet/i }));

        expect(
            (global as unknown as { platform: { openExtensionInBrowser: jest.Mock } }).platform.openExtensionInBrowser,
        ).toHaveBeenCalledWith(ADD_NEW_WALLET_ROUTE);
    });

    it('hides Add New Wallet when not editable', () => {
        render(<AccountMenu {...defaultProps} editable={false} />);
        expect(screen.queryByRole('button', { name: /add new wallet/i })).not.toBeInTheDocument();
    });

    it('defaults editable to true when prop is omitted', () => {
        const { editable: _e, ...withoutEditable } = defaultProps;
        render(
            <AccountMenu
                {...withoutEditable}
                visible
                isSmartWallet={false}
                selectedAccount={null}
                onClosePress={jest.fn()}
                onAccountPress={jest.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: /add new wallet/i })).toBeInTheDocument();
    });

    it('wallet rename is a no-op when onEditWalletPress is omitted', () => {
        const { onEditWalletPress: _o, ...props } = defaultProps;
        render(<AccountMenu {...props} />);
        expect(() => fireEvent.click(screen.getByTestId('ctx-wallet-rename-w-early'))).not.toThrow();
    });

    it('account edit is a no-op when onEditAccountPress is omitted', () => {
        const { onEditAccountPress: _o, ...props } = defaultProps;
        render(<AccountMenu {...props} />);
        expect(() => fireEvent.click(screen.getByTestId('ctx-account-edit-w-early'))).not.toThrow();
    });

    it('wallet context: rename calls onEditWalletPress', () => {
        const onEditWalletPress = jest.fn();
        render(<AccountMenu {...defaultProps} onEditWalletPress={onEditWalletPress} />);

        fireEvent.click(screen.getByTestId('ctx-wallet-rename-w-early'));

        expect(onEditWalletPress).toHaveBeenCalledWith(walletEarly);
    });

    it('wallet context: reveal_seed_phrase opens modal', () => {
        render(<AccountMenu {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ctx-wallet-seed-w-early'));

        expect(eventManager.showSeedPhraseModal).toHaveBeenCalledWith(walletEarly);
    });

    it('wallet context: delete shows alert and succeeds', async () => {
        render(<AccountMenu {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ctx-wallet-delete-w-early'));

        expect(eventManager.showAlertModal).toHaveBeenCalled();
        const call = (eventManager.showAlertModal as jest.Mock).mock.calls[0][0];
        expect(call.title).toBe('Delete Wallet');
        const deleteBtn = call.buttons.find((b: { name: string }) => b.name === 'Delete Wallet');
        await deleteBtn.onPress();

        await waitFor(() => {
            expect(removeWallet).toHaveBeenCalledWith(walletEarly.id);
            expect(Toast.showSuccess).toHaveBeenCalledWith('Delete wallet succeeded.');
        });
    });

    it('wallet context: delete does not toast when error has no message', async () => {
        (removeWallet as jest.Mock).mockImplementationOnce(() => async () => {
            throw { message: '' };
        });
        render(<AccountMenu {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ctx-wallet-delete-w-early'));
        const call = (eventManager.showAlertModal as jest.Mock).mock.calls[0][0];
        const deleteBtn = call.buttons.find((b: { name: string }) => b.name === 'Delete Wallet');
        await deleteBtn.onPress();

        await waitFor(() => {
            expect(removeWallet).toHaveBeenCalled();
        });
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('wallet context: delete shows error toast when remove fails', async () => {
        (removeWallet as jest.Mock).mockImplementationOnce(() => async () => {
            throw new Error('remove-failed');
        });
        render(<AccountMenu {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ctx-wallet-delete-w-early'));
        const call = (eventManager.showAlertModal as jest.Mock).mock.calls[0][0];
        const deleteBtn = call.buttons.find((b: { name: string }) => b.name === 'Delete Wallet');
        await deleteBtn.onPress();

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('remove-failed');
        });
    });

    it('account context: edit calls onEditAccountPress with isSmartWallet flag', () => {
        const onEditAccountPress = jest.fn();
        render(
            <AccountMenu
                {...defaultProps}
                isSmartWallet
                onEditAccountPress={onEditAccountPress}
            />,
        );

        fireEvent.click(screen.getByTestId('ctx-account-edit-w-early'));

        expect(onEditAccountPress).toHaveBeenCalledWith(
            expect.objectContaining({
                address: '0xabc',
                metadata: expect.objectContaining({ name: 'Acc' }),
            }),
            true,
        );
    });

    it('account context: get_private_key and view_address', () => {
        render(<AccountMenu {...defaultProps} isSmartWallet />);

        fireEvent.click(screen.getByTestId('ctx-account-pk-w-early'));
        expect(eventManager.showPrivateKeyModal).toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('ctx-account-view-w-early'));
        expect(eventManager.showWalletAddressModal).toHaveBeenCalledWith({
            account: expect.objectContaining({ address: '0xAbC' }),
            isSmartWallet: true,
        });
    });





    it('account context: delete shows alert and succeeds', async () => {
        render(<AccountMenu {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ctx-account-delete-w-early'));

        const call = (eventManager.showAlertModal as jest.Mock).mock.calls[0][0];
        expect(call.title).toBe('Delete Account');
        expect(String(call.message)).toContain('TestAcc');
        const deleteBtn = call.buttons.find((b: { name: string }) => b.name === 'Delete Account');
        await deleteBtn.onPress();

        await waitFor(() => {
            expect(removeAccount).toHaveBeenCalledWith('0xabc');
            expect(Toast.showSuccess).toHaveBeenCalledWith('Delete account succeeded.');
        });
    });

    it('account context: delete does not toast when error has no message', async () => {
        (removeAccount as jest.Mock).mockImplementationOnce(() => async () => {
            throw { message: undefined };
        });
        render(<AccountMenu {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ctx-account-delete-w-early'));
        const call = (eventManager.showAlertModal as jest.Mock).mock.calls[0][0];
        const deleteBtn = call.buttons.find((b: { name: string }) => b.name === 'Delete Account');
        await deleteBtn.onPress();

        await waitFor(() => {
            expect(removeAccount).toHaveBeenCalled();
        });
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('account context: delete shows error toast when remove fails', async () => {
        (removeAccount as jest.Mock).mockImplementationOnce(() => async () => {
            throw new Error('acc-fail');
        });
        render(<AccountMenu {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ctx-account-delete-w-early'));
        const call = (eventManager.showAlertModal as jest.Mock).mock.calls[0][0];
        const deleteBtn = call.buttons.find((b: { name: string }) => b.name === 'Delete Account');
        await deleteBtn.onPress();

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('acc-fail');
        });
    });

    it('scrolls last expanded wallet into view after delay', () => {
        jest.useFakeTimers();
        const scrollToMock = jest.fn();
        HTMLElement.prototype.scrollTo = scrollToMock;

        mockUseWallets.mockReturnValue([walletEarly, walletLate]);
        mockUseCurrentWallet.mockReturnValue(walletLate);
        render(<AccountMenu {...defaultProps} />);

        act(() => {
            jest.advanceTimersByTime(160);
        });

        expect(scrollToMock).toHaveBeenCalledWith(
            expect.objectContaining({
                top: expect.any(Number),
                behavior: 'smooth',
            }),
        );

        delete (HTMLElement.prototype as unknown as { scrollTo?: typeof scrollToMock }).scrollTo;
        jest.useRealTimers();
    });
});
