import { ApprovalType } from '@metamask/controller-utils';
import { useSelector } from 'react-redux';
import { toHex } from '../../lib/web3';
import { TransactionMeta, TransactionStatus } from '../../shared/types/Transaction';
import { ReduxState } from '../store';

export const useUnapprovedTxs = () => {
    const transactions = useSelector((state: ReduxState) => state.globalState.rpcTransactions);
    const chainId = useSelector((state: ReduxState) => state.globalState.selectedNetwork.chain_id);

    return transactions
        .filter(
            transaction =>
                transaction.chainId === toHex(chainId) &&
                transaction.status === TransactionStatus.unapproved,
        )
        .sort((a, b) => a.time - b.time) // Ascending
        .reduce((result, transaction) => {
            result[transaction.id] = transaction;
            return result;
        }, {} as Record<string, TransactionMeta>);
};

export const useUnapprovedTxRequests = () => {
    const pendingApprovals = useSelector((state: ReduxState) => state.globalState.pendingApprovals);
    return Object.values(pendingApprovals).filter(({ type }) => type === ApprovalType.Transaction);
};

export const useUnapprovedTxsRequestInCurrentNetwork = () => {
    const chainId = useSelector((state: ReduxState) => state.globalState.selectedNetwork.chain_id);
    const unapprovedTxs = useUnapprovedTxs();
    const unapprovedTxRequests = useUnapprovedTxRequests();

    return unapprovedTxRequests.filter(({ id }) => {
        return unapprovedTxs[id] && unapprovedTxs[id].chainId === toHex(chainId);
    });
};

export function useUnapprovedTxsInCurrentNetwork() {
    const chainId = useSelector((state: ReduxState) => state.globalState.selectedNetwork.chain_id);
    const unapprovedTxs = useUnapprovedTxs();
    const unapprovedTxRequests = useUnapprovedTxRequests();
    const txs: TransactionMeta[] = [];
    unapprovedTxRequests.forEach(({ id }) => {
        if (unapprovedTxs[id] && unapprovedTxs[id].chainId === toHex(chainId)) {
            txs.push(unapprovedTxs[id]);
        }
    });

    return txs;
}

export function useFirstUnapprovedTx() {
    const txs = useUnapprovedTxsInCurrentNetwork();
    const list = Object.values(txs);

    return list.length ? list[0] : null;
}

export function useFirstUnapprovedTxRequest() {
    const txs = useUnapprovedTxsRequestInCurrentNetwork();
    const list = Object.values(txs);

    return list.length ? list[0] : null;
}
