import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import {
    ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ONBOARDING_IMPORT_WALLET_DONE_ROUTE,
    ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
} from '../../../src/shared/constants/routes';
import {
    addNewWallet,
    importWallet,
    setCompletedOnboarding,
} from '../../../src/store/actions/uiActions';
import Toast from '../../../src/ui/components/Toast';
import RecoverWalletUsingPrivateKey from '../../../src/ui/pages/RecoverWalletUsingPrivateKey';

jest.mock('../../../src/store/actions/uiActions', () => ({
    addNewWallet: jest.fn(() => jest.fn(() => Promise.resolve())),
    importWallet: jest.fn(() => jest.fn(() => Promise.resolve())),
    setCompletedOnboarding: jest.fn(() => jest.fn(() => Promise.resolve())),
}));

const defaultDispatchImpl = (action: unknown) => {
    if (typeof action === 'function') {
        return (action as (d: typeof mockDispatch, s: () => unknown) => unknown)(
            mockDispatch,
            () => ({}),
        );
    }
    return action;
};

const mockDispatch = jest.fn(defaultDispatchImpl);

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <div>{title}</div>,
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showError: jest.fn(),
    },
}));

/** 64-character lowercase hex string */
const VALID_PK =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('RecoverWalletUsingPrivateKey', () => {
    const password = 'test-password';

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatch.mockImplementation(defaultDispatchImpl);
    });

    function renderPage(
        initialPath: string,
        props?: Partial<{ onInitializeWalletSuccess: (pk: string) => Promise<void> }>,
    ) {
        const history = createMemoryHistory({ initialEntries: [initialPath] });
        const pushSpy = jest.spyOn(history, 'push');
        render(
            <Router history={history}>
                <RecoverWalletUsingPrivateKey
                    password={password}
                    onInitializeWalletSuccess={props?.onInitializeWalletSuccess}
                />
            </Router>,
        );
        return { history, pushSpy };
    }

    function privateKeyInput() {
        return screen.getByPlaceholderText('Enter your private key');
    }

    it('disables Continue until the private key is valid', async () => {
        renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);

        expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

        await userEvent.type(privateKeyInput(), 'not-hex');
        expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
        expect(
            screen.getByText(/invalid key\. must be a 64-character hexadecimal string/i),
        ).toBeInTheDocument();

        await userEvent.clear(privateKeyInput());
        await userEvent.type(privateKeyInput(), VALID_PK);
        expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
        expect(
            screen.queryByText(/invalid key\. must be a 64-character hexadecimal string/i),
        ).not.toBeInTheDocument();
    });

    it('accepts a private key with 0x prefix', async () => {
        renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);

        await userEvent.type(privateKeyInput(), `0x${VALID_PK}`);
        expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
    });

    it('paste trims and fills the private key', async () => {
        renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);

        fireEvent.paste(privateKeyInput(), {
            clipboardData: {
                getData: () => `  ${VALID_PK}  `,
            },
        });

        expect(privateKeyInput()).toHaveValue(VALID_PK.trim());
        expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
    });

    it('add-wallet flow dispatches addNewWallet and navigates to import done', async () => {
        const { pushSpy } = renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
        await userEvent.type(privateKeyInput(), VALID_PK);
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(jest.mocked(addNewWallet)).toHaveBeenCalledWith(
                VALID_PK.replace(/^0x/, ''),
                true,
            );
        });
        expect(jest.mocked(importWallet)).not.toHaveBeenCalled();
        expect(jest.mocked(setCompletedOnboarding)).not.toHaveBeenCalled();
        expect(pushSpy).toHaveBeenCalledWith(ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE);
    });

    it('onboarding flow dispatches importWallet, sets onboarding incomplete, and navigates', async () => {
        const { pushSpy } = renderPage(ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
        await userEvent.type(privateKeyInput(), VALID_PK);
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(jest.mocked(importWallet)).toHaveBeenCalledWith(
                password,
                VALID_PK,
                true,
            );
        });
        expect(jest.mocked(setCompletedOnboarding)).toHaveBeenCalledWith(false);
        expect(jest.mocked(addNewWallet)).not.toHaveBeenCalled();
        expect(pushSpy).toHaveBeenCalledWith(ONBOARDING_IMPORT_WALLET_DONE_ROUTE);
    });

    it('calls onInitializeWalletSuccess with cleaned key when provided', async () => {
        const onInitializeWalletSuccess = jest.fn().mockResolvedValue(undefined);
        renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE, {
            onInitializeWalletSuccess,
        });

        await userEvent.type(privateKeyInput(), `0x${VALID_PK}`);
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(onInitializeWalletSuccess).toHaveBeenCalled();
        });
    });

    it('calls onInitializeWalletSuccess on onboarding when provided', async () => {
        const onInitializeWalletSuccess = jest.fn().mockResolvedValue(undefined);
        renderPage(ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE, {
            onInitializeWalletSuccess,
        });

        await userEvent.type(privateKeyInput(), VALID_PK);
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(onInitializeWalletSuccess).toHaveBeenCalled();
        });
    });

    it('shows toast when continue fails with a message', async () => {
        jest.mocked(addNewWallet).mockReturnValueOnce(() =>
            Promise.reject(new Error('bad key')),
        );

        renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
        await userEvent.type(privateKeyInput(), VALID_PK);
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('bad key');
        });
    });

    it('does not toast when error has no message', async () => {
        jest.mocked(addNewWallet).mockReturnValueOnce(() => Promise.reject(new Error()));

        renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
        await userEvent.type(privateKeyInput(), VALID_PK);
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(jest.mocked(addNewWallet)).toHaveBeenCalled();
        });
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('submits on Enter when key is valid', async () => {
        const { pushSpy } = renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
        await userEvent.type(privateKeyInput(), VALID_PK);
        fireEvent.keyUp(privateKeyInput(), { key: 'Enter' });

        await waitFor(() => {
            expect(pushSpy).toHaveBeenCalledWith(ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE);
        });
    });

    it('does not submit on Enter when key is invalid', async () => {
        const { pushSpy } = renderPage(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
        await userEvent.type(privateKeyInput(), 'abc');
        fireEvent.keyUp(privateKeyInput(), { key: 'Enter' });

        expect(pushSpy).not.toHaveBeenCalled();
    });
});
