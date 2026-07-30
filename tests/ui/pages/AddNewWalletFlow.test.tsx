import { createMemoryHistory } from 'history';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router, Switch } from 'react-router-dom';

import AddNewWalletFlow from '../../../src/ui/pages/AddNewWalletFlow';
import {
    ADD_NEW_WALLET_CREATE_WALLET_DONE_ROUTE,
    ADD_NEW_WALLET_CREATE_WALLET_ROUTE,
    ADD_NEW_WALLET_HOME_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE,
    ADD_NEW_WALLET_UNLOCK_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
} from '../../../src/shared/constants/routes';
import logger from '../../../src/shared/utils/logger';
import { useIsUnlocked } from '../../../src/store/selectors';

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useIsUnlocked: jest.fn(),
}));

jest.mock('../../../src/ui/pages/AddNewWallet', () => ({
    __esModule: true,
    default: () => <div data-testid="add-new-wallet-page">Add New Wallet</div>,
}));

jest.mock('../../../src/ui/pages/CreateWallet', () => ({
    __esModule: true,
    default: () => <div data-testid="create-wallet-page" />,
}));

jest.mock('../../../src/ui/pages/WalletSuccess', () => ({
    __esModule: true,
    default: ({ variant }: { variant: string }) => (
        <div data-testid="wallet-success">{variant}</div>
    ),
}));

jest.mock('../../../src/ui/pages/SelectImportType', () => ({
    __esModule: true,
    default: () => <div data-testid="select-import-type" />,
}));

jest.mock('../../../src/ui/pages/RecoverWalletUsingSeedPhrase', () => ({
    __esModule: true,
    default: () => <div data-testid="recover-seed" />,
}));

jest.mock('../../../src/ui/pages/RecoverWalletUsingPrivateKey', () => ({
    __esModule: true,
    default: () => <div data-testid="recover-pk" />,
}));

jest.mock('../../../src/ui/pages/Unlock', () => ({
    __esModule: true,
    default: ({
        onUnlockSuccess,
        onForgotPinCode,
    }: {
        onUnlockSuccess: (password: string) => void;
        onForgotPinCode: () => void;
    }) => (
        <div data-testid="unlock-page">
            <button type="button" onClick={() => onUnlockSuccess('11111111')}>
                unlock-success
            </button>
            <button type="button" onClick={onForgotPinCode}>
                forgot-code
            </button>
        </div>
    ),
}));

jest.mock('../../../src/ui/pages/AddNewWalletFlowSwitch', () => ({
    __esModule: true,
    default: () => <div data-testid="add-new-wallet-flow-switch" />,
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn() },
}));

describe('AddNewWalletFlow', () => {
    const openExtensionInBrowser = jest.fn();

    beforeEach(() => {
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        (global as any).platform = { openExtensionInBrowser };
        openExtensionInBrowser.mockClear();
        jest.mocked(logger.log).mockClear();
    });

    function renderFlow(initialPath: string) {
        const history = createMemoryHistory({ initialEntries: [initialPath] });
        const replaceSpy = jest.spyOn(history, 'replace');
        const ui = (
            <Router history={history}>
                <Switch>
                    <AddNewWalletFlow />
                </Switch>
            </Router>
        );
        return { ...render(ui), history, replaceSpy };
    }

    it('replaces to home when unlocked', async () => {
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        const { replaceSpy } = renderFlow(ADD_NEW_WALLET_HOME_ROUTE);

        await waitFor(() =>
            expect(replaceSpy).toHaveBeenCalledWith(ADD_NEW_WALLET_HOME_ROUTE),
        );
    });

    it('replaces to unlock when locked', async () => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        const { replaceSpy } = renderFlow(ADD_NEW_WALLET_HOME_ROUTE);

        await waitFor(() =>
            expect(replaceSpy).toHaveBeenCalledWith(ADD_NEW_WALLET_UNLOCK_ROUTE),
        );
    });

    it('renders home route', () => {
        renderFlow(ADD_NEW_WALLET_HOME_ROUTE);
        expect(screen.getByTestId('add-new-wallet-page')).toBeInTheDocument();
    });

    it('renders create wallet and done routes after landing on home', async () => {
        const { history } = renderFlow(ADD_NEW_WALLET_HOME_ROUTE);
        await waitFor(() =>
            expect(history.location.pathname).toBe(ADD_NEW_WALLET_HOME_ROUTE),
        );

        await act(async () => {
            history.push(ADD_NEW_WALLET_CREATE_WALLET_ROUTE);
        });
        await screen.findByTestId('create-wallet-page');

        await act(async () => {
            history.push(ADD_NEW_WALLET_CREATE_WALLET_DONE_ROUTE);
        });
        await waitFor(() =>
            expect(screen.getByTestId('wallet-success')).toHaveTextContent('created'),
        );
    });

    it('renders import flow routes after landing on home', async () => {
        const { history } = renderFlow(ADD_NEW_WALLET_HOME_ROUTE);
        await waitFor(() =>
            expect(history.location.pathname).toBe(ADD_NEW_WALLET_HOME_ROUTE),
        );

        const steps = [
            [ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE, 'select-import-type'],
            [ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE, 'recover-seed'],
            [ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE, 'recover-pk'],
        ] as const;

        for (const [path, tid] of steps) {
            await act(async () => {
                history.push(path);
            });
            await screen.findByTestId(tid);
        }

        await act(async () => {
            history.push(ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE);
        });
        await waitFor(() =>
            expect(screen.getByTestId('wallet-success')).toHaveTextContent('recovered'),
        );
    });

    it('unlock success replaces history to home', async () => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        const { history } = renderFlow(ADD_NEW_WALLET_UNLOCK_ROUTE);

        await userEvent.click(screen.getByRole('button', { name: 'unlock-success' }));

        await waitFor(() =>
            expect(history.location.pathname).toBe(ADD_NEW_WALLET_HOME_ROUTE),
        );
    });

    it('forgot Chilly code opens recover route in browser', async () => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        renderFlow(ADD_NEW_WALLET_UNLOCK_ROUTE);

        await userEvent.click(screen.getByRole('button', { name: 'forgot-code' }));

        expect(openExtensionInBrowser).toHaveBeenCalledWith(FORGOT_CODE_RECOVER_CODE_ROUTE);
    });

    it('logs when unlock success navigation throws', async () => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        const { history } = renderFlow(ADD_NEW_WALLET_UNLOCK_ROUTE);
        jest.spyOn(history, 'replace').mockImplementationOnce(() => {
            throw new Error('nav fail');
        });

        await userEvent.click(screen.getByRole('button', { name: 'unlock-success' }));

        await waitFor(() =>
            expect(jest.mocked(logger.log)).toHaveBeenCalledWith(
                'onUnlockSuccess',
                expect.any(Error),
            ),
        );
    });

    it('falls through to flow switch for unknown paths inside add-wallet', async () => {
        const { history } = renderFlow(ADD_NEW_WALLET_HOME_ROUTE);
        await waitFor(() =>
            expect(history.location.pathname).toBe(ADD_NEW_WALLET_HOME_ROUTE),
        );

        await act(async () => {
            history.push('/add-wallet/not-a-real-subpath');
        });
        await screen.findByTestId('add-new-wallet-flow-switch');
    });
});
