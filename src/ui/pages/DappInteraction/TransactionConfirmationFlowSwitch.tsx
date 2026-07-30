import { Redirect } from 'react-router-dom';
import {
    PERMISSION_CONFIRMATION_ROUTE,
    SIGNATURE_REQUEST_ROUTE,
    SWITCH_NETWORK_ROUTE,
    TX_CONFIRMATION_CALLS_STATUS_ROUTE,
    TX_CONFIRMATION_CONTRACT_INTERACTION_ROUTE,
    TX_CONFIRMATION_DEPLOY_CONTRACT_ROUTE,
    TX_CONFIRMATION_SEND_CALLS_ROUTE,
    TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE,
    TX_CONFIRMATION_SEND_OTHER_COIN_ROUTE,
    TX_CONFIRMATION_TOKEN_ALLOWANCE_ROUTE,
} from '../../../shared/constants/routes';
import { TransactionType } from '../../../shared/types/Transaction';
import { useFirstPermissionRequest, useFirstUnapprovedMessage } from '../../../store/selectors';
import {
    useFirstWalletSendCallsApprovalRequest,
    useFirstWalletShowCallsStatusApprovalRequest,
} from '../../../store/selectors/eip5792';
import { useFirstUnapprovedNetworkRequest } from '../../../store/selectors/network';
import { useFirstUnapprovedTx } from '../../../store/selectors/transactions';

export default function TransactionConfirmationFlowSwitch() {
    const firstpermissionRequest = useFirstPermissionRequest();
    const firstUnapproveMsg = useFirstUnapprovedMessage();
    const firstUnapproveTx = useFirstUnapprovedTx();
    const firstNetworkRequest = useFirstUnapprovedNetworkRequest();
    const firstSendCallsRequest = useFirstWalletSendCallsApprovalRequest();
    const firstShowCallsStatusRequest = useFirstWalletShowCallsStatusApprovalRequest();

    if (firstNetworkRequest !== null) {
        return <Redirect to={{ pathname: SWITCH_NETWORK_ROUTE }} />;
    }

    if (firstpermissionRequest !== null) {
        return <Redirect to={{ pathname: PERMISSION_CONFIRMATION_ROUTE }} />;
    }

    if (firstUnapproveMsg !== null) {
        return <Redirect to={{ pathname: SIGNATURE_REQUEST_ROUTE }} />;
    }

    if (firstSendCallsRequest !== null) {
        return <Redirect to={{ pathname: TX_CONFIRMATION_SEND_CALLS_ROUTE }} />;
    }

    if (firstShowCallsStatusRequest !== null) {
        return <Redirect to={{ pathname: TX_CONFIRMATION_CALLS_STATUS_ROUTE }} />;
    }

    switch (firstUnapproveTx?.type) {
        case TransactionType.deployContract:
            return <Redirect to={{ pathname: TX_CONFIRMATION_DEPLOY_CONTRACT_ROUTE }} />;

        case TransactionType.tokenMethodApprove:
            return <Redirect to={{ pathname: TX_CONFIRMATION_TOKEN_ALLOWANCE_ROUTE }} />;

        case TransactionType.simpleSend:
            return <Redirect to={{ pathname: TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE }} />;

        case TransactionType.tokenMethodTransfer:
            return <Redirect to={{ pathname: TX_CONFIRMATION_SEND_OTHER_COIN_ROUTE }} />;

        default:
            return <Redirect to={{ pathname: TX_CONFIRMATION_CONTRACT_INTERACTION_ROUTE }} />;
    }
}
