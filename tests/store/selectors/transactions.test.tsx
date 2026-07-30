import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { renderHook } from '@testing-library/react';
import { ApprovalType } from '@metamask/controller-utils';

import {
    useUnapprovedTxs,
    useUnapprovedTxRequests,
    useUnapprovedTxsRequestInCurrentNetwork,
    useUnapprovedTxsInCurrentNetwork,
    useFirstUnapprovedTx,
    useFirstUnapprovedTxRequest,
} from '../../../src/store/selectors/transactions';
import { TransactionStatus } from '../../../src/shared/types/Transaction';
import { toHex } from '../../../src/lib/web3';

const wrap = (state: any) => {
    const store = createStore(() => state);
    return ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
    );
};

const baseState = (txs: any[] = [], pendingApprovals: any = {}, chainId = 1) => ({
    globalState: {
        rpcTransactions: txs,
        pendingApprovals,
        selectedNetwork: { chain_id: chainId },
    },
});

describe('selectors/transactions', () => {
    it('useUnapprovedTxs filters by chain and status, sorted ascending', () => {
        const state = baseState([
            { id: 'a', chainId: toHex(1), status: TransactionStatus.unapproved, time: 200 },
            { id: 'b', chainId: toHex(1), status: TransactionStatus.unapproved, time: 100 },
            { id: 'c', chainId: toHex(2), status: TransactionStatus.unapproved, time: 50 },
            { id: 'd', chainId: toHex(1), status: TransactionStatus.confirmed, time: 1 },
        ]);
        const { result } = renderHook(() => useUnapprovedTxs(), { wrapper: wrap(state) });
        expect(Object.keys(result.current)).toEqual(['b', 'a']);
    });

    it('useUnapprovedTxRequests returns only ApprovalType.Transaction entries', () => {
        const state = baseState(
            [],
            {
                a: { id: 'a', type: ApprovalType.Transaction },
                b: { id: 'b', type: 'OtherType' },
            },
        );
        const { result } = renderHook(() => useUnapprovedTxRequests(), { wrapper: wrap(state) });
        expect(result.current.map((r: any) => r.id)).toEqual(['a']);
    });

    it('useUnapprovedTxsRequestInCurrentNetwork filters by chain', () => {
        const tx = { id: 'a', chainId: toHex(1), status: TransactionStatus.unapproved, time: 1 };
        const state = baseState([tx], { a: { id: 'a', type: ApprovalType.Transaction } });
        const { result } = renderHook(() => useUnapprovedTxsRequestInCurrentNetwork(), {
            wrapper: wrap(state),
        });
        expect(result.current).toHaveLength(1);
    });

    it('useUnapprovedTxsInCurrentNetwork returns matching txs', () => {
        const tx = { id: 'a', chainId: toHex(1), status: TransactionStatus.unapproved, time: 1 };
        const state = baseState([tx], { a: { id: 'a', type: ApprovalType.Transaction } });
        const { result } = renderHook(() => useUnapprovedTxsInCurrentNetwork(), { wrapper: wrap(state) });
        expect(result.current).toEqual([tx]);
    });

    it('useFirstUnapprovedTx returns first or null', () => {
        const state = baseState([], {});
        const { result } = renderHook(() => useFirstUnapprovedTx(), { wrapper: wrap(state) });
        expect(result.current).toBeNull();
    });

    it('useFirstUnapprovedTxRequest returns first or null', () => {
        const state = baseState([], {});
        const { result } = renderHook(() => useFirstUnapprovedTxRequest(), { wrapper: wrap(state) });
        expect(result.current).toBeNull();
    });
});
