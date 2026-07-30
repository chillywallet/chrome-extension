import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, MemoryHistory } from 'history';
import React, { act } from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { WalletRequest } from '../../../src/api/graphQL';
import {
    DEFAULT_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
    ONBOARDING_CREATE_PIN_CODE_ROUTE,
    ONBOARDING_CREATE_WALLET_ROUTE,
    ONBOARDING_FORGOT_PASSWORD_ROUTE,
    ONBOARDING_FORGOT_PASSWORD_VERIFY_ROUTE,
    ONBOARDING_HOME_ROUTE,
    ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ONBOARDING_IMPORT_WALLET_SEED_PHRASE_ROUTE,
    ONBOARDING_LOGIN_ROUTE,
    ONBOARDING_PROFILE_ROUTE_ROUTE,
    ONBOARDING_REFERRAL_CODE_ROUTE,
    ONBOARDING_REGISTER_ROUTE,
    ONBOARDING_UNLOCK_ROUTE,
    ONBOARDING_VERIFY_ROUTE,
    ONBOARDING_WELCOME_ROUTE,
} from '../../../src/shared/constants/routes';
import * as uiActions from '../../../src/store/actions/uiActions';
import * as selectors from '../../../src/store/selectors';
import OnboardingFlow from '../../../src/ui/pages/OnboardingFlow';

const mockCognito = {
    access_token: 'at',
    id: 'cognito-id',
    id_token: 'idt',
    refresh_token: 'rt',
};

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn() },
}));

jest.mock('../../../src/api/graphQL', () => ({
    WalletRequest: {
        getUserWithToken: jest.fn(),
    },
}));

jest.mock('../../../src/ui/pages/CreatePinCode', () => ({
    __esModule: true,
    default: props => (
        <div data-testid="stub-create-chilly">
            <button type="button" onClick={() => props.onCreatePinCode('chilly-pass')}>
                submit-chilly
            </button>
        </div>
    ),
}));

jest.mock('../../../src/ui/pages/CreateWallet', () => ({
    __esModule: true,
    default: props => (
        <div data-testid="stub-create-wallet">
            <button type="button" onClick={() => props.onInitializeWalletSuccess('seed phrase')}>
                init-wallet
            </button>
        </div>
    ),
}));




jest.mock('../../../src/ui/pages/OnboardingFlowSwitch', () => ({
    __esModule: true,
    default: () => <div data-testid="stub-flow-switch" />,
}));

jest.mock('../../../src/ui/pages/OnboardingHome', () => ({
    __esModule: true,
    default: () => <div data-testid="stub-home" />,
}));

jest.mock('../../../src/ui/pages/OnboardingWelcome', () => ({
    __esModule: true,
    default: () => <div data-testid="stub-welcome" />,
}));


jest.mock('../../../src/ui/pages/RecoverWalletUsingPrivateKey', () => ({
    __esModule: true,
    default: props => (
        <div data-testid="stub-import-pk">
            <button type="button" onClick={() => props.onInitializeWalletSuccess('pk')}>
                init-pk
            </button>
        </div>
    ),
}));

jest.mock('../../../src/ui/pages/RecoverWalletUsingSeedPhrase', () => ({
    __esModule: true,
    default: props => (
        <div data-testid="stub-import-seed">
            <button type="button" onClick={() => props.onInitializeWalletSuccess('twelve words')}>
                init-seed
            </button>
        </div>
    ),
}));



jest.mock('../../../src/ui/pages/SelectImportType', () => ({
    __esModule: true,
    default: () => <div data-testid="stub-select-import" />,
}));

jest.mock('../../../src/ui/pages/Unlock', () => ({
    __esModule: true,
    default: props => (
        <div data-testid="stub-unlock">
            <button
                type="button"
                onClick={() => props.onUnlockSuccess('unlocked-pw')}
                data-testid="btn-unlock"
            >
                unlock
            </button>
            <button type="button" onClick={() => props.onForgotPinCode()} data-testid="btn-forgot-chilly">
                forgot
            </button>
        </div>
    ),
}));


