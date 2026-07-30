import { useSelector } from 'react-redux';
import { EIP5792_APPROVAL_TYPES } from '../../lib/eip5792/types';
import { ReduxState } from '../store';

export const useWalletSendCallsApprovalRequests = () => {
    const pendingApprovals = useSelector((state: ReduxState) => state.globalState.pendingApprovals);
    return Object.values(pendingApprovals).filter(
        ({ type }) => type === EIP5792_APPROVAL_TYPES.SEND_CALLS,
    );
};

export const useWalletShowCallsStatusApprovalRequests = () => {
    const pendingApprovals = useSelector((state: ReduxState) => state.globalState.pendingApprovals);
    return Object.values(pendingApprovals).filter(
        ({ type }) => type === EIP5792_APPROVAL_TYPES.SHOW_CALLS_STATUS,
    );
};

export function useFirstWalletSendCallsApprovalRequest() {
    const requests = useWalletSendCallsApprovalRequests();
    return requests.length ? requests[0] : null;
}

export function useFirstWalletShowCallsStatusApprovalRequest() {
    const requests = useWalletShowCallsStatusApprovalRequests();
    return requests.length ? requests[0] : null;
}
