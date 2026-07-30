import { ethErrors } from 'eth-rpc-errors';
import React, { useCallback, useEffect, useState } from 'react';
import { FaArrowRight } from 'react-icons/fa';
import { ChainData } from '../../../shared/types/Chain';
import eventManager from '../../../shared/utils/eventManager';
import { rejectPendingApproval, resolvePendingApproval } from '../../../store/actions/uiActions';
import { useSelectedNetwork } from '../../../store/selectors';
import { useFirstUnapprovedNetworkRequest } from '../../../store/selectors/network';
import { useAppDispatch } from '../../../store/store';
import SafeImage from '../../components/SafeImage';
import Toast from '../../components/Toast';
import { useDappInteractionData } from './DappInteractionProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const { waitingRef } = useDappInteractionData();
    const dispatch = useAppDispatch();
    const selectedNetwork = useSelectedNetwork();
    const request = useFirstUnapprovedNetworkRequest();

    const [{ newNetwork, currentNetwork }, setNewNetwork] = useState<{
        currentNetwork: ChainData;
        newNetwork: ChainData | undefined;
    }>({ newNetwork: request?.requestData?.chain, currentNetwork: selectedNetwork });

    const onAcceptPress = useCallback(async () => {
        if (!request || waitingRef?.current) {
            return;
        }

        eventManager.setTxConfirmationHandling(true);

        try {
            await dispatch(resolvePendingApproval(request.id));
            Toast.showSuccess('Change network succeeded');
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }

        eventManager.setTxConfirmationHandling(false);
    }, [dispatch, request, waitingRef]);

    const onRejectPress = useCallback(async () => {
        if (!request || waitingRef?.current) {
            return;
        }

        eventManager.setTxConfirmationHandling(true);

        try {
            await dispatch(
                rejectPendingApproval(
                    request.id,
                    ethErrors.provider.userRejectedRequest().serialize(),
                ),
            );
            Toast.showSuccess('Reject request succeeded');

            if (waitingRef?.current !== undefined) {
                waitingRef.current = 'ignore';
            }
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }

        eventManager.setTxConfirmationHandling(false);
    }, [dispatch, request, waitingRef]);

    useEffect(() => {
        if (request?.requestData?.chain) {
            setNewNetwork({
                newNetwork: request?.requestData?.chain,
                currentNetwork: selectedNetwork,
            });
        }
    }, [request, selectedNetwork]);

    return (
        <div className="flex flex-col h-full p-5 overflow-y-auto">
            <div className="flex-1">
                <div className="text-center text-xl font-semibold mb-3">
                    Do you allow this site to change the network?
                </div>
                <div className="text-center mb-10 text-sm">
                    This will change the selected network within{' '}
                    <span className="text-primary">Chilly</span> to a new network:
                </div>

                <div className="grid grid-cols-12 gap-3 mb-10">
                    <div className="col-span-5 flex flex-col items-center">
                        <SafeImage
                            src={currentNetwork.icon}
                            className="w-12 h-12 rounded-full"
                            alt={currentNetwork.name}
                        />
                        <div className="mt-2 text-sm text-center">{currentNetwork.name}</div>
                    </div>

                    <div className="col-span-2 flex flex-col items-center pt-5">
                        <FaArrowRight className="text-2xl" />
                    </div>

                    {newNetwork ? (
                        <div className="col-span-5 flex flex-col items-center">
                            <SafeImage
                                src={newNetwork.icon}
                                className="w-12 h-12 rounded-full"
                                alt={newNetwork.name}
                            />
                            <div className="mt-2 text-sm text-center">{newNetwork.name}</div>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="mt-3">
                <button
                    className="btn btn-primary w-full mb-3"
                    onClick={e => {
                        e.preventDefault();
                        onAcceptPress();
                    }}>
                    Change Network
                </button>
                <button
                    className="btn w-full"
                    onClick={e => {
                        e.preventDefault();
                        onRejectPress();
                    }}>
                    Cancel
                </button>
            </div>
        </div>
    );
});
