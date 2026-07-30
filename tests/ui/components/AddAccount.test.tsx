import React from 'react';
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import type { ChillyWallet } from '../../../src/shared/types/Wallet';

import * as uiActions from '../../../src/store/actions/uiActions';
import Toast from '../../../src/ui/components/Toast';
import AddAccount from '../../../src/ui/components/AddAccount';

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({
            children,
            className,
            onClick,
        }: {
            children?: React.ReactNode;
            className?: string;
            onClick?: () => void;
        }) => (
            <div className={className} onClick={onClick}>
                {children}
            </div>
        ),
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0.3,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    addNewAccount: jest.fn(),
    getNextAvailableAccountName: jest.fn(),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showError: jest.fn(), showSuccess: jest.fn() },
}));

function walletFixture(overrides: Partial<ChillyWallet> = {}): ChillyWallet {
    return {
        id: 'wallet-1',
        name: 'Test Wallet',
        importTime: 100,
        ...overrides,
    };
}

function renderAddAccount(ui: React.ReactElement) {
    const store = configureStore({
        reducer: {
            _: (state: unknown = {}) => state,
        },
    });
    return render(
        <Provider store={store}>
            <MemoryRouter>{ui}</MemoryRouter>
        </Provider>,
    );
}

describe('AddAccount', () => {
    const onClosePress = jest.fn();
    const wallet = walletFixture();

    beforeEach(() => {
        jest.clearAllMocks();
        (uiActions.getNextAvailableAccountName as jest.Mock).mockResolvedValue('Account Next');
        (uiActions.addNewAccount as jest.Mock).mockImplementation(() => async () => undefined);
    });

    it('renders nothing when not visible', () => {
        renderAddAccount(<AddAccount visible={false} onClosePress={onClosePress} wallet={wallet} />);
        expect(screen.queryByText('Add New Account')).not.toBeInTheDocument();
    });

    it('loads default account name when modal opens', async () => {
        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={wallet} />);

        await waitFor(() => {
            expect(uiActions.getNextAvailableAccountName).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Account name')).toHaveValue('Account Next');
        });
    });

    it('does not set name when next name is missing', async () => {
        (uiActions.getNextAvailableAccountName as jest.Mock).mockResolvedValue(undefined);

        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={wallet} />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
        });

        expect(screen.getByPlaceholderText('Account name')).toHaveValue('');
    });

    it('disables Create when name is cleared', async () => {
        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={wallet} />);

        const input = await screen.findByPlaceholderText('Account name');
        await waitFor(() => expect(input).toHaveValue('Account Next'));

        fireEvent.change(input, { target: { value: '' } });
        expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    });

    it('creates account, dispatches thunk args, then closes', async () => {
        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={wallet} />);

        await screen.findByPlaceholderText('Account name', undefined, { timeout: 3000 });

        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() => {
            expect(uiActions.addNewAccount).toHaveBeenCalledWith('wallet-1', 'Account Next', '');
            expect(onClosePress).toHaveBeenCalledTimes(1);
        });
    });

    it('does not dispatch create when wallet is missing', async () => {
        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={undefined} />);

        await screen.findByPlaceholderText('Account name');

        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await act(async () => {
            await Promise.resolve();
        });

        expect(uiActions.addNewAccount).not.toHaveBeenCalled();
        expect(onClosePress).not.toHaveBeenCalled();
    });

    it('shows Toast on create error when message exists', async () => {
        (uiActions.addNewAccount as jest.Mock).mockImplementation(
            () => async () => {
                throw new Error('ledger busy');
            },
        );

        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={wallet} />);

        await screen.findByPlaceholderText('Account name');
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('ledger busy');
        });
        expect(onClosePress).not.toHaveBeenCalled();
    });

    it('does not show Toast when error has no message', async () => {
        (uiActions.addNewAccount as jest.Mock).mockImplementation(() => async () => {
            throw '';
        });

        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={wallet} />);

        await screen.findByPlaceholderText('Account name');
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() => {
            expect(Toast.showError).not.toHaveBeenCalled();
        });
    });

    it('header Close calls onClosePress', async () => {
        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={wallet} />);

        await screen.findByText('Add New Account');
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClosePress).toHaveBeenCalledTimes(1);
    });

    it('backdrop click closes modal', async () => {
        const { container } = renderAddAccount(
            <AddAccount visible onClosePress={onClosePress} wallet={wallet} />,
        );

        await screen.findByText('Add New Account');

        const backdrop = container.querySelector('.sheet-overlay');
        expect(backdrop).toBeTruthy();
        fireEvent.click(backdrop as Element);
        expect(onClosePress).toHaveBeenCalledTimes(1);
    });

    it('calls getNextAvailableAccountName again after reopen', async () => {
        const { rerender } = renderAddAccount(
            <AddAccount visible onClosePress={onClosePress} wallet={wallet} />,
        );

        await waitFor(() => expect(uiActions.getNextAvailableAccountName).toHaveBeenCalledTimes(1));

        rerender(
            <Provider
                store={configureStore({
                    reducer: { _: (state: unknown = {}) => state },
                })}>
                <MemoryRouter>
                    <AddAccount visible={false} onClosePress={onClosePress} wallet={wallet} />
                </MemoryRouter>
            </Provider>,
        );

        rerender(
            <Provider
                store={configureStore({
                    reducer: { _: (state: unknown = {}) => state },
                })}>
                <MemoryRouter>
                    <AddAccount visible onClosePress={onClosePress} wallet={wallet} />
                </MemoryRouter>
            </Provider>,
        );

        await waitFor(() => expect(uiActions.getNextAvailableAccountName).toHaveBeenCalledTimes(2));
    });

    it('Create prevents default click behavior', async () => {
        renderAddAccount(<AddAccount visible onClosePress={onClosePress} wallet={wallet} />);

        await screen.findByPlaceholderText('Account name');
        const btn = screen.getByRole('button', { name: 'Create' });
        const ev = createEvent.click(btn, { bubbles: true, cancelable: true });
        const spy = jest.spyOn(ev, 'preventDefault');
        fireEvent(btn, ev);
        expect(spy).toHaveBeenCalled();
        await waitFor(() => expect(onClosePress).toHaveBeenCalled());
    });
});
