import { formatNumber } from '../../shared/utils/format';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiFillInfoCircle } from 'react-icons/ai';
import { LuSend } from 'react-icons/lu';
import { MdContentCopy } from 'react-icons/md';
import { RiLoaderFill } from 'react-icons/ri';
import EventType from '../../shared/types/EventType';
import { AssetType, PendingTransaction, TxtStatus } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import { formatAddress, isEqualCaseInsensitive } from '../../shared/utils/string';
import { updatePendingTransactionStatus } from '../../store/actions/uiActions';
import { useContacts, useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import AssetLogo from './AssetLogo';
import PendingTxtMenu from './PendingTxtMenu';
import { SpeedUpAndCancelTxData } from './SpeedUpAndCancelModal';
import Toast from './Toast';

type Props = {
    data: PendingTransaction;
    onPress: (coin: PendingTransaction) => void;
    setCancelSpeedUpTxData: (data: SpeedUpAndCancelTxData) => void;
};

export default React.memo<Props>((props: Props) => {
    const { onPress, data, setCancelSpeedUpTxData } = props;
    const dispatch = useAppDispatch();
    const selectedNetwork = useSelectedNetwork();
    const contacts = useContacts();

    const currentTxHashRef = useRef(data?.txHash ?? '');

    const [status, setStatus] = useState<TxtStatus>(data?.status ?? 'sending');

    const trackingAddressLb = useMemo(() => {
        const index = contacts.findIndex(item =>
            isEqualCaseInsensitive(item.walletAddress, data.sender),
        );

        if (index >= 0) {
            return contacts[index].name;
        }

        return formatAddress(data.sender, 4);
    }, [data.sender, contacts]);

    const name = useMemo(() => {
        const { type, asset, tokens } = data ?? {};
        return type === 'transfer'
            ? (asset?.name ?? 'Transfer')
            : type === 'swap' || type === 'liquid-staking'
              ? `${tokens?.[0].symbol} to ${tokens?.[1].symbol}`
              : (tokens?.[0].name ?? '');
    }, [data]);

    const statusText = useMemo(() => {
        const isSending = !status || status === 'sending';
        const isSent = status === 'sent';

        if (data?.cancelling) {
            return isSending ? 'Cancelling' : isSent ? 'Cancelled' : 'Cancel Failed';
        }

        switch (data?.type) {
            case 'request-withdrawal':
            case 'transfer':
                return isSending ? 'Sending' : isSent ? 'Sent' : 'Failed';

            case 'swap':
                return isSending ? 'Swapping' : isSent ? 'Swapped' : 'Swap Failed';

            case 'approve':
                return isSending ? 'Approving' : isSent ? 'Approved' : 'Approve Failed';

            case 'liquid-staking':
            case 'stake':
                return isSending ? 'Staking' : isSent ? 'Staked' : 'Stake Failed';

            case 'unstake':
                return isSending ? 'Unstaking' : isSent ? 'Unstaked' : 'Unstake Failed';

            case 'cancel-claim-request':
                return isSending ? 'Cancelling Request' : isSent ? 'Cancelled' : 'Cancel Failed';
        }
    }, [data, status]);

    const statusColor = useMemo(() => {
        if (!status) {
            return 'text-[#1D98FF]';
        }
        switch (status) {
            case 'sent':
                return 'text-[#17B569]';
            case 'failed':
                return 'text-[#E84646]';
            default:
                return 'text-[#1D98FF]';
        }
    }, [status]);

    const onMenuPress = useCallback(
        (item: PendingTransaction, type: 'cancel' | 'speedup') => {
            setCancelSpeedUpTxData({
                visible: true,
                data: item,
                type: type === 'speedup' ? 'speedup' : 'cancel',
                onStart: () => {
                    currentTxHashRef.current = 'loading';
                },
                onEnd: newTx => {
                    if (newTx) {
                        currentTxHashRef.current = newTx.txHash;
                    } else {
                        currentTxHashRef.current = data.txHash;
                    }
                },
            });
        },
        [setCancelSpeedUpTxData, data.txHash],
    );

    const copyToClipboard = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (data?.sender) {
                navigator.clipboard.writeText(data.sender);
                Toast.showSuccess('Copied to clipboard');
            }
        },
        [data?.sender],
    );

    useEffect(() => {
        if (
            selectedNetwork.chain_id === data.network.chain_id &&
            (!data.status || data.status === 'sending')
        ) {
            dispatch(updatePendingTransactionStatus(selectedNetwork.platform_id, data)).then(
                (status: TxtStatus) => {
                    if (status !== 'sending') {
                        eventManager.emit(EventType.REFRESH_WALLET);
                    }
                },
            );
        }
    }, [data, dispatch, selectedNetwork]);

    useEffect(() => {
        if (
            data &&
            currentTxHashRef.current === data.txHash &&
            currentTxHashRef.current !== 'loading'
        ) {
            setStatus(data.status ?? 'sending');
        }
    }, [data]);

    return (
        <div
            className={
                'flex flex-row hover:bg-gray-100 dark:hover:bg-darker items-center w-full p-3 cursor-pointer'
            }
            onClick={e => {
                e.preventDefault();
                onPress(data);
            }}>
            {data && (
                <>
                    <AssetLogo
                        src={data?.tokens?.[0].icon}
                        width={36}
                        platform_id={selectedNetwork.platform_id}
                    />
                    <div className="flex-1 text-left ml-2 min-w-0">
                        <div className="flex flex-row w-full items-center justify-between">
                            <div className="flex flex-row items-center min-w-0">
                                <p className={'text-sm font-semibold mr-2 truncate ' + statusColor}>
                                    {statusText}
                                </p>
                                {status === 'sending' ? (
                                    <RiLoaderFill
                                        className="custom-anim-slow"
                                        color="#1D98FF"
                                        size={16}
                                    />
                                ) : status === 'sent' ? (
                                    <LuSend color="#17B569" size={16} />
                                ) : (
                                    <AiFillInfoCircle color="#E84646" size={16} />
                                )}
                            </div>
                            {data?.type === 'approve' ||
                            data?.type === 'swap' ||
                            data?.type === 'liquid-staking' ||
                            data?.type === 'request-withdrawal' ||
                            data?.type === 'unstake' ||
                            data?.type === 'cancel-claim-request' ? (
                                <p className="text-sm font-semibold shrink-0 ml-2 mr-1">
                                    {formatNumber(data?.amount)} {data?.tokens[0].symbol}
                                </p>
                            ) : data?.type === 'transfer' && data?.asset?.type !== AssetType.nft ? (
                                <p className="text-sm font-semibold shrink-0 ml-2 mr-1">
                                    {formatNumber(data?.amount)}{' '}
                                    {data?.asset?.symbol ?? data?.tokens?.[0].symbol ?? ''}
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-row w-full items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {name}
                            </p>
                            <div
                                onClick={copyToClipboard}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded shrink-0 text-gray-500 dark:text-gray-400">
                                <div className="flex flex-row items-center justify-between gap-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
                                        {trackingAddressLb}
                                    </p>
                                    <MdContentCopy size={14} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <PendingTxtMenu data={data} onMenuPress={onMenuPress} />
                </>
            )}
        </div>
    );
});
