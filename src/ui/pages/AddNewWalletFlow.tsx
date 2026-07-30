import React, { useCallback, useEffect } from 'react';
import { Switch, useHistory } from 'react-router-dom';
import {
    ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_DONE_ROUTE,
    ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_ROUTE,
    ADD_NEW_WALLET_CREATE_WALLET_DONE_ROUTE,
    ADD_NEW_WALLET_CREATE_WALLET_ROUTE,
    ADD_NEW_WALLET_HOME_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE,
    ADD_NEW_WALLET_UNLOCK_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
} from '../../shared/constants/routes';
import logger from '../../shared/utils/logger';
import { useIsUnlocked } from '../../store/selectors';
import { Route } from 'react-router-dom';
import AddNewWallet from './AddNewWallet';
import AddNewWalletFlowSwitch from './AddNewWalletFlowSwitch';
import ConnectHardwareWallet from './ConnectHardwareWallet';
import CreateWallet from './CreateWallet';
import RecoverWalletUsingPrivateKey from './RecoverWalletUsingPrivateKey';
import RecoverWalletUsingSeedPhrase from './RecoverWalletUsingSeedPhrase';
import SelectImportType from './SelectImportType';
import Unlock from './Unlock';
import WalletSuccess from './WalletSuccess';

export default React.memo(() => {
    const history = useHistory();
    const isUnlocked = useIsUnlocked();

    const onUnlockSuccess = useCallback(async () => {
        try {
            history.replace(ADD_NEW_WALLET_HOME_ROUTE);
        } catch (error) {
            logger.log('onUnlockSuccess', error);
        }
    }, [history]);

    const onForgotPinCode = useCallback(() => {
        global.platform.openExtensionInBrowser(FORGOT_CODE_RECOVER_CODE_ROUTE);
    }, []);

    useEffect(() => {
        if (!isUnlocked) {
            history.replace(ADD_NEW_WALLET_UNLOCK_ROUTE);
        } else {
            history.replace(ADD_NEW_WALLET_HOME_ROUTE);
        }
    }, [history, isUnlocked]);

    return (
        <Switch>
            {/* Home */}
            <Route path={ADD_NEW_WALLET_HOME_ROUTE} component={AddNewWallet} />
            <Route
                path={ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_ROUTE}
                render={() => (
                    <ConnectHardwareWallet backRoute={ADD_NEW_WALLET_HOME_ROUTE} />
                )}
            />
            <Route
                path={ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_DONE_ROUTE}
                render={() => <WalletSuccess variant="hardware" />}
            />

            {/* Create Wallet */}
            <Route path={ADD_NEW_WALLET_CREATE_WALLET_ROUTE} component={CreateWallet} />
            <Route
                path={ADD_NEW_WALLET_CREATE_WALLET_DONE_ROUTE}
                render={() => <WalletSuccess variant="created" />}
            />
            {/* Import Wallet */}
            <Route
                path={ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE}
                component={SelectImportType}
                exact
            />
            <Route
                path={ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE}
                component={RecoverWalletUsingSeedPhrase}
            />
            <Route
                path={ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE}
                component={RecoverWalletUsingPrivateKey}
            />
            <Route
                path={ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE}
                render={() => <WalletSuccess variant="recovered" />}
            />
            {/* Unlock */}
            <Route
                path={ADD_NEW_WALLET_UNLOCK_ROUTE}
                component={(props: any) => (
                    <Unlock
                        {...props}
                        onUnlockSuccess={onUnlockSuccess}
                        onForgotPinCode={onForgotPinCode}
                    />
                )}
            />
            {/* Switch */}
            <Route exact path="*" component={AddNewWalletFlowSwitch} />
        </Switch>
    );
});
