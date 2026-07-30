import { wordlist } from '@metamask/scure-bip39/dist/wordlists/english';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import {
    ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE,
    ONBOARDING_IMPORT_WALLET_DONE_ROUTE,
} from '../../../src/shared/constants/routes';
import {
    addNewWallet,
    importWallet,
    setCompletedOnboarding,
} from '../../../src/store/actions/uiActions';
import Toast from '../../../src/ui/components/Toast';
import RecoverWalletUsingSeedPhrase from '../../../src/ui/pages/RecoverWalletUsingSeedPhrase';

jest.mock('../../../src/store/actions/uiActions', () => ({
    addNewWallet: jest.fn(() => jest.fn(() => Promise.resolve())),
    importWallet: jest.fn(() => jest.fn(() => Promise.resolve())),
    setCompletedOnboarding: jest.fn(() => jest.fn(() => Promise.resolve())),
}));

const defaultDispatchImpl = action => {
    if (typeof action === 'function') {
        return action(mockDispatch, () => ({}));
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

const validPhrase12 = wordlist.slice(0, 12).join(' ');
const validPhrase24 = wordlist.slice(0, 24).join(' ');

function pasteOnRecoveryArea(container, text) {
    const zone = container.querySelector('.overflow-y-auto');
    if (!zone) {
        throw new Error('paste target not found');
    }
    fireEvent.paste(zone, {
        clipboardData: { getData: () => text },
    });
}

function renderUnderRoute(ui, history) {
    return render(<Router history={history}>{ui}</Router>);
}

describe('RecoverWalletUsingSeedPhrase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatch.mockImplementation(defaultDispatchImpl);
    });

    it('renders 12-word entry and disables Continue until all words are valid', () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });

        renderUnderRoute(<RecoverWalletUsingSeedPhrase password="pw" />, history);

        expect(screen.getByText('Recover Wallet')).toBeInTheDocument();
        expect(screen.getByText('Secret Recovery Phrase')).toBeInTheDocument();
        expect(screen.getAllByRole('textbox')).toHaveLength(12);
        expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
        expect(screen.getByText(/I have a 24-word recovery phrase/)).toBeInTheDocument();
    });

    it('enables Continue after pasting 12 valid BIP39 words', async () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="pw" />,
            history,
        );

        pasteOnRecoveryArea(container, validPhrase12);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /^continue$/i })).not.toBeDisabled();
        });
    });

    it('shows error toast when pasted phrase is not 12 or 24 words', () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="pw" />,
            history,
        );

        pasteOnRecoveryArea(container, `${wordlist[0]} ${wordlist[1]}`);
        expect(Toast.showError).toHaveBeenCalledWith(
            'The seed phrase must contain either 12 or 24 words. You entered 2 words.',
        );
    });

    it('normalizes pasted phrase with mixed case and extra whitespace', () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="pw" />,
            history,
        );

        const upper = wordlist.slice(0, 12).map(w => w.toUpperCase());
        pasteOnRecoveryArea(container, `\n ${upper.join('  \t ')} \n`);

        const inputs = screen.getAllByRole('textbox');
        expect(inputs[0]).toHaveValue(wordlist[0]);

        Toast.showError.mockClear();
        pasteOnRecoveryArea(container, 'one two three');
        expect(Toast.showError).toHaveBeenCalled();
    });

    it('switches between 12 and 24 word modes', async () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        renderUnderRoute(<RecoverWalletUsingSeedPhrase password="pw" />, history);

        await userEvent.click(screen.getByText(/I have a 24-word recovery phrase/));
        expect(screen.getAllByRole('textbox')).toHaveLength(24);
        expect(screen.getByText(/I have a 12-word recovery phrase/)).toBeInTheDocument();

        await userEvent.click(screen.getByText(/I have a 12-word recovery phrase/));
        expect(screen.getAllByRole('textbox')).toHaveLength(12);
    });

    it('pastes 24 words and switches into 24-word mode', async () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="pw" />,
            history,
        );

        pasteOnRecoveryArea(container, validPhrase24);

        await waitFor(() => {
            expect(screen.getAllByRole('textbox')).toHaveLength(24);
        });
        expect(screen.getByRole('button', { name: /^continue$/i })).not.toBeDisabled();
    });

    it('updates a field in 24-word mode via manual input', async () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="pw" />,
            history,
        );

        pasteOnRecoveryArea(container, validPhrase24);
        await waitFor(() => {
            expect(screen.getAllByRole('textbox')).toHaveLength(24);
        });

        const inputs = screen.getAllByRole('textbox');
        await userEvent.clear(inputs[0]);
        await userEvent.type(inputs[0], 'zoo');
        expect(inputs[0]).toHaveValue('zoo');
        expect(screen.getByRole('button', { name: /^continue$/i })).not.toBeDisabled();
    });

    it('lower-cases manual input', async () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        renderUnderRoute(<RecoverWalletUsingSeedPhrase password="pw" />, history);

        const [first] = screen.getAllByRole('textbox');
        await userEvent.type(first, 'ABANDON');

        expect(first).toHaveValue('abandon');
    });

    it('onboarding path imports wallet, updates onboarding state, and navigates to done', async () => {
        const history = createMemoryHistory({ initialEntries: ['/onboarding/import-seed'] });
        const onSuccess = jest.fn().mockResolvedValue(undefined);

        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="secret" onInitializeWalletSuccess={onSuccess} />,
            history,
        );

        pasteOnRecoveryArea(container, validPhrase12);

        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        await waitFor(() => {
            expect(history.location.pathname).toBe(ONBOARDING_IMPORT_WALLET_DONE_ROUTE);
        });

        expect(jest.mocked(importWallet)).toHaveBeenCalledWith('secret', validPhrase12);
        expect(onSuccess).toHaveBeenCalled();
        expect(jest.mocked(setCompletedOnboarding)).toHaveBeenCalledWith(false);
        expect(jest.mocked(addNewWallet)).not.toHaveBeenCalled();
    });

    it('add-wallet path adds imported wallet and navigates to done', async () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        const onSuccess = jest.fn().mockResolvedValue(undefined);

        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="pw" onInitializeWalletSuccess={onSuccess} />,
            history,
        );

        pasteOnRecoveryArea(container, validPhrase12);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /^continue$/i })).not.toBeDisabled();
        });

        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        await waitFor(() => {
            expect(history.location.pathname).toBe(ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE);
        });

        expect(jest.mocked(addNewWallet)).toHaveBeenCalledWith(validPhrase12);
        expect(onSuccess).toHaveBeenCalled();
        expect(jest.mocked(importWallet)).not.toHaveBeenCalled();
        expect(jest.mocked(setCompletedOnboarding)).not.toHaveBeenCalled();
    });

    it('shows Toast when continue fails with an error message', async () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        jest.mocked(addNewWallet).mockImplementationOnce(() =>
            jest.fn(() => Promise.reject(new Error('duplicate wallet'))),
        );

        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="pw" />,
            history,
        );
        pasteOnRecoveryArea(container, validPhrase12);

        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('duplicate wallet');
        });
        expect(history.location.pathname).toBe(ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE);
    });

    it('does not toast when rejection has no message', async () => {
        const history = createMemoryHistory({
            initialEntries: [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE],
        });
        jest.mocked(addNewWallet).mockImplementationOnce(() =>
            jest.fn(() => Promise.reject(new Error())),
        );

        const { container } = renderUnderRoute(
            <RecoverWalletUsingSeedPhrase password="pw" />,
            history,
        );
        pasteOnRecoveryArea(container, validPhrase12);

        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        await waitFor(() => expect(jest.mocked(addNewWallet)).toHaveBeenCalled());
        expect(Toast.showError).not.toHaveBeenCalled();
    });
});
