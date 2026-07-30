import { ethErrors, serializeError } from 'eth-rpc-errors';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { chromeDark, chromeLight, ObjectInspector } from 'react-inspector';
import { hexToText } from '../../../lib/WalletUtils';
import eventManager from '../../../shared/utils/eventManager';
import { rejectPendingApproval, resolvePendingApproval } from '../../../store/actions/uiActions';
import {
    useActualTheme,
    useCurrentAccountByAddress,
    useFirstUnapprovedMessage,
    useSubjectMetadataByOrigin,
} from '../../../store/selectors';
import { useAppDispatch } from '../../../store/store';
import AccountView from '../../components/AccountView';
import SafeImage from '../../components/SafeImage';
import Toast from '../../components/Toast';
import { useHardwareWalletSignModal } from '../../hooks/useHardwareWalletSignModal';
import { useDappInteractionData } from './DappInteractionProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const { waitingRef } = useDappInteractionData();
    const dispatch = useAppDispatch();
    const firstRequest = useFirstUnapprovedMessage();
    const activeTheme = useActualTheme();

    const [currentRequest, setCurrentRequest] = useState(firstRequest);

    const walletAddress = useMemo(() => {
        return currentRequest?.msgParams?.from ?? '';
    }, [currentRequest]);

    const { account: currentAccount, isSmartWallet } = useCurrentAccountByAddress(walletAddress);

    const theme = useMemo(() => {
        return activeTheme === 'dark'
            ? { ...chromeDark, ...{ OBJECT_VALUE_STRING_COLOR: '#2ecc71' } }
            : { ...chromeLight, ...{ OBJECT_VALUE_STRING_COLOR: '#27ae60' } };
    }, [activeTheme]);

    const origin = useMemo(() => {
        return currentRequest?.msgParams?.origin ?? '';
    }, [currentRequest?.msgParams?.origin]);

    const subjectMetadata = useSubjectMetadataByOrigin(origin);

    const message = useMemo(() => {
        //@ts-ignore
        const _msg: string = currentRequest?.msgParams?.data ?? '';

        if (currentRequest?.type === 'personal_sign') {
            return hexToText(_msg);
        }

        return _msg;
    }, [currentRequest]);

    const messageJson = useMemo(() => {
        //check if message is string
        if (typeof message === 'string') {
            try {
                //check if valid json
                return JSON.parse(message);
            } catch (error) {
                //do nothing
            }
        }
        return message;
    }, [message]);

    const { wrapSubmit, hardwareModal } = useHardwareWalletSignModal(
        currentAccount?.metadata.keyring.type,
        { signingContext: 'message' },
    );

    const onSignPress = useCallback(async () => {
        if (!currentRequest || waitingRef?.current) {
            return;
        }

        eventManager.setTxConfirmationHandling(true);

        try {
            await dispatch(
                resolvePendingApproval(currentRequest.id, undefined, { waitForResult: true }),
            );
            Toast.showSuccess('Sign request succeeded');
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }

        eventManager.setTxConfirmationHandling(false);
    }, [currentRequest, waitingRef, dispatch]);

    const onRejectPress = useCallback(async () => {
        if (!currentRequest || waitingRef?.current) {
            return;
        }

        eventManager.setTxConfirmationHandling(true);

        try {
            await dispatch(
                rejectPendingApproval(
                    currentRequest.id,
                    serializeError(ethErrors.provider.userRejectedRequest()),
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
    }, [currentRequest, dispatch, waitingRef]);

    useEffect(() => {
        if (firstRequest) {
            setCurrentRequest(firstRequest);
        }
    }, [firstRequest]);

    return (
        <div className="flex flex-col h-full p-5">
            <AccountView account={currentAccount} isSmartWallet={isSmartWallet} className="mb-5" />

            <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden">
                <div className="flex flex-row items-center border rounded-full px-3 py-1 mb-5 overflow-hidden">
                    <SafeImage
                        src={subjectMetadata?.iconUrl ?? null}
                        alt={'Subject logo'}
                        className="w-6 h-6 object-contain rounded-md mr-2"
                    />

                    <div className="text-sm text-center">{origin}</div>
                </div>

                <div className="text-xl text-center mb-3">Signature Request</div>

                <div className="text-sm text-center mb-3">
                    Only sign this message if you fully understand the content and trust the
                    requesting site.
                </div>

                <div className="min-h-0 w-full flex-1 overflow-auto p-2 bg-white dark:bg-[#242424] border border-slate-200 dark:border-darkline rounded-lg text-sm">
                    <ObjectInspector
                        // @ts-ignore
                        theme={theme}
                        data={messageJson}
                        expandLevel={1}
                        name="message"
                    />
                </div>
            </div>

            <div className="mt-3 shrink-0">
                <button
                    className="btn btn-primary w-full mb-3"
                    onClick={e => {
                        e.preventDefault();
                        void wrapSubmit(() => onSignPress());
                    }}>
                    Sign
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
        </div>
    );
});
