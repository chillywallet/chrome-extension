import { formatMoney, formatNumber } from '../../shared/utils/format';
import React, { useCallback, useMemo } from 'react';
import { AiOutlineExport } from 'react-icons/ai';
import { MdContentCopy } from 'react-icons/md';
import { getCurrentChainByPlatformId } from '../../lib/ChainsUtils';
import { Transaction } from '../../shared/types/Wallet';
import {
    formatAddress,
    getDateTimeStringFromTimestamp,
    isEqualCaseInsensitive,
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
    data?: Transaction;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClosePress, data } = props;

    const {
        from,
        to,
        transfers,
        fee,
        fee_usd,
        currency,
        method,
        type,
        additional_properties,
        platform_id,
        success,
    } = data ?? {};

    const MAX_TRANSFERS_DISPLAY = 5;

    const contacts = useContacts();

    const fromLabel = useMemo(() => {
        const contact = contacts.find(contact =>
            isEqualCaseInsensitive(contact.walletAddress, from),
        );
        return contact?.name ?? '';
    }, [from, contacts]);

    const toLabel = useMemo(() => {
        const contact = contacts.find(contact => isEqualCaseInsensitive(contact.walletAddress, to));
        return contact?.name ?? '';
    }, [to, contacts]);

    const title = useMemo(() => {
        return toTitleCase(method ?? type ?? '');
    }, [method, type]);

    const currentChain = useMemo(() => {
        if (platform_id) {
            return getCurrentChainByPlatformId(platform_id);
        }
        return null;
    }, [platform_id]);

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

    const displayedTransfers = useMemo(() => {
        if (!transfers) return [];
        return transfers.slice(0, MAX_TRANSFERS_DISPLAY);
    }, [transfers]);

    const hasMoreTransfers = useMemo(() => {
        return transfers && transfers.length > MAX_TRANSFERS_DISPLAY;
    }, [transfers]);

    const onOpenExplorerPress = useCallback(() => {
        if (currentChain && additional_properties?.transaction_hash) {
            onClosePress();

            global.platform.openLink(
                `${currentChain.explorer_url}/tx/${additional_properties.transaction_hash}`,
                '_blank',
            );
        }
    }, [onClosePress, currentChain, additional_properties]);

    const onOpenBlockPress = useCallback(() => {
        if (currentChain && additional_properties?.block) {
            onClosePress();

            global.platform.openLink(
                `${currentChain.explorer_url}/block/${additional_properties.block}`,
                '_blank',
            );
        }
    }, [onClosePress, currentChain, additional_properties]);

    return (
        <Modal visible={visible} onClose={onClosePress}>
            <Header title={title} hasBackButton={false} onClosePress={onClosePress} />

            <div className="p-5 overflow-y-auto max-h-96">
                {data ? (
                    <div className="">
                        {additional_properties?.transaction_hash && (
                            <div className="text-sm mb-4 flex flex-row items-center">
                                <div className="font-semibold flex-1">Transaction Hash</div>
                                <div
                                    className="flex flex-row items-center cursor-pointer"
                                    onClick={() => {
                                        copyToClipboard(additional_properties.transaction_hash);
                                    }}>
                                    <p className={'text-gray-500 dark:text-gray-400'}>
                                        {formatAddress(additional_properties.transaction_hash)}
                                    </p>
                                    <MdContentCopy className="text-gray-500 dark:text-gray-400 ml-1" />
                                </div>
                            </div>
                        )}

                        {additional_properties?.block ? (
                            <div className="text-sm mb-4 flex flex-row items-center">
                                <div className="font-semibold flex-1">Block</div>
                                {currentChain?.explorer_url ? (
                                    <div
                                        className="flex flex-row items-center cursor-pointer"
                                        onClick={onOpenBlockPress}>
                                        <TextTruncate
                                            text={`${additional_properties.block}`}
                                            className={
                                                'text-gray-500 dark:text-gray-400 text-right whitespace-nowrap w-[150px]'
                                            }
                                            position="middle"
                                        />
                                        <AiOutlineExport className="text-gray-500 dark:text-gray-400 ml-1" />
                                    </div>
                                ) : (
                                    <TextTruncate
                                        text={`${additional_properties.block}`}
                                        className={
                                            'text-gray-500 dark:text-gray-400 text-right whitespace-nowrap w-[150px]'
                                        }
                                        position="middle"
                                    />
                                )}
                            </div>
                        ) : null}

                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">Status</div>
                            <div
                                className={`text-white text-xs text-center py-1 px-2 rounded ${
                                    success ? 'bg-green-500' : 'bg-red-500'
                                }`}>
                                {success ? 'SUCCESS' : 'FAILED'}
                            </div>
                        </div>

                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">Timestamp</div>
                            <div className="flex flex-row items-center text-gray-500 dark:text-gray-400">
                                {getDateTimeStringFromTimestamp(data?.timestamp)}
                            </div>
                        </div>

                        <div className="h-[1px] bg-slate-100 dark:bg-darker my-3" />

                        <div className="text-sm mb-4 flex flex-row items-center">
                            <div className="font-semibold flex-1">From</div>
                            <div
                                className="flex flex-row items-center cursor-pointer"
                                onClick={() => {
                                    copyToClipboard(from);
                                }}>
                                {fromLabel ? (
                                    <>
                                        <TextTruncate
                                            text={fromLabel}
                                            className={
                                                'text-gray-500 dark:text-gray-400 text-right whitespace-nowrap w-[100px]'
                                            }
                                            position="end"
                                        />
                                        <p className={'text-gray-500 dark:text-gray-400'}>
                                            ({formatAddress(from ?? '', 3)})
                                        </p>
                                    </>
                                ) : (
                                    <p className={'text-gray-500 dark:text-gray-400'}>
                                        {formatAddress(from ?? '')}
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
                                    copyToClipboard(to);
                                }}>
                                {toLabel ? (
                                    <>
                                        <TextTruncate
                                            text={toLabel}
                                            className={
                                                'text-gray-500 dark:text-gray-400 text-right whitespace-nowrap w-[100px]'
                                            }
                                            position="end"
                                        />
                                        <p className={'text-gray-500 dark:text-gray-400'}>
                                            ({formatAddress(to ?? '', 3)})
                                        </p>
                                    </>
                                ) : (
                                    <p className={'text-gray-500 dark:text-gray-400'}>
                                        {formatAddress(to ?? '')}
                                    </p>
                                )}
                                <MdContentCopy className="text-gray-500 dark:text-gray-400 ml-1" />
                            </div>
                        </div>

                        {displayedTransfers && displayedTransfers.length > 0 && (
                            <>
                                <div className="h-[1px] bg-slate-100 dark:bg-darker my-3" />

                                <h3 className="text-sm font-semibold mb-2">Tokens Transferred</h3>
                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <div className="p-3">
                                        {displayedTransfers.map((transfer, index) => (
                                            <div key={index}>
                                                <div className="flex-col gap-2 text-xs">
                                                    <div className="flex flex-row items-center flex-wrap gap-2">
                                                        <span className="text-gray-500 dark:text-gray-400">
                                                            From
                                                        </span>

                                                        <div
                                                            className="flex flex-row items-center cursor-pointer text-black dark:text-white text-right"
                                                            onClick={() => {
                                                                copyToClipboard(
                                                                    transfer.from_address,
                                                                );
                                                            }}>
                                                            {formatAddress(transfer.from_address)}
                                                            <MdContentCopy className="text-black dark:text-white ml-1" />
                                                        </div>

                                                        <span className="text-gray-500 dark:text-gray-400">
                                                            To
                                                        </span>

                                                        <div
                                                            className="flex flex-row items-center cursor-pointer text-black dark:text-white text-right"
                                                            onClick={() => {
                                                                copyToClipboard(
                                                                    transfer.to_address,
                                                                );
                                                            }}>
                                                            {formatAddress(transfer.to_address)}
                                                            <MdContentCopy className="text-black dark:text-white ml-1" />
                                                        </div>
                                                    </div>

                                                    <div className="flex-row items-center flex-wrap gap-2">
                                                        <span className="text-gray-500 dark:text-gray-400 mr-2">
                                                            For
                                                        </span>

                                                        <span>
                                                            {transfer.type === 'erc20' ||
                                                            transfer.type === 'native'
                                                                ? `${formatNumber(
                                                                      parseFloat(
                                                                          transfer.token_amount_formatted,
                                                                      ),
                                                                  )} `
                                                                : ''}

                                                            {transfer.token_symbol}
                                                        </span>
                                                    </div>
                                                </div>
                                                {index < displayedTransfers.length - 1 && (
                                                    <div className="h-[1px] bg-gray-200 dark:bg-gray-600 my-3" />
                                                )}
                                            </div>
                                        ))}
                                        {hasMoreTransfers && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                                <button
                                                    className="w-full text-primary hover:text-primary-dark text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                                                    onClick={onOpenExplorerPress}>
                                                    View More Transfers
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {fee && (
                            <>
                                <div className="h-[1px] bg-slate-100 dark:bg-darker my-3" />

                                <div className="flex flex-row text-sm">
                                    <div className="font-semibold flex-1">Network Fee</div>
                                    <div className="text-gray-500 dark:text-gray-400 flex flex-col items-end">
                                        <div>{`${formatNumber(parseFloat(fee))} ${currency}`}</div>
                                        {!!fee_usd && !currentChain?.testnet && (
                                            <div>{formatMoney(fee_usd ?? 0)}</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
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
