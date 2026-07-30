import { configureStore } from '@reduxjs/toolkit';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';

import {
    FORGOT_CODE_CREATE_PIN_CODE_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
    FORGOT_CODE_ROUTE,
    DEFAULT_ROUTE,
} from '../../../src/shared/constants/routes';
import { importWallet, updateStateFromBackground } from '../../../src/store/actions/uiActions';
import Toast from '../../../src/ui/components/Toast';
import ForgotCodeFlow from '../../../src/ui/pages/ForgotCodeFlow';

jest.mock('../../../src/store/actions/uiActions', () => ({
    importWallet: jest.fn(() => jest.fn(() => Promise.resolve())),
    updateStateFromBackground: jest.fn(() => jest.fn(() => Promise.resolve())),
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

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showError: jest.fn(),
    },
}));

function getGrid(container: HTMLElement) {
    const title = screen.getByText('Secret Recovery Phrase');
    expect(title.parentElement).not.toBeNull();
    return title.nextElementSibling as HTMLElement;
}

function getPhraseInputs(container: HTMLElement): HTMLInputElement[] {
    const grid = getGrid(container);
    return Array.from(grid.querySelectorAll('input'));
}

function twelveWordPhrase() {
    return Array.from({ length: 12 }, (_, i) => `word${i + 1}`).join(' ');
}

function renderForgotCodeFlow(history: MemoryHistory<unknown>) {
    const store = configureStore({
        reducer: (state = {}) => state,
    });
    return {
        ...render(
            <Provider store={store}>
                <Router history={history}>
                    <ForgotCodeFlow />
                </Router>
            </Provider>,
        ),
        store,
    };
}

describe('ForgotCodeFlow', () => {
    const originalBuildType = process.env.BUILD_TYPE;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatch.mockImplementation(defaultDispatchImpl);
        jest.mocked(importWallet).mockImplementation(() => jest.fn(() => Promise.resolve()));
        jest.mocked(updateStateFromBackground).mockImplementation(() =>
            jest.fn(() => Promise.resolve()),
        );
        process.env.BUILD_TYPE = 'Debug';
    });

    afterEach(() => {
        process.env.BUILD_TYPE = originalBuildType;
    });

    it('redirects an unknown sub-path to recover-code', async () => {
        const history = createMemoryHistory({ initialEntries: [FORGOT_CODE_ROUTE] });
        renderForgotCodeFlow(history);

        await waitFor(() => {
            expect(history.location.pathname).toBe(FORGOT_CODE_RECOVER_CODE_ROUTE);
        });
        expect(screen.getByText('Reset Wallet')).toBeInTheDocument();
    });

    it('navigates recover → create pin after phrase, then imports wallet and pushes home', async () => {
        const history = createMemoryHistory({
            initialEntries: [FORGOT_CODE_RECOVER_CODE_ROUTE],
        });
        const pushSpy = jest.spyOn(history, 'push');
        try {
            const phrase = twelveWordPhrase();
            const { container } = renderForgotCodeFlow(history);

            const inputs = getPhraseInputs(container);
            for (let i = 0; i < inputs.length; i++) {
                await userEvent.type(inputs[i], phrase.split(' ')[i]!);
            }

            await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

            await waitFor(() => {
                expect(history.location.pathname).toBe(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);
            });

            expect(screen.getByText('Create Pin Code')).toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

            await waitFor(() => {
                expect(jest.mocked(importWallet)).toHaveBeenCalledTimes(1);
            });

            expect(jest.mocked(importWallet).mock.calls[0]).toEqual(['11111111', phrase]);
            expect(jest.mocked(updateStateFromBackground)).toHaveBeenCalledTimes(1);
            await waitFor(() => {
                expect(pushSpy).toHaveBeenCalledWith(DEFAULT_ROUTE);
            });
            expect(Toast.showError).not.toHaveBeenCalled();
        } finally {
            pushSpy.mockRestore();
        }
    });

    it('shows a toast when importWallet rejects with a message and stays on create pin', async () => {
        jest.mocked(importWallet).mockImplementation(() =>
            jest.fn(() => Promise.reject(new Error('import failed'))),
        );

        const history = createMemoryHistory({
            initialEntries: [FORGOT_CODE_RECOVER_CODE_ROUTE],
        });
        const phrase = twelveWordPhrase();
        const { container } = renderForgotCodeFlow(history);

        const inputs = getPhraseInputs(container);
        for (let i = 0; i < inputs.length; i++) {
            await userEvent.type(inputs[i], phrase.split(' ')[i]!);
        }
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        await waitFor(() => {
            expect(history.location.pathname).toBe(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);
        });

        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('import failed');
        });

        expect(history.location.pathname).toBe(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);
        expect(jest.mocked(updateStateFromBackground)).not.toHaveBeenCalled();
    });

    it('does not toast when importWallet rejects without a usable message', async () => {
        jest.mocked(importWallet).mockImplementation(() =>
            jest.fn(() => Promise.reject({ message: '' })),
        );

        const history = createMemoryHistory({
            initialEntries: [FORGOT_CODE_RECOVER_CODE_ROUTE],
        });
        const phrase = twelveWordPhrase();
        const { container } = renderForgotCodeFlow(history);

        const inputs = getPhraseInputs(container);
        for (let i = 0; i < inputs.length; i++) {
            await userEvent.type(inputs[i], phrase.split(' ')[i]!);
        }
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        await waitFor(() => {
            expect(history.location.pathname).toBe(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);
        });

        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

        await waitFor(() => {
            expect(jest.mocked(importWallet)).toHaveBeenCalled();
        });

        expect(Toast.showError).not.toHaveBeenCalled();
        expect(history.location.pathname).toBe(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);
    });

    it('shows toast when updateStateFromBackground fails after a successful import', async () => {
        jest.mocked(updateStateFromBackground).mockImplementation(() =>
            jest.fn(() => Promise.reject(new Error('state sync failed'))),
        );

        const history = createMemoryHistory({
            initialEntries: [FORGOT_CODE_RECOVER_CODE_ROUTE],
        });
        const phrase = twelveWordPhrase();
        const { container } = renderForgotCodeFlow(history);

        const inputs = getPhraseInputs(container);
        for (let i = 0; i < inputs.length; i++) {
            await userEvent.type(inputs[i], phrase.split(' ')[i]!);
        }
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        await waitFor(() => {
            expect(history.location.pathname).toBe(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);
        });

        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('state sync failed');
        });

        expect(jest.mocked(importWallet)).toHaveBeenCalled();
        expect(history.location.pathname).toBe(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);
    });
});
