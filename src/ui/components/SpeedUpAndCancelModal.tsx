import { TransactionResponse } from 'ethers';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toHex } from 'viem';
import { getErrorMessage } from '../../api/graphQL/BaseRequest';
import { GasPriceType } from '../../shared/types/Chain';
import { TransactionParams } from '../../shared/types/Transaction';
import { GasInfo, GasType, HandledGasData, PendingTransaction } from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import {
    cancelTransaction,
    estimateGas,
    getTransaction,
    speedUpTransaction,
    updatePendingTransaction,
} from '../../store/actions/uiActions';
import { useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import GasFee from './GasFee';
import Header from './Header';
import Modal from './Modal';
import Toast from './Toast';

export interface SpeedUpAndCancelTxData {
    visible: boolean;
    data?: PendingTransaction;
    type?: 'cancel' | 'speedup';
    onStart?: () => void;
    onEnd?: (newTxt?: PendingTransaction) => void;
}

interface Props extends SpeedUpAndCancelTxData {
    onCloseRequest: () => void;
}

const GAS_MULTIPLIER = 1.1;

const increaseGasFee = (gas: bigint, multiplier: number = GAS_MULTIPLIER) => {
    return (gas * BigInt(multiplier * 10)) / 10n;
};

const SpeedUpAndCancelModal = React.memo<Props>((props: Props) => {
    const { visible, onCloseRequest, data, type, onEnd, onStart } = props;
    const dispatch = useAppDispatch();

    const selectedNetwork = useSelectedNetwork();

    const [gasLimit, setGasLimit] = useState(21000);
    const [loadingGasLimit, setLoadingGasLimit] = useState(false);
    const [gasInfo, setGasInfo] = useState<GasInfo | undefined>(undefined);
    const [handledGasFee, setHandledGasFee] = useState(0n);
    const [handledGasInfo, setHandledGasInfo] = useState<GasInfo | undefined>(undefined);
    const [tx, setTx] = useState<TransactionResponse | null>(null);

    const title = useMemo(() => {
        switch (type) {
            case 'cancel':
                return 'Cancel Transaction';

            default:
                return 'Speed Up Transaction';
        }
    }, [type]);

    const description = useMemo(() => {
        switch (type) {
            case 'cancel':
                return 'This will attempt to cancel your pending transaction. It requires broadcasting another transaction!';

            default:
                return 'This will speed up your pending transaction by replacing it. There’s still a chance your original transaction will confirm first!';
        }
    }, [type]);

    const buttonTitle = useMemo(() => {
        switch (type) {
            case 'cancel':
                return 'Cancel Transaction';

            default:
                return 'Speed Up';
        }
    }, [type]);

    const estimateGasForTransaction = useCallback(
        async (txKind: 'cancel' | 'speedup', transaction: TransactionResponse): Promise<number> => {
            if (!transaction || !data) {
                throw new Error('Transaction and data are required');
            }

            const txPayload: TransactionParams =
                txKind === 'speedup'
                    ? {
                          from: data.sender,
                          data: transaction.data,
                          nonce: transaction.nonce + '',
                          to: transaction.to ?? undefined,
                          value: toHex(transaction.value.toString()),
                      }
                    : {
                          from: data.sender,
                          nonce: transaction.nonce + '',
                          to: data.receiver,
                      };

            const estimatedGasLimit = await estimateGas(txPayload);

            if (!estimatedGasLimit) {
                throw new Error('Failed to estimate gas');
            }

            return Number(estimatedGasLimit);
        },
        [data],
    );

    const performReplaceTx = useCallback(
        async (kind: 'cancel' | 'speedup') => {
            if (tx && handledGasInfo && data) {
                let _gasLimit = gasLimit;

                const onSuccessTxt = (_hash: string) => {
                    const base: PendingTransaction = {
                        ...data,
                        gasInfo: handledGasInfo,
                        txHash: _hash,
                    };
                    const _newTxt: PendingTransaction =
                        kind === 'cancel' ? { ...base, cancelling: true } : base;

                    onEnd && onEnd(_newTxt);

                    dispatch(updatePendingTransaction(data.network.platform_id, _newTxt));

                    Toast.showSuccess(
                        kind === 'cancel'
                            ? 'Cancel Transaction succeeded.'
                            : 'Speed Up Transaction succeeded.',
                    );

                    onCloseRequest();
                };

                onStart && onStart();

                // Update gasLimit in transaction if we re-estimated
                const txWithUpdatedGas =
                    _gasLimit !== gasLimit
                        ? ({ ...tx, gasLimit: BigInt(_gasLimit) } as TransactionResponse)
                        : tx;

                const task =
                    kind === 'cancel'
                        ? dispatch(cancelTransaction(data.sender, txWithUpdatedGas, handledGasInfo))
                        : dispatch(
                              speedUpTransaction(data.sender, txWithUpdatedGas, handledGasInfo),
                          );

                if (task) {
                    task.then(newTxt => {
                        if (newTxt) {
                            onSuccessTxt(newTxt.hash);
                        } else {
                            onEnd && onEnd();
                        }
                    }).catch(_error => {
                        onEnd && onEnd();
                        let message = '';

                        if (_error?.message?.includes('nonce has already been used')) {
                            message =
                                'The transaction was already confirmed or failed on the network before your request was processed.';
                        } else {
                            message = _error.reason ? _error.reason : 'Transaction failed.';
                        }

                        Toast.showError(message);
                    });
                } else {
                    onEnd && onEnd();
                }
            }
        },
        [
            data,
            dispatch,
            handledGasInfo,
            onCloseRequest,
            onEnd,
            onStart,
            tx,
            gasLimit,
            selectedNetwork.chain_id,
            estimateGasForTransaction,
        ],
    );

    const onCancelPress = useCallback(async () => {
        performReplaceTx('cancel');
    }, [performReplaceTx]);

    const onSpeedUpPress = useCallback(async () => {
        performReplaceTx('speedup');
    }, [performReplaceTx]);

    const onGasChange = useCallback((gasData: HandledGasData, gasFee: bigint) => {
        setGasInfo(gasData.gasInfo);
    }, []);

    useEffect(() => {
        if (!visible) {
            setTx(null);

            setHandledGasFee(0n);

            setGasInfo(undefined);
            setHandledGasInfo(undefined);
        }
    }, [visible]);

    useEffect(() => {
        if (tx && gasInfo && data) {
            const {
                priorityFee: _priorityFee = 0n,
                baseFee: _baseFee = 0n,
                gasPrice: _gasPrice = 0n,
            } = gasInfo;

            if (data.network.gasPriceType === GasPriceType.BaseAndPriority) {
                const txPriorityFee = tx.maxPriorityFeePerGas;
                const txMaxFeePerGas = tx.maxFeePerGas;

                if (txMaxFeePerGas && txPriorityFee) {
                    const txtBaseFee = txMaxFeePerGas - txPriorityFee;
                    const newPriorityFee = increaseGasFee(txPriorityFee);
                    const newBaseFee = increaseGasFee(txtBaseFee);

                    let maxPriorityFee = _priorityFee;
                    let maxBaseFee = _baseFee;

                    if (newPriorityFee > _priorityFee) {
                        maxPriorityFee = newPriorityFee;
                    }

                    if (newBaseFee > _baseFee) {
                        maxBaseFee = newBaseFee;
                    }

                    const newGasInfo: GasInfo = {
                        priorityFee: maxPriorityFee,
                        baseFee: maxBaseFee,
                        maxFeePerGas: maxPriorityFee + maxBaseFee,
                    };
                    setHandledGasFee((newGasInfo.maxFeePerGas ?? 0n) * BigInt(gasLimit));
                    setHandledGasInfo(newGasInfo);
                } else {
                    const newGasInfo: GasInfo = {
                        priorityFee: _priorityFee,
                        baseFee: _baseFee,
                        maxFeePerGas: _priorityFee + _baseFee,
                    };
                    setHandledGasFee((newGasInfo.maxFeePerGas ?? 0n) * BigInt(gasLimit));
                    setHandledGasInfo(newGasInfo);
                }
            } else {
                const txGasPrice = tx.gasPrice;

                if (txGasPrice) {
                    let newGasPrice = increaseGasFee(txGasPrice);

                    if (newGasPrice < _gasPrice) {
                        newGasPrice = _gasPrice;
                    }

                    const newGasInfo: GasInfo = {
                        gasPrice: newGasPrice,
                    };
                    setHandledGasFee((newGasInfo.gasPrice ?? 0n) * BigInt(gasLimit));
                    setHandledGasInfo(newGasInfo);
                    return;
                } else {
                    const newGasInfo: GasInfo = {
                        gasPrice: _gasPrice,
                    };
                    setHandledGasFee((newGasInfo.gasPrice ?? 0n) * BigInt(gasLimit));
                    setHandledGasInfo(newGasInfo);
                }
            }
        }
    }, [data, gasInfo, gasLimit, tx]);

    useEffect(() => {
        if (data && visible) {
            setLoadingGasLimit(true);
            getTransaction(data.txHash, selectedNetwork.chain_id)
                .then(fetchedTx => {
                    if (fetchedTx) {
                        setTx(fetchedTx);
                        const txKind: 'cancel' | 'speedup' =
                            type === 'speedup' ? 'speedup' : 'cancel';
                        estimateGasForTransaction(txKind, fetchedTx)
                            .then(rawGasLimit => {
                                setGasLimit(rawGasLimit);
                            })
                            .catch(() => {
                                logger.log('error estimating gas');
                            })
                            .finally(() => {
                                setLoadingGasLimit(false);
                            });
                    } else {
                        setGasLimit(21000);
                        setLoadingGasLimit(false);
                        setTx(null);
                    }
                })
                .catch(_error => {
                    logger.log('Pending txt ', _error);
                    setGasLimit(21000);
                    setLoadingGasLimit(false);
                    setTx(null);
                });
        }
    }, [
        data,
        selectedNetwork.chain_id,
        type,
        visible,
        estimateGasForTransaction,
    ]);

    return (
        <Modal visible={visible} onClose={onCloseRequest}>
            <Header title={title} hasBackButton={false} onClosePress={onCloseRequest} />

            <div className="max-h-[280px] overflow-auto p-5 text-sm">
                <div className="text-center mb-5">{description}</div>

                <GasFee
                    isLoading={loadingGasLimit}
                    customGasFee={handledGasFee}
                    customGasType={GasType.High}
                    gasLimit={gasLimit}
                    onGasChange={onGasChange}
                />
            </div>

            <div className="p-5 pt-0">
                <button
                    disabled={handledGasFee === 0n}
                    onClick={e => {
                        e.preventDefault();

                        if (type === 'cancel') {
                            onCancelPress();
                        } else {
                            onSpeedUpPress();
                        }
                    }}
                    className={'btn btn-primary w-full'}>
                    {buttonTitle}
                </button>
            </div>
        </Modal>
    );
});

export default SpeedUpAndCancelModal;
