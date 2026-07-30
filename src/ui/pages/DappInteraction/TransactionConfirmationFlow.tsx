import React from 'react';
import { Switch } from 'react-router-dom';
import {
    TX_CONFIRMATION_CALLS_STATUS_ROUTE,
    PERMISSION_CONFIRMATION_ROUTE,
    SIGNATURE_REQUEST_ROUTE,
    SWITCH_NETWORK_ROUTE,
    TX_CONFIRMATION_CONTRACT_INTERACTION_ROUTE,
    TX_CONFIRMATION_DEPLOY_CONTRACT_ROUTE,
    TX_CONFIRMATION_SEND_CALLS_ROUTE,
    TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE,
    TX_CONFIRMATION_SEND_OTHER_COIN_ROUTE,
    TX_CONFIRMATION_TOKEN_ALLOWANCE_CONFIRMATION_ROUTE,
    TX_CONFIRMATION_TOKEN_ALLOWANCE_ROUTE,
} from '../../../shared/constants/routes';
import { Route } from 'react-router-dom';
import Authenticated from '../Authenticated';
import ContractInteractionConfirmation from './ContractInteractionConfirmation';
import CallBatchStatusRequest from './CallBatchStatusRequest';
import DappInteractionProvider from './DappInteractionProvider';
import DeployContractConfirmation from './DeployContractConfirmation';
import PermissionConnect from './PermissionConnect';
import SendNativeCoinConfirmation from './SendNativeCoinConfirmation';
import SendOtherCoinConfirmation from './SendOtherCoinConfirmation';
import SignatureRequest from './SignatureRequest';
import SendCallsConfirmation from './SendCallsConfirmation';
import SwitchNetwork from './SwitchNetwork';
import TokenAllowance from './TokenAllowance';
import TokenAllowanceConfirmation from './TokenAllowanceConfirmation';
import TransactionConfirmationFlowSwitch from './TransactionConfirmationFlowSwitch';

const TransactionConfirmationFlow = React.memo(() => {
    return (
        <DappInteractionProvider>
            <Switch>
                <Authenticated
                    path={TX_CONFIRMATION_TOKEN_ALLOWANCE_ROUTE}
                    component={TokenAllowance}
                />
                <Authenticated
                    path={TX_CONFIRMATION_TOKEN_ALLOWANCE_CONFIRMATION_ROUTE}
                    component={TokenAllowanceConfirmation}
                />
                <Authenticated
                    path={TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE}
                    component={SendNativeCoinConfirmation}
                />
                <Authenticated
                    path={TX_CONFIRMATION_SEND_OTHER_COIN_ROUTE}
                    component={SendOtherCoinConfirmation}
                />
                <Authenticated
                    path={TX_CONFIRMATION_SEND_CALLS_ROUTE}
                    component={SendCallsConfirmation}
                />
                <Authenticated
                    path={TX_CONFIRMATION_CALLS_STATUS_ROUTE}
                    component={CallBatchStatusRequest}
                />
                <Authenticated
                    path={TX_CONFIRMATION_CONTRACT_INTERACTION_ROUTE}
                    component={ContractInteractionConfirmation}
                />
                <Authenticated
                    path={TX_CONFIRMATION_DEPLOY_CONTRACT_ROUTE}
                    component={DeployContractConfirmation}
                />
                <Authenticated path={PERMISSION_CONFIRMATION_ROUTE} component={PermissionConnect} />
                <Authenticated path={SWITCH_NETWORK_ROUTE} component={SwitchNetwork} />
                <Authenticated path={SIGNATURE_REQUEST_ROUTE} component={SignatureRequest} />

                <Route exact path="*" component={TransactionConfirmationFlowSwitch} />
            </Switch>
        </DappInteractionProvider>
    );
});

export default TransactionConfirmationFlow;
