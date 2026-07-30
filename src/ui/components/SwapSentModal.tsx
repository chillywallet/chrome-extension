import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ChainData } from '../../shared/types/Chain';
import { PendingTransaction, TxtStatus } from '../../shared/types/Wallet';
import { Images } from '../../shared/utils/Images';
import logger from '../../shared/utils/logger';
import { updatePendingTransactionStatus } from '../../store/actions/uiActions';
import { useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import Modal from './Modal';
import PendingTxtMenu from './PendingTxtMenu';

type Props = {
    visible: boolean;
    onCloseRequest: () => void;
    onTryAgainPress?: () => void;
    txtData?: PendingTransaction;
    setTxtData: (data: PendingTransaction) => void;
    onMenuPress?: (item: PendingTransaction, type: 'cancel' | 'speedup') => void;
    onSwapSuccess: (trackData: any, cancelled: boolean) => void;
    network?: ChainData;
    successText?: string;
};

export default React.memo<Props>((props: Props) => {
    const {
        visible,
        txtData,
        onCloseRequest,
        onMenuPress,
        onSwapSuccess,
        setTxtData,
        onTryAgainPress,
        network,
        successText,
    } = props;
    const dispatch = useAppDispatch();
    const txtHashRef = useRef(txtData?.txHash ?? '');
    const isVisibleRef = useRef(visible);

    const defaultSelectedNetwork = useSelectedNetwork();
    const selectedNetwork = useMemo(() => {
        if (network) {
            return network;
        }
        return defaultSelectedNetwork;
    }, [defaultSelectedNetwork, network]);

    const txtStatus = useMemo(() => {
        switch (txtData?.status) {
            case 'sent':
                return !txtData?.cancelling ? 'Success' : 'Cancelled';

            case 'failed':
                return 'Failed';

            default:
                return 'Pending';
        }
    }, [txtData]);

    const buttonTitle = useMemo(() => {
        if (selectedNetwork) {
            return `View on ${selectedNetwork.explorer_name}`;
        }

        return '';
    }, [selectedNetwork]);

    const onViewPress = useCallback(() => {
        if (selectedNetwork && txtData) {
            global.platform.openLink(
                `${selectedNetwork.explorer_url}/tx/${txtData.txHash}`,
                '_blank',
            );
        }
    }, [txtData, selectedNetwork]);

    const updateTxtStatus = useCallback(
        (_status: TxtStatus) => {
            if (txtData && txtHashRef.current === txtData.txHash) {
                const _txtData = { ...txtData, status: _status };
                setTxtData(_txtData);

                switch (_status) {
                    case 'failed':
                        logger.log('Swap Failed', txtData);
                        break;

                    case 'sent':
                        const cancelled = !!txtData?.cancelling;
                        onSwapSuccess(txtData.trackData, cancelled);
                        break;
                }
            }
        },
        [txtData, setTxtData, onSwapSuccess],
    );

    useEffect(() => {
        if (txtData?.txHash && (!txtData.status || txtData.status === 'sending')) {
            txtHashRef.current = txtData.txHash;

            const updateStatus = () => {
                dispatch(
                    updatePendingTransactionStatus(selectedNetwork.platform_id, txtData),
                ).then((status: TxtStatus) => {
                    updateTxtStatus(status);

                    if (status === 'sending' && isVisibleRef.current) {
                        updateStatus();
                    }
                });
            };

            updateStatus();
        } else {
            txtHashRef.current = '';
        }
    }, [txtData, updateTxtStatus, dispatch, selectedNetwork]);

    useEffect(() => {
        isVisibleRef.current = visible;
    }, [visible]);

    return (
        <Modal
            visible={visible}
            onClose={() => {
                onCloseRequest();
            }}>
            <div className="p-4 relative">
                {txtData && onMenuPress ? (
                    <div className="absolute top-3 right-3">
                        <PendingTxtMenu
                            data={txtData}
                            deletable={false}
                            onMenuPress={onMenuPress}
                        />
                    </div>
                ) : null}

                <div className="flex flex-col items-center">
                    <img
                        src={txtStatus === 'Failed' ? Images.iconError : Images.iconSuccess}
                        className="w-20 h-20 mb-3"
                        alt="Success"
                    />
                    <div className="text-center text-md font-semibold">Transaction Sent</div>
                    {successText && txtStatus === 'Success' ? (
                        <div className="text-center text-sm text-gray-500">{successText}</div>
                    ) : null}
                    <div className="flex flex-row items-center justify-center gap-2 mb-4">
                        <div className="text-xs">{'Status:  '}</div>
                        <div
                            className={
                                'text-xs font-semibold ' +
                                (txtStatus === 'Failed'
                                    ? 'text-red-500'
                                    : txtStatus === 'Pending'
                                      ? 'text-yellow-500'
                                      : 'text-green-500')
                            }>
                            {txtStatus}
                        </div>
                    </div>
                </div>

                <div className="mb-3">
                    {selectedNetwork?.explorer_url ? (
                        <button className="btn btn-primary w-full" onClick={onViewPress}>
                            {buttonTitle}
                        </button>
                    ) : null}
                    {txtStatus === 'Failed' && onTryAgainPress && (
                        <button className="btn w-full mt-3" onClick={onTryAgainPress}>
                            Try Again
                        </button>
                    )}
                </div>

                <button
                    className="btn w-full"
                    onClick={e => {
                        e.preventDefault();
                        onCloseRequest();
                    }}>
                    Close
                </button>
            </div>
        </Modal>
    );
});
