import React, { useCallback, useState } from 'react';
import { Switch, useHistory } from 'react-router-dom';
import {
    DEFAULT_ROUTE,
    FORGOT_CODE_CREATE_PIN_CODE_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
} from '../../shared/constants/routes';
import { importWallet, updateStateFromBackground } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import { Route } from 'react-router-dom';
import Toast from '../components/Toast';
import CreatePinCode from './CreatePinCode';
import ForgotCode from './ForgotCode';
import ForgotCodeFlowSwitch from './ForgotCodeFlowSwitch';

type Props = {};

export default React.memo((props: Props) => {
    const {} = props;
    const history = useHistory();
    const dispatch = useAppDispatch();

    const [seedPhrase, setSeedPhrase] = useState('');

    const onRecovered = useCallback(
        (secretPhrases: string) => {
            setSeedPhrase(secretPhrases);
            history.push(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);
        },
        [history],
    );

    const onCreatePinCode = useCallback(
        async (code: string) => {
            try {
                await dispatch(importWallet(code, seedPhrase));
                await dispatch(updateStateFromBackground());
                history.push(DEFAULT_ROUTE);
            } catch (error: any) {
                const message = error?.message;

                if (message) {
                    Toast.showError(message);
                }
            }
        },
        [dispatch, history, seedPhrase],
    );

    return (
        <Switch>
            <Route
                path={FORGOT_CODE_RECOVER_CODE_ROUTE}
                component={(props: any) => (
                    <ForgotCode {...props} seedPhrase={seedPhrase} onRecovered={onRecovered} />
                )}
            />

            <Route
                path={FORGOT_CODE_CREATE_PIN_CODE_ROUTE}
                component={(props: any) => (
                    <CreatePinCode {...props} onCreatePinCode={onCreatePinCode} />
                )}
            />

            <Route exact path="*" component={ForgotCodeFlowSwitch} />
        </Switch>
    );
});
