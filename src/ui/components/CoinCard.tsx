import { formatMoney, formatNumber } from '../../shared/utils/format';
import React, { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiEyeOff, FiInfo, FiPlus } from 'react-icons/fi';
import EventType from '../../shared/types/EventType';
import { Coin } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import { isEqualCaseInsensitive } from '../../shared/utils/string';
import { useActualTheme, useIsTestnet } from '../../store/selectors';
import AssetLogo from './AssetLogo';
import CoinMenu from './CoinMenu';

type Props = {
    data: Coin;
    onPress: (coin: Coin) => void;
    showMenu?: boolean;
    isAAWallet?: boolean;
    type: 'portfolio' | 'send';
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
                <p className="animate-pulse bg-placeholder h-4 w-20 mb-1 rounded"></p>
                <p className="animate-pulse bg-placeholder h-4 w-12 rounded"></p>
            </div>
        </div>
    );
};

export default React.memo<Props>((props: Props) => {
    const { onPress, data, showMenu = true, isAAWallet = false, type = 'portfolio' } = props;
    const isTestnet = useIsTestnet();
    const actualTheme = useActualTheme();

    const [balance, setBalance] = useState(data.coin_balance ?? -1);
    const [price, setPrice] = useState(data.coin_price ?? 0);

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    useEffect(() => {
        const onBalanceChange = (
            _balance: number,
            _platformId: number,
            _walletAddress: string,
            _tokenAddress: string,
        ) => {
            if (
                _platformId === data.platform_id &&
                isEqualCaseInsensitive(_walletAddress, data.wallet_address) &&
                isEqualCaseInsensitive(_tokenAddress, data.token_address)
            ) {
                data.coin_balance = _balance;
                setBalance(_balance);
            }
        };

        const onPriceChange = (
            _price: number,
            _platformId: number,
            _tokenAddress: string,
            _walletAddress: string,
        ) => {
            if (
                _platformId === data.platform_id &&
                isEqualCaseInsensitive(_tokenAddress, data.token_address) &&
                isEqualCaseInsensitive(_walletAddress, data.wallet_address)
            ) {
                data.coin_price = _price;
                setPrice(_price);
            }
        };

        eventManager.on(EventType.REFRESH_WALLET_COIN_BALANCE, onBalanceChange);
        eventManager.on(EventType.REFRESH_WALLET_COIN_PRICE, onPriceChange);

        return () => {
            eventManager.off(EventType.REFRESH_WALLET_COIN_BALANCE, onBalanceChange);
            eventManager.off(EventType.REFRESH_WALLET_COIN_PRICE, onPriceChange);
        };
    }, [data]);

    useEffect(() => {
        if (data.coin_balance !== balance) {
            setBalance(data.coin_balance ?? -1);
        }
    }, [data.coin_balance, balance]);

    useEffect(() => {
        if (data.coin_price !== price) {
            setPrice(data.coin_price ?? 0);
        }
    }, [data.coin_price, price]);

    const isLoadingBalance = balance === -1;

    const badgeIcon = useMemo(() => {
        if (data.is_hidden === true) {
            return {
                icon: FiEyeOff,
                backgroundColor: actualTheme === 'dark' ? '#69C4EE' : '#4AA8DC',
            };
        }

        if (data.is_custom) {
            return {
                icon: FiPlus,
                backgroundColor: actualTheme === 'dark' ? '#F0B90B' : '#d8ae27',
            };
        }

        if (data.is_verified) {
            return {
                icon: FiCheck,
                backgroundColor: '#17B569',
            };
        }

        return null;
    }, [data.is_hidden, data.is_custom, data.is_verified, actualTheme]);

    return (
        <button
            className="flex flex-row items-center w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
            onClick={e => {
                e.preventDefault();
                onPress(data);
            }}>
            <div className="relative">
                <AssetLogo src={(data.icon ? data.icon : data.logo) ?? undefined} width={36} />
                {badgeIcon !== null && (
                    <div className="absolute -top-0.5 -right-0.5 z-10">
                        <div
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-md"
                            style={{ backgroundColor: badgeIcon.backgroundColor }}>
                            <badgeIcon.icon size={10} className="text-white" />
                        </div>
                    </div>
                )}
            </div>
            <div className="flex-1 text-left ml-3">
                <div className="flex items-center gap-2">
                    <p className="text-sm text-black dark:text-white font-medium truncate overflow-hidden max-w-[150px]">
                        {data.coin_name ? data.coin_name : 'Unknown'}
                    </p>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate overflow-hidden max-w-[150px]">
                    {data.symbol ? data.symbol : '---'}
                </p>
            </div>
            <div className="flex flex-col items-end ml-3 min-w-0">
                {isLoadingBalance ? (
                    showMenu ? (
                        <div className="w-16 h-4 animate-pulse bg-placeholder rounded mb-1"></div>
                    ) : null
                ) : (
                    <p className="text-sm text-black dark:text-white font-semibold tabular-nums text-right break-all">
                        {formatNumber(balance)}
                    </p>
                )}
                {!isTestnet &&
                    (isLoadingBalance ? (
                        showMenu ? (
                            <div className="w-12 h-4 animate-pulse bg-placeholder rounded"></div>
                        ) : null
                    ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums text-right break-all">
                            {formatMoney(balance * price)}
                        </p>
                    ))}
            </div>
            {showMenu && (
                <div className="ml-3 mr-2">
                    <CoinMenu
                        platformId={data.platform_id}
                        tokenAddress={data.token_address}
                        walletAddress={data.wallet_address}
                        isHidden={
                            data.is_hidden === true ||
                            (!data.is_verified && !data.is_custom && data.is_hidden !== false)
                        }
                    />
                </div>
            )}
        </button>
    );
});
