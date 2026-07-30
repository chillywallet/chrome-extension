import { ApprovalType } from '@metamask/controller-utils';
import { useSelector } from 'react-redux';
import { ReduxState } from '../store';

export const useUnapprovedNetworkRequest = () => {
    const pendingApprovals = useSelector((state: ReduxState) => state.globalState.pendingApprovals);
    return Object.values(pendingApprovals).filter(
        ({ type }) => type === ApprovalType.SwitchEthereumChain,
    );
};

export function useFirstUnapprovedNetworkRequest() {
    const msgs = useUnapprovedNetworkRequest();
    const list = Object.values(msgs);
    return list.length ? list[0] : null;
}
