import { formatMoney, formatNumber } from '../../shared/utils/format';
import React, { useMemo } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { useActualTheme } from '../../store/selectors';
import SafeImage from './SafeImage';

type Info = {
    label: string;
    amount: number | undefined;
    coin_symbol: string | undefined;
    coin_logo: string | undefined;
    amount_usd: number | undefined;
};

type Props = {
    className?: string;
    send: Info;
    receive?: Info;
    isMainnet: Boolean;
};

export default React.memo<Props>((props: Props) => {
    const { className, send, isMainnet } = props;

    const actualTheme = useActualTheme();

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    return (
        <div className={className}>
            <div className="flex flex-col">
                <div className="w-full text-sm p-3 border border-slate-200 dark:border-darkline rounded-md">
                    <div className="flex flex-row items-center mb-3">
                        Estimated changes
                        <button
                            className="ml-2"
                            data-tooltip-id="chilly-tooltip"
                            data-tooltip-variant={tooltipVariant}
                            data-tooltip-html={
                                '<div>Estimated changes indicate potential outcomes</div>' +
                                '<div>if you proceed with this transaction. </div>' +
                                '<div>This is merely a forecast, not a promise.'
                            }
                            data-tooltip-place="top">
                            <FaInfoCircle className="text-gray-500" />
                        </button>
                    </div>

                    <div className="flex flex-row items-center mb-1">
                        <div className="flex-1">{send.label}</div>

                        <div className="text-xs bg-red-100 text-red-800 rounded-full px-2 py-1 mr-1">
                            {formatNumber(-(send.amount ?? 0))}
                        </div>

                        <div className="text-xs bg-slate-100 dark:bg-darker rounded-full ml-2 p-1 flex flex-row items-center">
                            <SafeImage
                                src={send.coin_logo ?? ''}
                                alt={'Logo'}
                                className="w-4 h-4 object-contain rounded-full mr-1"
                            />
                            {send.coin_symbol}
                        </div>
                    </div>

                    {isMainnet && (
                        <div className="flex flex-row items-center justify-end mb-3">
                            <div>{formatMoney(send.amount_usd ?? 0)}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
