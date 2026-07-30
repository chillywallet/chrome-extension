import { formatNumber } from '../../../shared/utils/format';
import { serializeError } from 'eth-rpc-errors';
import { formatEther } from 'ethers';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { getErrorMessage } from '../../../api/graphQL/BaseRequest';
import { ApprovalRequest } from '../../../controller/ApprovalController';
import {
    SendCallsCall,
    SendCallsParams,
    WalletSendCallsApprovalValue,
} from '../../../lib/eip5792/types';
import { ANIM_DURATION } from '../../../shared/constants/app';
import ErrorMessages from '../../../shared/messages/ErrorMessages';
import { Chain } from '../../../shared/types/Chain';
import { HandledGasData } from '../../../shared/types/Wallet';
import eventManager from '../../../shared/utils/eventManager';
import logger from '../../../shared/utils/logger';
import { smartTrim } from '../../../shared/utils/string';
import {
    checkContract,
    estimateWalletSendCallsGas,
    getNativeTokenBalance,
    rejectPendingApproval,
    resolvePendingApproval,
} from '../../../store/actions/uiActions';
import { getAllAccounts } from '../../../store/selectorUtils';
import {
    useCurrentAccountByAddress,
    useNativeCoinBalance,
    useSelectedNetwork,
    useSubjectMetadataByOrigin,
} from '../../../store/selectors';
import { useFirstWalletSendCallsApprovalRequest } from '../../../store/selectors/eip5792';
import { useAppDispatch } from '../../../store/store';
import ConfirmationHeader from '../../components/ConfirmationHeader';
import GasFee from '../../components/GasFee';
import Toast from '../../components/Toast';
import { useHardwareWalletSignModal } from '../../hooks/useHardwareWalletSignModal';
import { useDappInteractionData } from './DappInteractionProvider';

function getCallValue(call: SendCallsCall): bigint {
    try {
        return call.value ? BigInt(call.value) : 0n;
    } catch {
        return 0n;
    }
}