jest.mock('../../../src/ui/pages/WalletSuccess', () => ({
    __esModule: true,
    default: props => <div data-testid={`stub-wallet-success-${props.variant}`} />,
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useOnboardingStep: jest.fn(),
}));

const mockGetUserWithToken = jest.mocked(WalletRequest.getUserWithToken);
const mockUseOnboardingStep = jest.mocked(selectors.useOnboardingStep);

function createLoggingStore() {
    const dispatched: { type: string }[] = [];
    const store = configureStore({
        reducer: (state = {}, action: { type: string }) => {
            const t = action.type;
            if (t && !t.startsWith('@')) {
                dispatched.push(action);
            }
            return state;
        },
        middleware: getDefaultMiddleware =>
            getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
    });
    return { store, dispatched };
}

function renderFlow(initialPath: string, history?: MemoryHistory<unknown>) {
    const h = history ?? createMemoryHistory({ initialEntries: [initialPath] });
    const { store, dispatched } = createLoggingStore();
    const replaceSpy = jest.spyOn(h, 'replace');
    const pushSpy = jest.spyOn(h, 'push');

    const view = render(
        <Provider store={store}>
            <Router history={h}>
                <OnboardingFlow />
            </Router>
        </Provider>,
    );

    return { history: h, replaceSpy, pushSpy, dispatched, view, store };
}

describe('OnboardingFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseOnboardingStep.mockReturnValue('none');
        mockGetUserWithToken.mockResolvedValue({
            data: { getUser: { id: '1' } },
        } as Awaited<ReturnType<typeof mockGetUserWithToken>>);
        (global as unknown as { platform?: { openExtensionInBrowser: jest.Mock } }).platform = {
            openExtensionInBrowser: jest.fn(),
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });





    it('renders the fallback OnboardingFlowSwitch for an unknown path', () => {
        renderFlow('/onboarding/unknown-segment');
        expect(screen.getByTestId('stub-flow-switch')).toBeInTheDocument();
    });











    it('onForgotPinCode opens recover-code in browser', () => {
        renderFlow(ONBOARDING_UNLOCK_ROUTE);

        fireEvent.click(screen.getByTestId('btn-forgot-chilly'));

        expect(global.platform?.openExtensionInBrowser).toHaveBeenCalledWith(
            FORGOT_CODE_RECOVER_CODE_ROUTE,
        );
    });

    it('onUnlockSuccess with onboarding step done replaces to default route', async () => {
        mockUseOnboardingStep.mockReturnValue('done');
        const { replaceSpy } = renderFlow(ONBOARDING_UNLOCK_ROUTE);

        fireEvent.click(screen.getByTestId('btn-unlock'));

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith(DEFAULT_ROUTE);
        });
    });

    it('onUnlockSuccess with onboarding step none replaces to home', async () => {
        mockUseOnboardingStep.mockReturnValue('none');
        const { replaceSpy } = renderFlow(ONBOARDING_UNLOCK_ROUTE);

        fireEvent.click(screen.getByTestId('btn-unlock'));

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith(ONBOARDING_HOME_ROUTE);
        });
    });

    it('onUnlockSuccess does not replace route when onboarding step is not done or none', async () => {
        mockUseOnboardingStep.mockReturnValue('idle' as any);
        const { replaceSpy } = renderFlow(ONBOARDING_UNLOCK_ROUTE);

        fireEvent.click(screen.getByTestId('btn-unlock'));

        await act(async () => {
            await Promise.resolve();
        });

        expect(replaceSpy).not.toHaveBeenCalled();
    });


    it('renders create-wallet-done', () => {
        renderFlow('/onboarding/create-wallet-done');
        expect(screen.getByTestId('stub-wallet-success-created')).toBeInTheDocument();
    });

    it('renders import-wallet-done', () => {
        const h = createMemoryHistory({ initialEntries: ['/onboarding/import-wallet-done'] });
        renderFlow('/onboarding/import-wallet-done', h);
        expect(screen.getByTestId('stub-wallet-success-recovered')).toBeInTheDocument();
    });


});
