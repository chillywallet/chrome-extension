import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IoWallet } from 'react-icons/io5';
import { ChillyAccount } from '../../../shared/types/Wallet';
import eventManager from '../../../shared/utils/eventManager';
import {
    approvePermissionsRequest,
    rejectPermissionsRequest,
} from '../../../store/actions/uiActions';
import {
    useCurrentAccount,
    useFirstPermissionRequest,
    useSubjectMetadataByOrigin,
} from '../../../store/selectors';
import { useAppDispatch } from '../../../store/store';
import AccountSelectModal from '../../components/AccountSelectModal';
import AccountView from '../../components/AccountView';
import SafeImage from '../../components/SafeImage';
import Toast from '../../components/Toast';
import { useDappInteractionData } from './DappInteractionProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const { waitingRef } = useDappInteractionData();
    const dispatch = useAppDispatch();
    const firstRequest = useFirstPermissionRequest();
    const currentAccount = useCurrentAccount();

    const [isShowAccountMenu, setIsShowAccountMenu] = useState(false);
    const [currentRequest, setCurrentRequest] = useState(firstRequest);
    const [selectedAccounts, setSelectedAccounts] = useState<ChillyAccount[]>([]);

    const subjectMetadata = useSubjectMetadataByOrigin(currentRequest?.metadata?.origin);

    const { name, url, image } = useMemo(() => {
        if (!currentRequest) {
            return {
                name: '',
                url: '',
                image: '',
            };
        }

        const origin = currentRequest.metadata?.origin;
        return {
            name: subjectMetadata?.name ?? 'Unknown',
            url: origin ?? 'Unknown',
            image: subjectMetadata?.iconUrl ?? null,
        };
    }, [currentRequest, subjectMetadata]);

    const onAcceptPress = useCallback(async () => {
        if (
            selectedAccounts.length === 0 ||
            !currentRequest ||
            !currentAccount ||
            waitingRef?.current
        ) {
            return;
        }

        eventManager.setTxConfirmationHandling(true);

        try {
            let approvedAccounts = selectedAccounts.map(account => account.address);

            if (approvedAccounts.includes(currentAccount.address)) {
                approvedAccounts = [
                    currentAccount.address,
                    ...(approvedAccounts.filter(account => account !== currentAccount.address) ||
                        []),
                ];
            }

            const approvedRequest = {
                ...currentRequest,
                permissions: { ...currentRequest.permissions },
                approvedAccounts: approvedAccounts,
            };

            //@ts-ignore
            await dispatch(approvePermissionsRequest(approvedRequest));
            Toast.showSuccess('Approve request succeeded');
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }

        eventManager.setTxConfirmationHandling(false);
    }, [currentRequest, selectedAccounts, currentAccount, dispatch, waitingRef]);

    const onRejectPress = useCallback(async () => {
        if (!currentRequest?.metadata?.id || waitingRef?.current) {
            return;
        }

        eventManager.setTxConfirmationHandling(true);

        try {
            await dispatch(rejectPermissionsRequest(currentRequest.metadata.id));
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
    }, [dispatch, currentRequest, waitingRef]);

    const onAccountPress = useCallback(() => {
        setIsShowAccountMenu(true);
    }, []);

    useEffect(() => {
        if (firstRequest) {
            setCurrentRequest(firstRequest);
        }
    }, [firstRequest]);

    useEffect(() => {
        if (currentAccount) {
            setSelectedAccounts([currentAccount]);
        }
    }, [currentAccount]);

    return (
        <div className="flex flex-col h-full p-5 overflow-y-auto">
            <div className="flex flex-col flex-1 items-center">
                <SafeImage src={image} alt={name} className="w-14 h-14 mb-3" />

                <div className="text-lg font-semibold text-center mb-5">{url}</div>

                <div className="text-xl text-center mb-5">
                    <span className="font-semibold">{name}</span> wants to connect to your wallet.
                </div>

                <div className="text-sm text-center mb-5">
                    By connecting, you allow <span className="font-medium">{name}</span> to view
                    your wallet address, balance, and activity, and to request transaction
                    approvals.
                </div>
            </div>

            {selectedAccounts.length === 1 ? (
                <AccountView
                    account={selectedAccounts[0]}
                    onPress={onAccountPress}
                    className="mb-5"
                />
            ) : selectedAccounts.length > 1 ? (
                <button
                    onClick={e => {
                        e.preventDefault();
                        onAccountPress();
                    }}
                    className="flex flex-row items-center text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-darkline/60 p-3 w-full mb-5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-200 dark:bg-header/70">
                        <IoWallet className="text-primary dark:text-accent" size={20} />
                    </div>
                    <div className="ml-3 mr-2 text-left flex-1 overflow-hidden">
                        <p className="truncate w-[200px]">
                            {selectedAccounts.length} Accounts in total
                        </p>
                    </div>
                    <p className="text-primary text-xs font-semibold">CHANGE</p>
                </button>
            ) : (
                <AccountView onPress={onAccountPress} className="mb-5" />
            )}

            <div className="">
                <button
                    className="btn btn-primary w-full mb-3"
                    onClick={e => {
                        e.preventDefault();
                        onAcceptPress();
                    }}>
                    Accept
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
            <AccountSelectModal
                isSmartWallet={false}
                visible={isShowAccountMenu}
                selectedAccounts={selectedAccounts}
                onConfirm={setSelectedAccounts}
                onClose={() => setIsShowAccountMenu(false)}
            />
        </div>
    );
});
