

import React from 'react';
import * as ChainsUtils from '../../../../src/lib/ChainsUtils';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CallBatchStatusCode, type CallBatchStatus } from '../../../../src/lib/eip5792/types';
import CallBatchStatusRequest from '../../../../src/ui/pages/DappInteraction/CallBatchStatusRequest';
import { useFirstWalletShowCallsStatusApprovalRequest } from '../../../../src/store/selectors/eip5792';
import { useAppDispatch } from '../../../../src/store/store';

import {
    DappInteractionContextProviderHarness,
    mergeDappContext,
} from './fixtures/dappInteractionContextFixture';

jest.mock('../../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn(), showError: jest.fn() },
}));

jest.mock('../../../../src/store/selectors', () => ({
    __esModule: true,
    useSubjectMetadataByOrigin: jest.fn(() => ({ name: 'Test Dapp' })),
}));

jest.mock('../../../../src/store/selectors/eip5792', () => ({
    __esModule: true,
    useFirstWalletShowCallsStatusApprovalRequest: jest.fn(),
}));

jest.mock('../../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: { setTxConfirmationHandling: jest.fn() },
}));

const waitingRef = { current: false } as React.MutableRefObject<boolean | 'ignore'>;

let getCurrentChainsSpy: jest.SpyInstance;

function setupApprovedRequest(extraStatus?: Partial<CallBatchStatus>) {
    const status: CallBatchStatus = {
        version: '1',
        chainId: '0x1',
        id: 'b1',
        status: CallBatchStatusCode.Confirmed,
        atomic: false,
        receipts: [
            {
                logs: [],
                status: '1',
                blockHash: '0xbb',
                blockNumber: '1',
                gasUsed: '21000',
                transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            },
        ],
        ...extraStatus,
    };

    (useFirstWalletShowCallsStatusApprovalRequest as jest.Mock).mockReturnValue({
        id: 'req1',
        origin: 'https://origin.test',
        requestData: { batchId: '0xbeef00000000000000000000000000000000000', origin: 'https://o.com', status },
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    waitingRef.current = false;
    window.open = jest.fn();
    Object.assign(navigator, {
        clipboard: { writeText: jest.fn(() => Promise.resolve()) },
    });
    setupApprovedRequest();

    getCurrentChainsSpy = jest.spyOn(ChainsUtils, 'getCurrentChains').mockReturnValue([
        { chain_id: 1, name: 'Ethereum', explorer_url: 'https://etherscan.io' } as any,
    ]);

    (useAppDispatch as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue(undefined));
});

afterEach(() => {
    getCurrentChainsSpy?.mockRestore();
});

describe('CallBatchStatusRequest', () => {
    it('renders batch summary and invokes close', async () => {
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText(/requested batch status/i)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(useAppDispatch).toHaveBeenCalled();
    });

    it('covers unknown batch state label', async () => {
        setupApprovedRequest({ status: 999999 as unknown as CallBatchStatusCode });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(useAppDispatch).toHaveBeenCalled();
    });

    it('copies batch id from batch row', async () => {
        const { container } = render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        const batchRowButton = container.querySelector('button.inline-flex.items-center.gap-1');
        expect(batchRowButton).not.toBeNull();
        await userEvent.click(batchRowButton!);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            '0xbeef00000000000000000000000000000000000',
        );
    });

    it('opens transaction hash in explorer', async () => {
        const { container } = render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        const txButtons = container.querySelectorAll('button.text-primary');
        expect(txButtons.length).toBeGreaterThan(0);
        await userEvent.click(txButtons[txButtons.length - 1]);
        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining('etherscan'),
            '_blank',
            'noopener,noreferrer',
        );
    });

    it('renders pending status badge and atomic Yes label', () => {
        setupApprovedRequest({
            status: CallBatchStatusCode.Pending,
            atomic: true,
            receipts: [],
        });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('renders partial revert status', () => {
        setupApprovedRequest({ status: CallBatchStatusCode.PartialRevert });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText(/partially reverted/i)).toBeInTheDocument();
    });

    it('renders off-chain failure status', () => {
        setupApprovedRequest({ status: CallBatchStatusCode.OffchainFailure });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText(/off-chain failure/i)).toBeInTheDocument();
    });

    it('renders reverted status', () => {
        setupApprovedRequest({ status: CallBatchStatusCode.Reverted });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText('Reverted')).toBeInTheDocument();
    });

    it('renders failed and unknown receipt statuses', () => {
        setupApprovedRequest({
            receipts: [
                {
                    logs: [],
                    status: '0',
                    blockHash: '0xbb',
                    blockNumber: '1',
                    gasUsed: '21000',
                    transactionHash: '0xaa',
                },
                {
                    logs: [],
                    status: 'xyz',
                    blockHash: '0xcc',
                    blockNumber: '2',
                    gasUsed: '21000',
                    transactionHash: '0xbb',
                },
            ],
        });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('returns chainId when chain is not found and disables explorer link', async () => {
        getCurrentChainsSpy.mockReturnValue([]);
        setupApprovedRequest({ chainId: '0x1' });

        const { container } = render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText('0x1')).toBeInTheDocument();

        const txButtons = container.querySelectorAll('button.text-primary');
        await userEvent.click(txButtons[txButtons.length - 1]);
        expect(window.open).not.toHaveBeenCalled();
    });

    it('renders raw chainId when not parseable as hex', () => {
        setupApprovedRequest({ chainId: 'not-hex' });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText('not-hex')).toBeInTheDocument();
    });

    it('renders defaults when status is missing entirely', () => {
        (useFirstWalletShowCallsStatusApprovalRequest as jest.Mock).mockReturnValue({
            id: 'req-no-status',
            origin: 'https://origin.test',
            requestData: { batchId: '0xabc', origin: 'https://o.com' },
        });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText('Unknown')).toBeInTheDocument();
        expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2);
    });

    it('skips close action when waitingRef is already busy', async () => {
        const busyRef = {
            current: 'ignore',
        } as React.MutableRefObject<boolean | 'ignore'>;
        const dispatchMock = jest.fn().mockResolvedValue(undefined);
        (useAppDispatch as jest.Mock).mockReturnValue(dispatchMock);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef: busyRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    it('skips close action when there is no approval request', async () => {
        (useFirstWalletShowCallsStatusApprovalRequest as jest.Mock).mockReturnValue(undefined);
        const dispatchMock = jest.fn().mockResolvedValue(undefined);
        (useAppDispatch as jest.Mock).mockReturnValue(dispatchMock);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    it('toasts error when clipboard write fails', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn(() => Promise.reject(new Error('nope'))),
            },
        });

        const { container } = render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        const batchRowButton = container.querySelector('button.inline-flex.items-center.gap-1');
        await userEvent.click(batchRowButton!);
        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('Failed to copy batch ID');
        });
    });

    it('no-ops copy click when batch id is missing', async () => {
        (useFirstWalletShowCallsStatusApprovalRequest as jest.Mock).mockReturnValue({
            id: 'req-no-batch',
            origin: 'https://origin.test',
            requestData: { origin: 'https://o.com' },
        });

        const { container } = render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <CallBatchStatusRequest />
            </DappInteractionContextProviderHarness>,
        );

        const batchRowButton = container.querySelector('button.inline-flex.items-center.gap-1');
        await userEvent.click(batchRowButton!);
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
});
