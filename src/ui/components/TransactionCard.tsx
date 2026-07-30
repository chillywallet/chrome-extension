import { formatMoney, formatNumber } from '../../shared/utils/format';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GoAlertFill } from 'react-icons/go';
import { MdContentCopy } from 'react-icons/md';
import { Transaction } from '../../shared/types/Wallet';
import {
    formatAddress,
    getDateTimeStringFromTimestamp,
    isEqualCaseInsensitive,
    toTitleCase,
} from '../../shared/utils/string';
import { getCoinByTokenAddress } from '../../store/actions/uiActions';
import { useContacts } from '../../store/selectors';
import { useCurrentPlatformId } from '../../store/selectors/wallet';
import AssetLogo from './AssetLogo';
import Toast from './Toast';

export type Props = {
    containerStyle?: any;
    data: Transaction;
    onPress: (item: Transaction) => void;
};

type HandledData = {
    datetime: string;
    icon?: number;
    logo?: string;
    name: string;
    fee: string;
    usdFee: string;
    tokenAmount: string;
    hasFee: boolean;
    platform_id: number;
    isNFT: boolean;
};

export const Placeholder = () => {
    return (
        <div className="flex flex-row w-full p-3">
            <div className="flex w-9 h-9 rounded-full shrink-0 overflow-hidden">
                <div className="w-full h-full animate-pulse bg-placeholder"></div>
            </div>
            <div className="flex-1 text-left ml-3">
                <p className="animate-pulse bg-placeholder h-5 w-1/2 mb-2 rounded-md"></p>
                <p className="animate-pulse bg-placeholder h-3 w-1/3 rounded-md"></p>
            </div>
            <div className="flex flex-col items-end justify-center ml-3">
                <p className="animate-pulse bg-placeholder h-5 w-5 rounded-md"></p>
            </div>
        </div>
    );
};

export default React.memo<Props>(({ data, containerStyle, onPress }: Props) => {
    const [handledData, setHandledData] = useState<HandledData>({
        datetime: getDateTimeStringFromTimestamp(data.timestamp),
        name: toTitleCase(data?.method || data?.type || ''),
        fee: '',
        usdFee: '',
        tokenAmount: '',
        hasFee: false,
        platform_id: data.platform_id,
        isNFT: false,
    });
    const contacts = useContacts();

    const { datetime, tokenAmount, name } = handledData;
    const platformId = useCurrentPlatformId();

    const trackingWalletLabel = useMemo(() => {
        const index = contacts.findIndex(item =>
            isEqualCaseInsensitive(item.walletAddress, data.wallet_address),
        );

        if (index >= 0) {
            return contacts[index].name;
        }

        return formatAddress(data.wallet_address, 4);
    }, [data, contacts]);

    const copyToClipboard = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (data?.wallet_address) {
                navigator.clipboard.writeText(data.wallet_address);
                Toast.showSuccess('Copied to clipboard');
            }
        },
        [data?.wallet_address],
    );

    useEffect(() => {
        const loadData = async () => {
            const {
                transfers,
                timestamp,
                fee: _fee,
                fee_usd,
                currency,
                platform_id,
                method,
                wallet_address,
                type,
                to,
            } = data;

            let _tokenAmount = '';
            let _amounts: { value: number; symbol: string; type: 'in' | 'out' }[] = [];
            let _logo: string | undefined;
            let isNFT = false;

            if (transfers && transfers.length) {
                for (let i = 0; i < transfers.length; i++) {
                    const _transfer = transfers[i];
                    const isTransferOut = isEqualCaseInsensitive(
                        wallet_address,
                        _transfer.from_address,
                    );
                    const isTransferIn = isEqualCaseInsensitive(
                        wallet_address,
                        _transfer.to_address,
                    );

                    if (isTransferIn || isTransferOut) {
                        _logo = _transfer.token_meta?.logo;

                        if (!['erc20', 'native'].includes(_transfer.type)) {
                            _tokenAmount = _transfer.token_symbol;
                            isNFT = true;
                            break;
                        } else {
                            const findAmount = _amounts.find(
                                _amount =>
                                    _amount.symbol === _transfer.token_symbol &&
                                    ((_amount.type === 'in' && isTransferIn) ||
                                        (_amount.type === 'out' && isTransferOut)),
                            );

                            if (findAmount) {
                                findAmount.value += parseFloat(
                                    _transfer.token_amount_formatted || '0',
                                );
                            } else {
                                _amounts.push({
                                    value: parseFloat(_transfer.token_amount_formatted || '0'),
                                    symbol: _transfer.token_symbol,
                                    type: isTransferOut ? 'out' : 'in',
                                });
                            }
                        }
                    }
                }

                if (_amounts.length) {
                    _tokenAmount = _amounts
                        .map(_amount => {
                            const amountStr = formatNumber(_amount.value);
                            return `${_amount.type === 'out' ? '-' : '+'}${amountStr} ${
                                _amount.symbol
                            }`;
                        })
                        .join(', ');
                }
            } else {
                const _coin = await getCoinByTokenAddress(
                    wallet_address?.toLowerCase() ?? '',
                    platform_id,
                    to,
                );
                _logo = _coin?.logo;
            }

            setHandledData({
                datetime: getDateTimeStringFromTimestamp(timestamp),
                logo: _logo,
                name: toTitleCase(method || type || ''),
                tokenAmount: _tokenAmount,
                fee: `${formatNumber(parseFloat(_fee || '0'))} ${currency}`,
                usdFee: formatMoney(fee_usd || 0),
                hasFee: Boolean(_fee),
                platform_id,
                isNFT,
            });
        };

        loadData();
    }, [data]);

    return (
        <div
            className={
                'flex flex-col px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors ' +
                containerStyle
            }
            onClick={() => onPress(data)}>
            <div className="w-full flex items-center">
                <AssetLogo src={handledData.logo} width={36} platform_id={platformId} />
                <div className="ml-3 flex-1">
                    <div className="flex items-center overflow-hidden">
                        <p className="text-sm font-medium">{name}</p>
                        {!data.success && (
                            <GoAlertFill className="ml-1" name="alert" color="#E84646" size={16} />
                        )}
                        <p className="ml-2 flex-1 text-sm font-semibold tabular-nums text-right text-ellipsis mr-1">
                            {tokenAmount}
                        </p>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate tabular-nums">
                            {datetime}
                        </p>
                        <div
                            className="flex text-xs items-center cursor-pointer text-gray-400 dark:text-gray-500 p-1 rounded hover:text-primary dark:hover:text-accent transition-colors"
                            onClick={copyToClipboard}>
                            {trackingWalletLabel}
                            <MdContentCopy size={14} className="ml-1" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
