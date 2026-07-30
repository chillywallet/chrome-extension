import { formatWalletAddress } from '../../../shared/utils/format';
import React, { useCallback, useMemo } from 'react';
import { FaCopy, FaExternalLinkAlt } from 'react-icons/fa';
import { getCurrentChains } from '../../../lib/ChainsUtils';
import { CallBatchStatus, CallBatchStatusCode } from '../../../lib/eip5792/types';
import eventManager from '../../../shared/utils/eventManager';
import { formatAddress } from '../../../shared/utils/string';
import { resolvePendingApproval } from '../../../store/actions/uiActions';
import { useSubjectMetadataByOrigin } from '../../../store/selectors';
import { useFirstWalletShowCallsStatusApprovalRequest } from '../../../store/selectors/eip5792';
import { useAppDispatch } from '../../../store/store';
import Toast from '../../components/Toast';
import { useDappInteractionData } from './DappInteractionProvider';

function statusLabel(status: CallBatchStatusCode): string {
    switch (status) {
        case CallBatchStatusCode.Pending:
            return 'Pending';
        case CallBatchStatusCode.Confirmed:
            return 'Confirmed';
        case CallBatchStatusCode.OffchainFailure:
            return 'Off-chain failure';
        case CallBatchStatusCode.Reverted:
            return 'Reverted';
        case CallBatchStatusCode.PartialRevert:
            return 'Partially reverted';
        default:
            return `Status ${status}`;
    }
}

function getBatchStatusBadgeClass(status: CallBatchStatusCode): string {
    switch (status) {
        case CallBatchStatusCode.Confirmed:
            return 'bg-green-600 text-white';
        case CallBatchStatusCode.Pending:
            return 'bg-amber-500 text-white';
        case CallBatchStatusCode.PartialRevert:
            return 'bg-amber-500 text-white';
        case CallBatchStatusCode.OffchainFailure:
        case CallBatchStatusCode.Reverted:
            return 'bg-red-500 text-white';
        default:
            return 'bg-slate-200 dark:bg-darkline text-black dark:text-white';
    }
}

function receiptStatusLabel(status: string): string {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === '1' || normalized === '0x1' || normalized === 'true') {
        return 'Success';
    }
    if (normalized === '0' || normalized === '0x0' || normalized === 'false') {
        return 'Failed';
    }
    return 'Unknown';
}

function getReceiptStatusBadgeClass(status: string): string {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === '1' || normalized === '0x1' || normalized === 'true') {
        return 'bg-green-600 text-white';
    }
    if (normalized === '0' || normalized === '0x0' || normalized === 'false') {
        return 'bg-red-500 text-white';
    }
    return 'bg-slate-200 dark:bg-darkline text-black dark:text-white';
}

export default React.memo(() => {
    const dispatch = useAppDispatch();
    const { waitingRef } = useDappInteractionData();
    const request = useFirstWalletShowCallsStatusApprovalRequest();
    const requestData = (request?.requestData ?? {}) as {
        batchId?: string;
        origin?: string;
        status?: CallBatchStatus;
    };

    const origin = requestData.origin ?? request?.origin ?? '';
    const status = requestData.status;
    const subjectMetadata = useSubjectMetadataByOrigin(origin);

    const onClosePress = useCallback(async () => {
        if (!request || waitingRef?.current) {
            return;
        }
        eventManager.setTxConfirmationHandling(true);
        try {
            await dispatch(resolvePendingApproval(request.id, null));
            if (waitingRef?.current !== undefined) {
                waitingRef.current = 'ignore';
            }
        } finally {
            eventManager.setTxConfirmationHandling(false);
        }
    }, [dispatch, request, waitingRef]);

    const receipts = useMemo(() => status?.receipts ?? [], [status?.receipts]);

    const chainName = useMemo(() => {
        if (!status?.chainId) {
            return '-';
        }
        const parsed = parseInt(status.chainId, 16);
        if (!Number.isFinite(parsed)) {
            return status.chainId;
        }
        const chain = getCurrentChains().find(_chain => _chain.chain_id === parsed);
        return chain?.name ?? status.chainId;
    }, [status?.chainId]);

    const explorerBase = useMemo(() => {
        if (!status?.chainId) {
            return null;
        }
        const parsed = parseInt(status.chainId, 16);
        if (!Number.isFinite(parsed)) {
            return null;
        }
        const chain = getCurrentChains().find(_chain => _chain.chain_id === parsed);
        return chain?.explorer_url ?? null;
    }, [status?.chainId]);

    const openTxInExplorer = useCallback(
        (hash: string) => {
            if (!explorerBase || !hash) {
                return;
            }
            const url = `${explorerBase}/tx/${hash}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        },
        [explorerBase],
    );

    const onCopyBatchId = useCallback(async () => {
        const batchId = requestData.batchId;
        if (!batchId) {
            return;
        }

        try {
            await navigator.clipboard.writeText(batchId);
            Toast.showSuccess('Copied batch ID');
        } catch {
            Toast.showError('Failed to copy batch ID');
        }
    }, [requestData.batchId]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div id="scrollable" className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-5">
                <div className="text-sm text-gray-500 mb-2">{origin}</div>
                <div className="text-xl font-semibold mb-4">
                    {subjectMetadata?.name ?? 'Dapp'} requested batch status
                </div>

                <div className="border border-slate-200 dark:border-darkline rounded-md p-4 mb-5">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Batch ID</span>
                        <button
                            className="inline-flex items-center gap-1 text-primary hover:opacity-80"
                            disabled={!requestData.batchId}
                            onClick={e => {
                                e.preventDefault();
                                onCopyBatchId();
                            }}>
                            <span className="text-black dark:text-white">
                                {formatWalletAddress(requestData.batchId ?? '-')}
                            </span>
                            <FaCopy className="text-[11px] text-black dark:text-white" />
                        </button>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">State</span>
                        <span
                            className={`px-2 py-0.5 text-xs rounded-full ${status ? getBatchStatusBadgeClass(status.status) : 'bg-slate-200 dark:bg-darkline text-black dark:text-white'}`}>
                            {status ? statusLabel(status.status) : 'Unknown'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Chain</span>
                        <span>{chainName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Atomic</span>
                        <span>{status ? (status.atomic ? 'Yes' : 'No') : '-'}</span>
                    </div>
                </div>

                {receipts.length > 0 ? (
                    <div className="border border-slate-200 dark:border-darkline rounded-md p-4 mb-5">
                        <div className="text-sm font-medium mb-2">Transactions</div>
                        <div className="space-y-2">
                            {receipts.map((receipt, index) => (
                                <div
                                    key={`${receipt.transactionHash}-${index}`}
                                    className="text-xs border border-slate-200 dark:border-darkline rounded p-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-black dark:text-white">
                                            #{index + 1}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 text-[10px] rounded-full ${getReceiptStatusBadgeClass(receipt.status)}`}>
                                            {receiptStatusLabel(receipt.status)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between mt-2">
                                        <span className="text-gray-500">Transaction Hash</span>
                                        <button
                                            className="flex items-center justify-between gap-2 text-primary hover:opacity-80"
                                            onClick={e => {
                                                e.preventDefault();
                                                openTxInExplorer(receipt.transactionHash);
                                            }}>
                                            {formatAddress(receipt.transactionHash)}
                                            <FaExternalLinkAlt className="shrink-0 text-[10px]" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="px-5 pb-5 pt-2 shrink-0">
                <button
                    className="btn btn-primary w-full"
                    onClick={e => {
                        e.preventDefault();
                        onClosePress();
                    }}>
                    Close
                </button>
            </div>
        </div>
    );
});