export default React.memo(() => {
    const dispatch = useAppDispatch();
    const selectedNetwork = useSelectedNetwork();
    const { waitingRef } = useDappInteractionData();
    const request = useFirstWalletSendCallsApprovalRequest();
    const [localRequest, setLocalRequest] = useState<ApprovalRequest<Record<string, any>> | null>(
        request,
    );
    const requestData = (localRequest?.requestData ?? {}) as {
        params?: SendCallsParams;
        from?: string;
        origin?: string;
    };


    const payload = requestData.params;
    const from = requestData.from ?? '';
    const origin = requestData.origin ?? localRequest?.origin ?? '';
    const subjectMetadata = useSubjectMetadataByOrigin(origin);
    const nativeBalance = useNativeCoinBalance(from);
    const { account, isSmartWallet } = useCurrentAccountByAddress(from);
    const accounts = useMemo(() => getAllAccounts(), []);

    const [gasLimit, setGasLimit] = useState(0);
    const [loadingGasLimit, setLoadingGasLimit] = useState(false);
    const [gasData, setGasData] = useState<HandledGasData | undefined>(undefined);
    const [localError, setLocalError] = useState('');
    const [remoteError, setRemoteError] = useState('');
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [delegationNoticeExpanded, setDelegationNoticeExpanded] = useState(false);
    const [isContractAccount, setIsContractAccount] = useState<boolean | null>(null);
    const [reserveBalanceRequired, setReserveBalanceRequired] = useState<bigint>(0n);

    const calls = useMemo(() => payload?.calls ?? [], [payload?.calls]);
    const shownCalls = calls.slice(0, 5);
    const remainingCalls = Math.max(0, calls.length - shownCalls.length);
    const isAtomicRequired = payload?.atomicRequired === true;
    const needsDelegation = isAtomicRequired && !isSmartWallet && isContractAccount === false;

    const confirmCalls = useMemo(() => {
        return calls.map(call => ({
            to: call.to ?? '',
            data: call.data ?? '0x',
            value: call.value ? String(BigInt(call.value)) : '0',
        }));
    }, [calls]);

    const accountNameByAddress = useMemo(() => {
        const map = new Map<string, string>();
        for (const walletAccount of accounts) {
            const accountName = walletAccount.metadata?.name;
            if (!accountName) {
                continue;
            }
            if (walletAccount.address) {
                map.set(walletAccount.address.toLowerCase(), accountName);
            }
            if (walletAccount.smartAddress) {
                map.set(walletAccount.smartAddress.toLowerCase(), accountName);
            }
        }
        return map;
    }, [accounts]);

    const totalCallValue = useMemo(() => {
        return calls.reduce((acc, call) => acc + getCallValue(call), 0n);
    }, [calls]);

    const gasFee = useMemo(() => {
        if (!gasData?.gasPrice || gasLimit <= 0) {
            return 0n;
        }
        return gasData.gasPrice * BigInt(gasLimit);
    }, [gasData, gasLimit]);

    const displayError = useMemo(() => {
        return localError ? localError : remoteError ? remoteError : '';
    }, [localError, remoteError]);

    const onGasChange = useCallback((handled: HandledGasData) => {
        setGasData(handled);
    }, []);

    const onRejectPress = useCallback(async () => {
        if (!localRequest || waitingRef?.current) {
            return;
        }

        eventManager.setTxConfirmationHandling(true);
        try {
            await dispatch(
                rejectPendingApproval(
                    localRequest.id,
                    serializeError({
                        code: 4001,
                        message: 'User rejected the request.',
                    }),
                ),
            );
            Toast.showSuccess('Rejected request');
            if (waitingRef?.current !== undefined) {
                waitingRef.current = 'ignore';
            }
        } catch (rejectError: any) {
            Toast.showError(rejectError?.message ?? 'Failed to reject request');
        } finally {
            eventManager.setTxConfirmationHandling(false);
        }
    }, [dispatch, localRequest, waitingRef]);

    const onConfirmPress = useCallback(async () => {
        if (!localRequest || waitingRef?.current || !gasData || !payload || !from) {
            return;
        }

        let _gasLimit = gasLimit;

        eventManager.setTxConfirmationHandling(true);
        try {
            const value: WalletSendCallsApprovalValue = {
                gasInfo: gasData.gasInfo,
                gasLimit: _gasLimit,
            };
            await dispatch(resolvePendingApproval(localRequest.id, value, { waitForResult: true }));
            Toast.showSuccess('Confirmed request');
        } catch (confirmError: any) {
            Toast.showError(confirmError?.message ?? 'Failed to confirm request');
        } finally {
            eventManager.setTxConfirmationHandling(false);
        }
    }, [
        dispatch,
        from,
        gasData,
        gasLimit,
        localRequest,
        payload,
        selectedNetwork.chain_id,
        waitingRef,
    ]);

    useEffect(() => {
        if (request) {
            setLocalRequest(request);
        }
    }, [request]);

    useEffect(() => {
        if (!payload || !from) {
            setGasLimit(0);
            setRemoteError('');
            return;
        }

        setRemoteError('');
        setLoadingGasLimit(true);
        estimateWalletSendCallsGas(payload, from)
            .then(estimated => {
                logger.log('🏄🏽‍♂️ Estimated Gas', estimated);
                setGasLimit(estimated);
                setRemoteError('');
            })
            .catch(gasError => {
                const message = getErrorMessage(gasError) || 'Failed to estimate gas';
                setRemoteError(message);
            })
            .finally(() => {
                setLoadingGasLimit(false);
            });
    }, [payload, from]);

    useEffect(() => {
        if (!from) {
            return;
        }
        dispatch(getNativeTokenBalance(from, selectedNetwork.chain_id));
    }, [dispatch, from, selectedNetwork.chain_id]);

    useEffect(() => {
        if (!from || isSmartWallet) {
            setIsContractAccount(null);
            return;
        }

        checkContract(from)
            .then(isContract => {
                setIsContractAccount(isContract);
            })
            .catch(() => {
                setIsContractAccount(null);
            });
    }, [from, isSmartWallet]);

    useEffect(() => {
        if (!isAtomicRequired) {
            setReserveBalanceRequired(0n);
            return;
        }

        setReserveBalanceRequired(0n);
    }, [isAtomicRequired, selectedNetwork.chain_id, selectedNetwork.chain_key]);

    useEffect(() => {
        if (!payload) {
            return;
        }

        if (calls.length === 0) {
            setLocalError('Invalid or empty batch.');
            return;
        }

        if (isSmartWallet) {
            setLocalError('Smart Wallet does not support wallet_sendCalls batch');
            return;
        }

        if (totalCallValue > nativeBalance) {
            setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT);
            return;
        }

        if (gasFee > 0n && totalCallValue + gasFee > nativeBalance) {
            setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS);
            return;
        }

        if (payload?.atomicRequired) {
            const reserveText = formatNumber(parseFloat(formatEther(reserveBalanceRequired)));
            const errorMessage = `Insufficient balance for EIP-7702 delegation reserve. Keep at least ${reserveText} ${selectedNetwork.native_coin_symbol} after this transaction.`;

            if (
                needsDelegation &&
                reserveBalanceRequired > 0n &&
                totalCallValue + gasFee + reserveBalanceRequired > nativeBalance
            ) {
                setLocalError(errorMessage);
                return;
            }
        }

        setLocalError('');
    }, [
        calls.length,
        gasFee,
        isSmartWallet,
        nativeBalance,
        needsDelegation,
        payload,
        reserveBalanceRequired,
        selectedNetwork.native_coin_symbol,
        totalCallValue,
    ]);

    const canConfirm = !!localRequest && !loadingGasLimit && !displayError;

    const { wrapSubmit, hardwareModal } = useHardwareWalletSignModal(
        account?.metadata.keyring.type,
    );

    return (
        <>
            <div
                id="scrollable"
                className="flex flex-col h-[calc(100vh-124px)] sm:h-[calc(100vh-40px-124px)] overflow-x-hidden overflow-y-auto">
                <ConfirmationHeader
                    className="mb-3"
                    from={{
                        name: account?.metadata?.name ?? 'Wallet',
                        address: from,
                        emoji: account?.metadata?.avatar ?? null,
                    }}
                />

                <div className="px-5">
                    <div className="flex flex-col">
                        <div className="text-sm mb-2">{subjectMetadata?.origin ?? origin}</div>

                        <div className="flex flex-row items-center justify-between mb-3">
                            <div className="text-xs border rounded-md px-2 py-1 mr-3">
                                <span className="text-primary mr-1">
                                    {calls.length} call{calls.length !== 1 ? 's' : ''}:
                                </span>
                                Batch Transaction
                            </div>
                        </div>

                        {needsDelegation ? (
                            <div className="text-xs border border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-md mb-2 overflow-hidden">
                                <button
                                    type="button"
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                                    aria-expanded={delegationNoticeExpanded}
                                    onClick={() => setDelegationNoticeExpanded(prev => !prev)}>
                                    <span className="font-medium text-amber-700 dark:text-amber-300 pr-2">
                                        EIP-7702 setup required
                                    </span>
                                    <motion.span
                                        className="shrink-0 text-amber-700 dark:text-amber-300 inline-flex"
                                        animate={{ rotate: delegationNoticeExpanded ? 180 : 0 }}
                                        transition={{
                                            duration: ANIM_DURATION,
                                            ease: [0.4, 0, 0.2, 1],
                                        }}>
                                        <FaChevronDown className="text-sm" aria-hidden />
                                    </motion.span>
                                </button>
                                <AnimatePresence initial={false}>
                                    {delegationNoticeExpanded ? (
                                        <motion.div
                                            key="delegation-notice-body"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{
                                                duration: ANIM_DURATION,
                                                ease: [0.4, 0, 0.2, 1],
                                            }}
                                            className="overflow-hidden">
                                            <div className="px-3 pb-3 pt-0 text-amber-700/90 dark:text-amber-200/90">
                                                Your wallet needs a one-time setup before atomic
                                                batch transactions can run. We’ll enable EIP-7702
                                                for this wallet first, then execute the batch.
                                            </div>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </div>
                        ) : null}
                    </div>
                </div>

                <Tabs
                    selectedTabClassName="tab-selected-tab-class-name-compact"
                    selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                    className="tab-class-name">
                    <TabList className="tab-tablist !bg-transparent">
                        <Tab className="tab-tablist-tab-compact ml-5">DETAILS</Tab>
                    </TabList>

                    <TabPanel>
                        <div className="px-5 py-4">
                            <div className="border border-slate-200 dark:border-darkline rounded-md divide-y divide-slate-200 dark:divide-darkline mb-3">
                                {[...shownCalls].map((call, index) => {
                                    const isOpen = expanded[index] ?? false;
                                    const toAddress = call.to ?? '';
                                    const toAddressLabel = toAddress
                                        ? smartTrim(toAddress, 14)
                                        : '-';
                                    const toName = toAddress
                                        ? accountNameByAddress.get(toAddress.toLowerCase())
                                        : undefined;
                                    const toNameLabel = toName ? smartTrim(toName, 12) : undefined;
                                    const toLabel = toName
                                        ? `${toNameLabel} (${toAddressLabel})`
                                        : toAddressLabel;
                                    return (
                                        <div key={`send-call-${index}`} className="p-3">
                                            <div className="flex items-center justify-between mb-2 gap-2">
                                                <div className="text-sm font-medium">
                                                    Call #{index + 1}
                                                </div>
                                                <button
                                                    type="button"
                                                    className="text-xs text-primary flex items-center gap-1 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                                                    aria-expanded={isOpen}
                                                    aria-controls={`send-call-data-${index}`}
                                                    onClick={() =>
                                                        setExpanded(prev => ({
                                                            ...prev,
                                                            [index]: !isOpen,
                                                        }))
                                                    }>
                                                    <span>
                                                        {isOpen ? 'Hide data' : 'Show data'}
                                                    </span>
                                                    <motion.span
                                                        className="inline-flex"
                                                        animate={{ rotate: isOpen ? 180 : 0 }}
                                                        transition={{
                                                            duration: ANIM_DURATION,
                                                            ease: [0.4, 0, 0.2, 1],
                                                        }}>
                                                        <FaChevronDown
                                                            className="text-[0.65rem]"
                                                            aria-hidden
                                                        />
                                                    </motion.span>
                                                </button>
                                            </div>
                                            <div className="text-xs mb-1">
                                                <span className="text-gray-500 mr-2">To:</span>
                                                <span>{toLabel}</span>
                                            </div>
                                            <div className="text-xs mb-1">
                                                <span className="text-gray-500 mr-2">Value:</span>
                                                <span>
                                                    {formatNumber(
                                                        parseFloat(formatEther(getCallValue(call))),
                                                    )}{' '}
                                                    {selectedNetwork.native_coin_symbol}
                                                </span>
                                            </div>
                                            <AnimatePresence initial={false}>
                                                {isOpen ? (
                                                    <motion.div
                                                        id={`send-call-data-${index}`}
                                                        key={`call-data-${index}`}
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{
                                                            duration: ANIM_DURATION,
                                                            ease: [0.4, 0, 0.2, 1],
                                                        }}
                                                        className="overflow-hidden">
                                                        <div className="text-xs mt-2 p-2 bg-slate-50 dark:bg-darkline rounded break-all">
                                                            {call.data ?? '0x'}
                                                        </div>
                                                    </motion.div>
                                                ) : null}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>

                            {remainingCalls > 0 ? (
                                <div className="text-xs text-center text-gray-500 -mt-1 mb-3">
                                    +{remainingCalls} more call(s)
                                </div>
                            ) : null}

                            <GasFee
                                isLoading={loadingGasLimit}
                                gasLimit={gasLimit}
                                onGasChange={onGasChange}
                                calls={confirmCalls}
                            />
                        </div>
                    </TabPanel>
                </Tabs>

                {displayError ? (
                    <p className="text-sm text-red-500 px-5 pb-5 break-words text-center">
                        {displayError}
                    </p>
                ) : null}
            </div>

            <div className="px-5 pb-8">
                <button
                    disabled={!canConfirm}
                    className="btn btn-primary w-full mb-3"
                    onClick={e => {
                        e.preventDefault();
                        void wrapSubmit(() => onConfirmPress());
                    }}>
                    {needsDelegation ? 'Setup & Confirm' : 'Confirm'}
                </button>
                <button
                    className="btn w-full"
                    onClick={e => {
                        e.preventDefault();
                        onRejectPress();
                    }}>
                    Reject
                </button>
            </div>
            {hardwareModal}
        </>
    );
});
