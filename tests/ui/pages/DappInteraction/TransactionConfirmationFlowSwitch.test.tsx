import React from 'react';
import { createMemoryHistory } from 'history';
import { render, waitFor } from '@testing-library/react';
import { Router } from 'react-router-dom';

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
} from '../../../../src/shared/constants/routes';
import { TransactionType } from '../../../../src/shared/types/Transaction';
import { useFirstPermissionRequest, useFirstUnapprovedMessage } from '../../../../src/store/selectors';
import {
    useFirstWalletSendCallsApprovalRequest,
    useFirstWalletShowCallsStatusApprovalRequest,
} from '../../../../src/store/selectors/eip5792';
import { useFirstUnapprovedNetworkRequest } from '../../../../src/store/selectors/network';
import { useFirstUnapprovedTx } from '../../../../src/store/selectors/transactions';
import TransactionConfirmationFlowSwitch from '../../../../src/ui/pages/DappInteraction/TransactionConfirmationFlowSwitch';

jest.mock('../../../../src/store/selectors', () => ({
    useFirstPermissionRequest: jest.fn(),
    useFirstUnapprovedMessage: jest.fn(),
}));

jest.mock('../../../../src/store/selectors/network', () => ({
    useFirstUnapprovedNetworkRequest: jest.fn(),
}));

jest.mock('../../../../src/store/selectors/transactions', () => ({
    useFirstUnapprovedTx: jest.fn(),
}));

jest.mock('../../../../src/store/selectors/eip5792', () => ({
    useFirstWalletSendCallsApprovalRequest: jest.fn(),
    useFirstWalletShowCallsStatusApprovalRequest: jest.fn(),
}));

function renderSwitch() {
    const history = createMemoryHistory({
        initialEntries: ['/anything'],
    });

    render(
        <Router history={history}>
            <TransactionConfirmationFlowSwitch />
        </Router>,
    );
    return history;
}

describe('TransactionConfirmationFlowSwitch', () => {
    beforeEach(() => {
        (useFirstPermissionRequest as jest.Mock).mockReturnValue(null);
        (useFirstUnapprovedMessage as jest.Mock).mockReturnValue(null);
        (useFirstUnapprovedNetworkRequest as jest.Mock).mockReturnValue(null);
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(null);
        (useFirstWalletShowCallsStatusApprovalRequest as jest.Mock).mockReturnValue(null);
        (useFirstUnapprovedTx as jest.Mock).mockReturnValue({
            type: TransactionType.contractInteraction,
        });
    });

    it('prefers network switch over other requests', async () => {
        (useFirstUnapprovedNetworkRequest as jest.Mock).mockReturnValue({ id: 'n' });
        const history = renderSwitch();
        await waitFor(() => expect(history.location.pathname).toBe(SWITCH_NETWORK_ROUTE));
    });

    it('routes permission connect', async () => {
        (useFirstPermissionRequest as jest.Mock).mockReturnValue({ metadata: {} });
        const history = renderSwitch();
        await waitFor(() => expect(history.location.pathname).toBe(PERMISSION_CONFIRMATION_ROUTE));
    });

    it('routes signature flow', async () => {
        (useFirstUnapprovedMessage as jest.Mock).mockReturnValue({ id: 'm' });
        const history = renderSwitch();
        await waitFor(() => expect(history.location.pathname).toBe(SIGNATURE_REQUEST_ROUTE));
    });

    it('routes send calls screen', async () => {
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue({ id: 'sc' });
        const history = renderSwitch();
        await waitFor(() => expect(history.location.pathname).toBe(TX_CONFIRMATION_SEND_CALLS_ROUTE));
    });

    it('routes batch status screen', async () => {
        (useFirstWalletShowCallsStatusApprovalRequest as jest.Mock).mockReturnValue({ id: 'bs' });
        const history = renderSwitch();
        await waitFor(() => expect(history.location.pathname).toBe(TX_CONFIRMATION_CALLS_STATUS_ROUTE));
    });

    const cases = [
        [TransactionType.deployContract, TX_CONFIRMATION_DEPLOY_CONTRACT_ROUTE] as const,
        [TransactionType.tokenMethodApprove, TX_CONFIRMATION_TOKEN_ALLOWANCE_ROUTE] as const,
        [TransactionType.simpleSend, TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE] as const,
        [TransactionType.tokenMethodTransfer, TX_CONFIRMATION_SEND_OTHER_COIN_ROUTE] as const,
        [TransactionType.contractInteraction, TX_CONFIRMATION_CONTRACT_INTERACTION_ROUTE] as const,
    ];

    cases.forEach(([type, pathname]) => {
        it(`maps ${type}`, async () => {
            (useFirstUnapprovedTx as jest.Mock).mockReturnValue({ type });
            const history = renderSwitch();
            await waitFor(() => expect(history.location.pathname).toBe(pathname));
        });
    });
});
