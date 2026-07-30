import { getAddress } from 'ethers';
import React, { useCallback, useMemo, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { isNativeCoinByPlatformIdAndTokenAddress } from '../../lib/WalletUtils';
import { CustomPlatformCoin, PlatformCoin } from '../../shared/types/Wallet';
import { formatAddress } from '../../shared/utils/string';
import AssetLogo from './AssetLogo';

type Props = {
    data: CustomPlatformCoin;
    onPress: (coin: PlatformCoin) => void;
    testnet?: boolean;
};

export default React.memo((props: Props) => {
    const { data, onPress } = props;
    const [tooltipText, setTooltipText] = useState('Copy token address');

    const isNativeToken = useMemo(() => {
        return data.coinAddress
            ? isNativeCoinByPlatformIdAndTokenAddress(data.platformId, data.coinAddress)
            : false;
    }, [data.coinAddress, data.platformId]);

    const checksumAddress = useMemo(() => {
        const address = data.coinAddress ?? '';

        try {
            return getAddress(address);
        } catch (error) {}

        return address;
    }, [data.coinAddress]);

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
        <button className="flex flex-row items-center px-4 py-2" onClick={() => onPress(data)}>
            <div className="relative">
                <AssetLogo src={(data.icon ? data.icon : data.logo) ?? undefined} width={36} />
                {data.is_verified === true && (
                    <div className="absolute -top-0.5 -right-0.5 z-10">
                        <div
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-md"
                            style={{ backgroundColor: '#17B569' }}>
                            <FiCheck size={10} className="text-white" />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-row justify-between items-center flex-1 ml-4">
                <div className="flex flex-col">
                    <div className="max-w-[200px] truncate text-left">
                        {data.name ? data.name : 'Unknown'}
                    </div>
                    <div className="flex flex-row items-center text-xs text-gray-500 text-left">
                        <div className="max-w-[100px] truncate">
                            {data.symbol ? data.symbol : '---'}
                        </div>
                    </div>
                </div>
                {checksumAddress && !isNativeToken && (
                    <div
                        onClick={onCopyAddress}
                        className="flex flex-row items-center text-xs text-gray-500 dark:text-gray-400 ml-2 gap-1 cursor-pointer hover:text-primary transition-colors"
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
        </button>
    );
});
