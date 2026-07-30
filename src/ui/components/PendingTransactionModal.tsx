import { formatNumber } from '../../shared/utils/format';
import moment from 'moment';
import React, { useCallback, useMemo } from 'react';
import { MdContentCopy } from 'react-icons/md';
import { AssetType, PendingTransaction } from '../../shared/types/Wallet';
import {
    formatAddress,
    isEqualCaseInsensitive,
    toLocaleDateTimeString,
    toTitleCase,
} from '../../shared/utils/string';
import { useContacts } from '../../store/selectors';
import Header from './Header';
import Modal from './Modal';
import TextTruncate from './TextTruncate';
import Toast from './Toast';

type Props = {
    visible: boolean;
    onClosePress: () => void;
    data?: PendingTransaction;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClosePress, data } = props;
    const {
        network,
        sender = '',
        receiver = '',
        type = 'transfer',
        txHash = '',
        status = 'sending',
        createdAt,
    } = data ?? {};
    const contacts = useContacts();

    const currentChain = useMemo(() => {
        return network;
    }, [network]);

    const title = useMemo(() => {
        const name: string = toTitleCase(type ?? '');
        return name.split('-').join(' ');
    }, [type]);

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
            return 'bg-[#1D98FF]';
        }

        switch (status) {
            case 'sending':
                return 'bg-[#1D98FF]';

            case 'sent':
                return 'bg-[#17B569]';

            default:
                return 'bg-[#E84646]';
        }
    }, [status]);

    const valueText = useMemo(() => {
        if (data) {
            switch (data.type) {
                case 'unstake':
                case 'approve':
                case 'cancel-claim-request':
                    return `${formatNumber(data.amount)} ${data.tokens[0].symbol}`;

                case 'transfer':
                    if (data.asset?.type === AssetType.nft) {
                        return data.asset?.name ?? '';
                    } else {
                        return `${formatNumber(data.amount)} ${data.tokens[0].symbol}`;
                    }

                case 'swap':
                case 'liquid-staking':
                case 'request-withdrawal':
                    return `${formatNumber(data.amount)} ${data.tokens[0].symbol} to ${
                        data.tokens[1].symbol
                    }`;
            }
        }

        return '';
    }, [data]);

    const senderLb = useMemo(() => {
        const _index = contacts.findIndex(item =>
            isEqualCaseInsensitive(item.walletAddress, sender),
        );

        if (_index >= 0) {
            return contacts[_index].name;
        }

        return '';
    }, [sender, contacts]);

    const receiverLb = useMemo(() => {
        const _index = contacts.findIndex(item =>
            isEqualCaseInsensitive(item.walletAddress, receiver),
        );

        if (_index >= 0) {
            return contacts[_index].name;
        }

        return '';
    }, [receiver, contacts]);

    const onOpenExplorerPress = useCallback(() => {
        onClosePress();
        if (currentChain) {
            global.platform.openLink(`${currentChain.explorer_url}/tx/${txHash}`, '_blank');
        }
    }, [currentChain, onClosePress, txHash]);

    const viewTitle = useMemo(() => {
        if (currentChain) {
            return `View on ${currentChain.explorer_name}`;
        }
        return '';
    }, [currentChain]);

    const copyToClipboard = useCallback((text?: string) => {
        if (text) {
            navigator.clipboard.writeText(text);
            Toast.showSuccess('Copied to clipboard');
        }
    }, []);

    return (
        <Modal visible={visible} onClose={onClosePress}>
            <Header title={title} hasBackButton={false} onClosePress={onClosePress} />

            <div className="p-5 overflow-y-auto max-h-96">
                {data ? (
                    <div className="">
                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">Transaction Hash</div>
                            <div
                                className="flex flex-row items-center cursor-pointer"
                                onClick={() => {
                                    copyToClipboard(txHash);
                                }}>
                                <p className={'text-gray-500 dark:text-gray-400'}>
                                    {formatAddress(txHash ?? '')}
                                </p>
                                <MdContentCopy className="text-gray-500 dark:text-gray-400 ml-1" />
                            </div>
                        </div>

                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">Status</div>
                            <div
                                className={
                                    'text-white text-xs text-center py-1 px-2 rounded ' +
                                    statusColor
                                }>
                                {statusText?.toUpperCase()}
                            </div>
                        </div>

                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">Created At</div>
                            <div className="flex flex-row items-center text-gray-500 dark:text-gray-400">
                                {createdAt
                                    ? toLocaleDateTimeString(moment(createdAt).toDate())
                                    : ''}
                            </div>
                        </div>

                        <div className="h-[1px] bg-slate-100 dark:bg-darker my-3" />

                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">From</div>
                            <div
                                className="flex flex-row items-center cursor-pointer"
                                onClick={() => {
                                    copyToClipboard(sender);
                                }}>
                                {senderLb ? (
                                    <>
                                        <TextTruncate
                                            text={senderLb}
                                            className={
                                                'text-gray-500 dark:text-gray-400 text-right whitespace-nowrap w-[100px]'
                                            }
                                            position="end"
                                        />
                                        <p className={'text-gray-500 dark:text-gray-400'}>
                                            ({formatAddress(sender ?? '', 3)})
                                        </p>
                                    </>
                                ) : (
                                    <p className={'text-gray-500 dark:text-gray-400'}>
                                        {formatAddress(sender ?? '')}
                                    </p>
                                )}
                                <MdContentCopy className="text-gray-500 dark:text-gray-400 ml-1" />
                            </div>
                        </div>

                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">To</div>
                            <div
                                className="flex flex-row items-center cursor-pointer"
                                onClick={() => {
                                    copyToClipboard(receiver);
                                }}>
                                {receiverLb ? (
                                    <>
                                        <TextTruncate
                                            text={receiverLb}
                                            className={
                                                'text-gray-500 dark:text-gray-400 text-right whitespace-nowrap w-[100px]'
                                            }
                                            position="end"
                                        />
                                        <p className={'text-gray-500 dark:text-gray-400'}>
                                            ({formatAddress(receiver ?? '', 3)})
                                        </p>
                                    </>
                                ) : (
                                    <p className={'text-gray-500 dark:text-gray-400'}>
                                        {formatAddress(receiver ?? '')}
                                    </p>
                                )}
                                <MdContentCopy className="text-gray-500 dark:text-gray-400 ml-1" />
                            </div>
                        </div>

                        <div className="h-[1px] bg-slate-100 dark:bg-darker my-3" />

                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">Amount</div>
                            <div className="flex flex-row items-center text-gray-500 dark:text-gray-400">
                                {valueText}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
            <div className="m-5">
                {currentChain?.explorer_url && (
                    <button className="btn btn-primary w-full" onClick={onOpenExplorerPress}>
                        {viewTitle}
                    </button>
                )}
            </div>
        </Modal>
    );
});
