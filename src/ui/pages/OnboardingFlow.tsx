import React, { useCallback, useEffect, useState } from 'react';
import { Switch, matchPath, useHistory, useLocation } from 'react-router-dom';
import {
    DEFAULT_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
    ONBOARDING_CREATE_PIN_CODE_ROUTE,
    ONBOARDING_CONNECT_HARDWARE_WALLET_DONE_ROUTE,
    ONBOARDING_CONNECT_HARDWARE_WALLET_ROUTE,
    ONBOARDING_CREATE_WALLET_DONE_ROUTE,
    ONBOARDING_CREATE_WALLET_ROUTE,
    ONBOARDING_HOME_ROUTE,
    ONBOARDING_IMPORT_WALLET_DONE_ROUTE,
    ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ONBOARDING_IMPORT_WALLET_SEED_PHRASE_ROUTE,
    ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE,
    ONBOARDING_UNLOCK_ROUTE,
    ONBOARDING_WELCOME_ROUTE,
} from '../../shared/constants/routes';
import logger from '../../shared/utils/logger';
import { useOnboardingStep } from '../../store/selectors';
import { Route } from 'react-router-dom';
import ConnectHardwareWallet from './ConnectHardwareWallet';
import CreatePinCode from './CreatePinCode';
import CreateWallet from './CreateWallet';
import OnboardingFlowSwitch from './OnboardingFlowSwitch';
import OnboardingHome from './OnboardingHome';
import OnboardingWelcome from './OnboardingWelcome';
import RecoverWalletUsingPrivateKey from './RecoverWalletUsingPrivateKey';
import RecoverWalletUsingSeedPhrase from './RecoverWalletUsingSeedPhrase';
import SelectImportType from './SelectImportType';
import Unlock from './Unlock';
import WalletSuccess from './WalletSuccess';

/**
 * Backend-free onboarding: OnboardingHome → CreatePinCode (local PIN) →
 * OnboardingWelcome → CreateWallet / SelectImportType / ConnectHardwareWallet
 * → WalletSuccess. The wallet vault is entirely local.
 */
export default React.memo(() => {
    const history = useHistory();
    const location = useLocation();
    const onboardingStep = useOnboardingStep();

    const [password, setPassword] = useState('');

    const onUnlockSuccess = useCallback(
        async (password: string) => {
            try {
                setPassword(password);

                switch (onboardingStep) {
                    case 'done':
                        history.replace(DEFAULT_ROUTE);
                        break;

                    case 'none':
                        history.replace(ONBOARDING_HOME_ROUTE);
                        break;
                }
            } catch (error) {
                logger.log('onUnlockSuccess', error);
            }
        },
        [history, onboardingStep],
    );

    const onInitializeWalletSuccess = useCallback(async () => {
        // Wallet initialization is fully local — nothing to sync.
    }, []);

    const onCreatePinCode = useCallback(
        async (password: string) => {
            setPassword(password);
            history.push(ONBOARDING_WELCOME_ROUTE);
        },
        [history],
    );

    const onForgotPinCode = useCallback(() => {
        global.platform.openExtensionInBrowser(FORGOT_CODE_RECOVER_CODE_ROUTE);
    }, []);

    useEffect(() => {
        if (
            !password &&
            (matchPath(location.pathname, { path: ONBOARDING_CREATE_WALLET_ROUTE, exact: true }) ||
                matchPath(location.pathname, {
                    path: ONBOARDING_CONNECT_HARDWARE_WALLET_ROUTE,
                    exact: true,
                }))
        ) {
            history.replace(ONBOARDING_UNLOCK_ROUTE);
        }
    }, [history, location.pathname, password]);

    return (
        <Switch>
            {/* Home */}
            <Route path={ONBOARDING_HOME_ROUTE} component={OnboardingHome} />
            {/* Welcome */}
            <Route path={ONBOARDING_WELCOME_ROUTE} component={OnboardingWelcome} />
            <Route
                path={ONBOARDING_CONNECT_HARDWARE_WALLET_ROUTE}
                render={() => (
                    <ConnectHardwareWallet
                        backRoute={ONBOARDING_WELCOME_ROUTE}
                        vaultPassword={password}
                        onInitializeWalletSuccess={onInitializeWalletSuccess}
                    />
                )}
            />
            {/* Create PIN code */}
            <Route
                path={ONBOARDING_CREATE_PIN_CODE_ROUTE}
                component={(props: any) => (
                    <CreatePinCode {...props} onCreatePinCode={onCreatePinCode} />
                )}
            />
            {/* Create Wallet */}
            <Route
                path={ONBOARDING_CREATE_WALLET_ROUTE}
                component={(props: any) => (
                    <CreateWallet
                        {...props}
                        password={password}
                        onInitializeWalletSuccess={onInitializeWalletSuccess}
                    />
                )}
            />
            <Route
                path={ONBOARDING_CREATE_WALLET_DONE_ROUTE}
                render={() => <WalletSuccess variant="created" />}
            />
            {/* Import Wallet */}
            <Route path={ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE} component={SelectImportType} />
            <Route
                path={ONBOARDING_IMPORT_WALLET_SEED_PHRASE_ROUTE}
                component={(props: any) => (
                    <RecoverWalletUsingSeedPhrase
                        {...props}
                        password={password}
                        onInitializeWalletSuccess={onInitializeWalletSuccess}
                    />
                )}
            />
            <Route
                path={ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE}
                component={(props: any) => (
                    <RecoverWalletUsingPrivateKey
                        {...props}
                        password={password}
                        onInitializeWalletSuccess={onInitializeWalletSuccess}
                    />
                )}
            />
            <Route
                path={ONBOARDING_IMPORT_WALLET_DONE_ROUTE}
                render={() => <WalletSuccess variant="recovered" />}
            />
            <Route
                path={ONBOARDING_CONNECT_HARDWARE_WALLET_DONE_ROUTE}
                render={() => <WalletSuccess variant="hardware" />}
            />
            {/* Unlock */}
            <Route
                path={ONBOARDING_UNLOCK_ROUTE}
                component={(props: any) => (
                    <Unlock
                        {...props}
                        onUnlockSuccess={onUnlockSuccess}
                        onForgotPinCode={onForgotPinCode}
                    />
                )}
            />

            {/* Switch */}
            <Route exact path="*" component={OnboardingFlowSwitch} />
        </Switch>
    );
});
