import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import {
    ADD_NEW_WALLET_CREATE_WALLET_DONE_ROUTE,
    ADD_NEW_WALLET_CREATE_WALLET_ROUTE,
    ONBOARDING_CREATE_WALLET_DONE_ROUTE,
    ONBOARDING_CREATE_WALLET_ROUTE,
} from '../../../src/shared/constants/routes';
import {
    addNewWallet,
    importWallet,
    setCompletedOnboarding,
} from '../../../src/store/actions/uiActions';
import Toast from '../../../src/ui/components/Toast';
import CreateWallet from '../../../src/ui/pages/CreateWallet';

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

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: jest.fn(),
        showError: jest.fn(),
    },
}));

async function waitForSeedGrid(wordCount: number) {
    await waitFor(() => {
        expect(screen.getAllByText('password')).toHaveLength(wordCount);
    });
}

function mockClipboard() {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
    });
    return writeText;
}

function renderCreateWallet(ui: React.ReactElement, history: MemoryHistory<unknown>) {
    return render(<Router history={history}>{ui}</Router>);
}

describe('CreateWallet', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatch.mockImplementation(defaultDispatchImpl);
        mockClipboard();
    });

    it('renders recovery phrase flow and disables Continue until confirmed', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        renderCreateWallet(<CreateWallet />, history);

        expect(screen.getByText('Create Wallet')).toBeInTheDocument();
        expect(screen.getByText('Secret Recovery Phrase')).toBeInTheDocument();
        await waitForSeedGrid(12);
        expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

        await userEvent.click(
            screen.getByRole('checkbox', { name: /i saved my secret recovery phrase/i }),
        );
        expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
    });

    it('copies the seed phrase and shows success toast', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        renderCreateWallet(<CreateWallet />, history);

        await waitForSeedGrid(12);
        const writeText = navigator.clipboard.writeText as jest.Mock;

        await userEvent.click(screen.getByRole('button', { name: /copy phrase/i }));

        expect(writeText).toHaveBeenCalledTimes(1);
        const phrase = writeText.mock.calls[0][0] as string;
        expect(phrase.split(' ')).toHaveLength(12);
        expect(Toast.showSuccess).toHaveBeenCalledWith('Seed phrase copied to clipboard');
    });

    it('reveals words on hover over the blur overlay', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        const { container } = renderCreateWallet(<CreateWallet />, history);

        await waitForSeedGrid(12);
        await userEvent.click(screen.getByRole('button', { name: /copy phrase/i }));
        const writeText = navigator.clipboard.writeText as jest.Mock;
        const firstWord = (writeText.mock.calls[0][0] as string).split(' ')[0];

        const overlay = container.querySelector('.backdrop-blur-sm');
        expect(overlay).not.toBeNull();
        fireEvent.mouseEnter(overlay!);
        expect(screen.getByText(firstWord)).toBeInTheDocument();
        fireEvent.mouseLeave(overlay!);
        expect(screen.queryByText(firstWord)).not.toBeInTheDocument();
    });

    it('switches back from 24 words to 12 words', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        renderCreateWallet(<CreateWallet />, history);

        await waitForSeedGrid(12);
        await userEvent.click(screen.getByRole('tab', { name: '24 Words' }));
        await waitForSeedGrid(24);
        await userEvent.click(screen.getByRole('tab', { name: '12 Words' }));
        await waitForSeedGrid(12);
    });

    it('reveals words on hover in the 24 words tab panel', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        const { container } = renderCreateWallet(<CreateWallet />, history);

        await waitForSeedGrid(12);
        await userEvent.click(screen.getByRole('tab', { name: '24 Words' }));
        await waitForSeedGrid(24);
        await userEvent.click(screen.getByRole('button', { name: /copy phrase/i }));
        const writeText = navigator.clipboard.writeText as jest.Mock;
        const firstWord24 = (writeText.mock.calls[0][0] as string).split(' ')[0];

        const panel = container.querySelector('.tab-selected-tab-panel-class-name');
        const overlay = panel?.querySelector('.backdrop-blur-sm');
        expect(overlay).not.toBeNull();
        fireEvent.mouseEnter(overlay!);
        expect(screen.getByText(firstWord24)).toBeInTheDocument();
        fireEvent.mouseLeave(overlay!);
        expect(screen.queryByText(firstWord24)).not.toBeInTheDocument();
    });

    it('switches to 24-word phrase and continues on add-wallet route', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        renderCreateWallet(<CreateWallet />, history);

        await waitForSeedGrid(12);
        await userEvent.click(screen.getByRole('tab', { name: '24 Words' }));
        await waitForSeedGrid(24);

        await userEvent.click(
            screen.getByRole('checkbox', { name: /i saved my secret recovery phrase/i }),
        );
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(history.location.pathname).toBe(ADD_NEW_WALLET_CREATE_WALLET_DONE_ROUTE);
        });

        const phrase = jest.mocked(addNewWallet).mock.calls[0][0] as string;
        expect(phrase.split(' ')).toHaveLength(24);
        expect(jest.mocked(importWallet)).not.toHaveBeenCalled();
    });

    it('imports wallet and completes onboarding when password is provided', async () => {
        const history = createMemoryHistory({ initialEntries: [ONBOARDING_CREATE_WALLET_ROUTE] });
        const onSuccess = jest.fn().mockResolvedValue(undefined);

        renderCreateWallet(<CreateWallet password="pw" onInitializeWalletSuccess={onSuccess} />, history);

        await waitForSeedGrid(12);
        await userEvent.click(
            screen.getByRole('checkbox', { name: /i saved my secret recovery phrase/i }),
        );
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(history.location.pathname).toBe(ONBOARDING_CREATE_WALLET_DONE_ROUTE);
        });

        const [, seedPhrase] = jest.mocked(importWallet).mock.calls[0];
        expect(seedPhrase.split(' ')).toHaveLength(12);
        expect(jest.mocked(importWallet)).toHaveBeenCalledWith('pw', seedPhrase);
        expect(jest.mocked(setCompletedOnboarding)).toHaveBeenCalledWith(false);
        expect(onSuccess).toHaveBeenCalled();
        expect(jest.mocked(addNewWallet)).not.toHaveBeenCalled();
    });

    it('calls onInitializeWalletSuccess after addNewWallet flow', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        const onSuccess = jest.fn().mockResolvedValue(undefined);

        renderCreateWallet(<CreateWallet onInitializeWalletSuccess={onSuccess} />, history);

        await waitForSeedGrid(12);
        await userEvent.click(
            screen.getByRole('checkbox', { name: /i saved my secret recovery phrase/i }),
        );
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
        const [seed] = jest.mocked(addNewWallet).mock.calls[0];
        expect(seed.split(' ')).toHaveLength(12);
    });

    it('shows error toast when onInitializeWalletSuccess rejects with a message', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        const onSuccess = jest.fn(() => Promise.reject(new Error('vault error')));

        renderCreateWallet(<CreateWallet onInitializeWalletSuccess={onSuccess} />, history);

        await waitForSeedGrid(12);
        await userEvent.click(
            screen.getByRole('checkbox', { name: /i saved my secret recovery phrase/i }),
        );
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('vault error');
        });

        expect(history.location.pathname).toBe(ADD_NEW_WALLET_CREATE_WALLET_ROUTE);
    });

    it('does not import or navigate onboarding when password is missing', async () => {
        const history = createMemoryHistory({ initialEntries: [ONBOARDING_CREATE_WALLET_ROUTE] });
        renderCreateWallet(<CreateWallet />, history);

        await waitForSeedGrid(12);
        await userEvent.click(
            screen.getByRole('checkbox', { name: /i saved my secret recovery phrase/i }),
        );
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        expect(history.location.pathname).toBe(ONBOARDING_CREATE_WALLET_ROUTE);
        expect(jest.mocked(importWallet)).not.toHaveBeenCalled();
    });

    it('does not show error toast when failure has an empty message', async () => {
        const history = createMemoryHistory({ initialEntries: [ADD_NEW_WALLET_CREATE_WALLET_ROUTE] });
        const onSuccess = jest.fn(() => Promise.reject({ message: '' }));

        renderCreateWallet(<CreateWallet onInitializeWalletSuccess={onSuccess} />, history);

        await waitForSeedGrid(12);
        await userEvent.click(
            screen.getByRole('checkbox', { name: /i saved my secret recovery phrase/i }),
        );
        await userEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
        expect(Toast.showError).not.toHaveBeenCalled();
    });
});
