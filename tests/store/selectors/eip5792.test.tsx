import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { renderHook } from '@testing-library/react';

import {
    useWalletSendCallsApprovalRequests,
    useWalletShowCallsStatusApprovalRequests,
    useFirstWalletSendCallsApprovalRequest,
    useFirstWalletShowCallsStatusApprovalRequest,
} from '../../../src/store/selectors/eip5792';
import { EIP5792_APPROVAL_TYPES } from '../../../src/lib/eip5792/types';

const wrap = (state: any) => {
    const store = createStore(() => state);
    return ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
    );
};

const build = (pendingApprovals: any) => ({ globalState: { pendingApprovals } });

describe('selectors/eip5792', () => {
    it('useWalletSendCallsApprovalRequests returns SEND_CALLS approvals', () => {
        const state = build({
            a: { id: 'a', type: EIP5792_APPROVAL_TYPES.SEND_CALLS },
            b: { id: 'b', type: EIP5792_APPROVAL_TYPES.SHOW_CALLS_STATUS },
        });
        const { result } = renderHook(() => useWalletSendCallsApprovalRequests(), { wrapper: wrap(state) });
        expect(result.current.map((r: any) => r.id)).toEqual(['a']);
    });

    it('useWalletShowCallsStatusApprovalRequests returns SHOW_CALLS_STATUS approvals', () => {
        const state = build({
            a: { id: 'a', type: EIP5792_APPROVAL_TYPES.SEND_CALLS },
            b: { id: 'b', type: EIP5792_APPROVAL_TYPES.SHOW_CALLS_STATUS },
        });
        const { result } = renderHook(() => useWalletShowCallsStatusApprovalRequests(), {
            wrapper: wrap(state),
        });
        expect(result.current.map((r: any) => r.id)).toEqual(['b']);
    });

    it('useFirstWalletSendCallsApprovalRequest returns first or null', () => {
        const { result: empty } = renderHook(() => useFirstWalletSendCallsApprovalRequest(), {
            wrapper: wrap(build({})),
        });
        expect(empty.current).toBeNull();
        const populated = build({ a: { id: 'a', type: EIP5792_APPROVAL_TYPES.SEND_CALLS } });
        const { result } = renderHook(() => useFirstWalletSendCallsApprovalRequest(), {
            wrapper: wrap(populated),
        });
        expect(result.current).toEqual({ id: 'a', type: EIP5792_APPROVAL_TYPES.SEND_CALLS });
    });

    it('useFirstWalletShowCallsStatusApprovalRequest returns first or null', () => {
        const { result: empty } = renderHook(() => useFirstWalletShowCallsStatusApprovalRequest(), {
            wrapper: wrap(build({})),
        });
        expect(empty.current).toBeNull();
        const populated = build({ a: { id: 'a', type: EIP5792_APPROVAL_TYPES.SHOW_CALLS_STATUS } });
        const { result } = renderHook(() => useFirstWalletShowCallsStatusApprovalRequest(), {
            wrapper: wrap(populated),
        });
        expect(result.current).toEqual({ id: 'a', type: EIP5792_APPROVAL_TYPES.SHOW_CALLS_STATUS });
    });
});
