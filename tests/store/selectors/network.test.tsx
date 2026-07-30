import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { renderHook } from '@testing-library/react';
import { ApprovalType } from '@metamask/controller-utils';

import {
    useUnapprovedNetworkRequest,
    useFirstUnapprovedNetworkRequest,
} from '../../../src/store/selectors/network';

const wrap = (state: any) => {
    const store = createStore(() => state);
    return ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
    );
};

const buildState = (pendingApprovals: any) => ({
    globalState: { pendingApprovals },
});

describe('selectors/network', () => {
    it('useUnapprovedNetworkRequest returns SwitchEthereumChain approvals', () => {
        const state = buildState({
            a: { id: 'a', type: ApprovalType.SwitchEthereumChain },
            b: { id: 'b', type: 'OtherType' },
        });
        const { result } = renderHook(() => useUnapprovedNetworkRequest(), { wrapper: wrap(state) });
        expect(result.current.map((r: any) => r.id)).toEqual(['a']);
    });

    it('useFirstUnapprovedNetworkRequest returns first or null', () => {
        const empty = buildState({});
        const { result: r1 } = renderHook(() => useFirstUnapprovedNetworkRequest(), {
            wrapper: wrap(empty),
        });
        expect(r1.current).toBeNull();

        const populated = buildState({ a: { id: 'a', type: ApprovalType.SwitchEthereumChain } });
        const { result: r2 } = renderHook(() => useFirstUnapprovedNetworkRequest(), {
            wrapper: wrap(populated),
        });
        expect(r2.current).toEqual({ id: 'a', type: ApprovalType.SwitchEthereumChain });
    });
});
