import { formatMoney } from '../../shared/utils/format';
import React, { useMemo } from 'react';
import { IoArrowDown, IoArrowUp } from 'react-icons/io5';
import { MarketCoinPrice } from '../../shared/types/Wallet';
import AssetLogo from './AssetLogo';

type Props = {
    coin: MarketCoinPrice;
    onClick: (coin: MarketCoinPrice) => void;
    className?: string;
};

export default React.memo<Props>((props: Props) => {
    const {
        coin,
        onClick,
        className = 'flex flex-row items-center justify-between cursor-pointer p-3',
    } = props;

    const percentChange = useMemo(
        () => coin.latest?.percent_change_24h ?? 0,
        [coin.latest?.percent_change_24h],
    );

    const upDown = useMemo(
        () => (percentChange !== 0 ? percentChange > 0 : undefined),
        [percentChange],
    );

    const percent = useMemo(
        () => (percentChange < 0 ? percentChange * -1 : percentChange).toFixed(2),
        [percentChange],
    );

    const priceColor = useMemo(() => (upDown ? 'text-green-500' : 'text-red-500'), [upDown]);

    return (
        <div
            className={className}
            onClick={() => {
                onClick(coin);
            }}>
            <div className="flex flex-row items-center">
                <AssetLogo src={coin.logo ?? undefined} width={32} className="mr-3" />

                <div className="flex flex-col">
                    <p className="text-sm">{coin.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        {coin.rank ? `#${coin.rank} ` : ''}
                        {coin.symbol}
                    </p>
                </div>
            </div>

            <div className="flex flex-col items-end">
                <div className="text-sm">{formatMoney(coin.latest?.price ?? 0)}</div>
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
        </div>
    );
});
