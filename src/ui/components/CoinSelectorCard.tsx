import { formatMoney } from '../../shared/utils/format';
import { getAddress } from 'ethers';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { IoArrowDown, IoArrowUp } from 'react-icons/io5';
import { isNativeCoinByPlatformIdAndTokenAddress } from '../../lib/WalletUtils';
import { PlatformCoin } from '../../shared/types/Wallet';
import { formatAddress } from '../../shared/utils/string';
import AssetLogo from './AssetLogo';

type Props = {
    data: PlatformCoin;
    onPress: (coin: PlatformCoin) => void;
    testnet?: boolean;
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
            <div className="flex flex-col items-end ml-3">
                <p className="animate-pulse bg-placeholder h-5 w-20 mb-2 rounded-md"></p>
                <p className="animate-pulse bg-placeholder h-3 w-10 rounded-md"></p>
            </div>
        </div>
    );
};

export default React.memo<Props>((props: Props) => {
    const { onPress, data, testnet = false } = props;

    const { logo, name, symbol, rank, icon, is_verified, coinAddress, platformId } = data;
    const [upDown, setUpDown] = useState<boolean | undefined>(undefined);
    const [percent, setPercent] = useState('0');
    const [priceStr, setPriceStr] = useState('');
    const [tooltipText, setTooltipText] = useState('Copy token address');

    useEffect(() => {
        const { latest } = data;
        const { price, percent_change_24h } = latest ?? { price: 0, percent_change_24h: 0 };
        const percentage = percent_change_24h ? percent_change_24h : 0;
        const up = percentage > 0;
        const money = formatMoney(price ?? 0);
        const percentStr = (percentage < 0 ? percentage * -1 : percentage).toFixed(2);
        setUpDown(percentage !== 0 ? up : undefined);
        setPercent(percentStr);
        setPriceStr(money);
    }, [data]);

    const priceColor = useMemo(() => {
        return upDown ? 'text-green-500' : 'text-red-500';
    }, [upDown]);

    const isNativeToken = useMemo(() => {
        return coinAddress
            ? isNativeCoinByPlatformIdAndTokenAddress(platformId, coinAddress)
            : false;
    }, [coinAddress, platformId]);

    const checksumAddress = useMemo(() => {
        const address = coinAddress ?? '';

        try {
            return getAddress(address);
        } catch (error) {}

        return address;
    }, [coinAddress]);

    const onCopyAddress = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (checksumAddress) {
                navigator.clipboard.writeText(checksumAddress);
                setTooltipText('Copied');

                setTimeout(() => {
                    setTooltipText('Copy token address');
                }, 2000);
            }
        },
        [checksumAddress],
    );

    return (
        <button
            className={
                'flex flex-row items-center hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors w-full p-3'
            }
            onClick={e => {
                e.preventDefault();
                onPress(data);
            }}>
            <div className="relative">
                <AssetLogo src={(icon ? icon : logo) ?? undefined} width={36} />
                {is_verified === true && (
                    <div className="absolute -top-0.5 -right-0.5 z-10">
                        <div
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-md"
                            style={{ backgroundColor: '#17B569' }}>
                            <FiCheck size={10} className="text-white" />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col ml-2 items-start flex-1">
                <div className="mb-1 text-sm max-w-[200px] truncate">{name}</div>
                <div className="flex flex-row items-center text-gray-700 dark:text-gray-300 text-xs">
                    {rank ? <div className="mr-2">#{rank}</div> : null}
                    <div className="max-w-[100px] truncate"> {symbol}</div>
                    {checksumAddress && !isNativeToken && (
                        <div
                            onClick={onCopyAddress}
                            className="flex flex-row items-center ml-2 gap-1 text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary transition-colors"
                            data-tooltip-id="chilly-tooltip"
                            data-tooltip-content={tooltipText}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onCopyAddress(e as any);
                                }
                            }}>
                            <span>{formatAddress(checksumAddress, 4)}</span>
                            <FiCopy size={12} />
                        </div>
                    )}
                </div>
            </div>
            {!testnet && (
                <div className="flex flex-col items-end">
                    <div className="text-sm mb-2">{priceStr}</div>
                    {upDown !== undefined && (
                        <div className="flex flex-row items-center justify-center">
                            {upDown ? (
                                <IoArrowUp className="text-green-600" />
                            ) : (
                                <IoArrowDown className="text-red-600" />
                            )}
                            <div className={'text-xs ' + priceColor}>{`${percent}%`}</div>
                        </div>
                    )}
                </div>
            )}
        </button>
    );
});
