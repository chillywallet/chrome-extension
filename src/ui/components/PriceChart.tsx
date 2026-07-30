import { formatMoney } from '../../shared/utils/format';
import moment from 'moment';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IoMdArrowDown, IoMdArrowUp } from 'react-icons/io';
import eventManager from '../../shared/utils/eventManager';
import { useActualTheme } from '../../store/selectors';
import Echarts from './Echarts';

type PriceChartProps = {
    data: number[];
    date: string[];
    lineColor: string;
    rightView?: React.ReactNode;
};

type HeaderProps = {
    data: number[];
    rightView?: React.ReactNode;
};

type HighestLowestProps = {
    data: number[];
    type: 'highest' | 'lowest';
};

const GRID = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
};

const Y_AXIS = {
    type: 'value',
    show: false,
    min: (value: any) => {
        return value.min - 0.01; // subtract a small buffer
    },
    max: (value: any) => {
        return value.max + 0.01; // add a small buffer
    },
};

export const EVENT_SET_VALUE = 'EVENT_SET_VALUE';
export const EVENT_HIDE_TOOLTIP = 'EVENT_HIDE_TOOLTIP';

export const PriceChartPlaceholder = () => {
    const theme = useActualTheme();
    return (
        <div>
            <div className="p-5 pb-0">
                <div className="h-4 w-[100px] rounded-md bg-placeholder animate-pulse mb-2"></div>
                <div className="h-8 w-[100px] rounded-md bg-placeholder animate-pulse mb-1"></div>
                <div className="h-5 w-[150px] rounded-md bg-placeholder animate-pulse mb-2"></div>
            </div>
            <div className="flex flex-col items-end justify-center h-[30px] pr-5">
                <div className="h-4 mt-1 w-[50px] rounded-md bg-placeholder animate-pulse"></div>
                <div className="h-4 mt-1 w-[80px] rounded-md bg-placeholder animate-pulse"></div>
            </div>
            <div className="h-[150px] animate-pulse">
                <svg className="h-full w-full" viewBox="0 0 410 105" preserveAspectRatio="none">
                    <path
                        d="M -20 36.827 L 13.43 21.407 L 24.14 12.321 L 33.852 12.145 L 42.094 5.836 C 42.094 5.836 50.643 10.614 50.751 10.507 C 50.859 10.4 59.27 7.812 59.27 7.812 L 78.996 40.085 L 84.261 62.808 L 92.33 64.836 C 92.33 64.836 103.931 50.715 104.575 51.797 C 105.219 52.879 112.326 83.594 112.326 83.594 L 120.679 94.094 L 130.043 70.207 L 137.658 57.151 L 148.011 62.486 L 156.74 60.458 L 164.595 43.298 L 172.736 40.437 L 181.204 17.671 L 191.939 38.584 L 199.204 49.51 L 208.748 54.46 L 217.421 55.489 L 224.164 63.665 L 234.888 69.649 L 244.485 72.253 C 244.485 72.253 252.862 84.493 252.969 84.386 C 253.076 84.279 262.614 87.564 262.614 87.564 L 268.418 99.561 L 278.738 95.387 L 289.031 90.116 L 298.208 92.471 L 305.481 92.057 L 313.665 77.492 L 355.75 71.368 L 380.312 57.18 L 391.17 44.247 L 409.36 38.765 L 415 39.531 L 415 109.237 L -10 111.373 L -10 11 36.827 Z"
                        fill="url(#gradient)"
                        stroke={theme === 'light' ? '#aab2bd' : '#34455c'}
                        strokeWidth="1"
                    />
                    <defs>
                        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                                offset="0%"
                                stopColor={theme === 'light' ? '#e2e8f0' : '#64748b'}
                                stopOpacity="1"
                            />
                            <stop
                                offset="100%"
                                stopColor={theme === 'light' ? '#ffffff' : '#000000'}
                                stopOpacity="0.2"
                            />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <div className="flex flex-col items-end justify-center h-[30px] pr-5">
                <div className="h-4 mt-1 w-[50px] rounded-md bg-placeholder animate-pulse"></div>
                <div className="h-4 mt-1 w-[80px] rounded-md bg-placeholder animate-pulse"></div>
            </div>
        </div>
    );
};

const Header = (props: HeaderProps) => {
    const { data, rightView } = props;
    const [defaultDate] = useState<string>(moment().format('MMM DD, YYYY'));
    const [defaultUsdValue, setDefaultUsdValue] = useState<number>(0);
    const [defaultPercentageChange, setDefaultPercentageChange] = useState<number>(0);
    const [defaultUsdChange, setDefaultUsdChange] = useState<number>(0);

    const [selectedDate, setSelectedDate] = useState<string>(moment().format('MMM DD, YYYY'));
    const [selectedUsdValue, setSelectedUsdValue] = useState<number>(0);
    const [selectedPercentageChange, setSelectedPercentageChange] = useState<number>(0);
    const [selectedUsdChange, setSelectedUsdChange] = useState<number>(0);

    const [mode, setMode] = useState<'default' | 'selected'>('default');

    useEffect(() => {
        if (data.length > 0) {
            const _first = data[0];
            const _last = data[data.length - 1];
            setDefaultUsdValue(_last);
            if (_first) {
                setDefaultPercentageChange(((_last - _first) / _first) * 100);
            } else {
                setDefaultPercentageChange(0);
            }
            setDefaultUsdChange(_last - _first);
        }
    }, [data]);

    const { firstValue, lastValue } = useMemo(() => {
        let firstValue = 0;
        let lastValue = 0;
        if (data.length > 0) {
            firstValue = data[0];
            lastValue = data[data.length - 1];
        }
        return { firstValue, lastValue };
    }, [data]);

    const { displayDate, displayValue, percentageChange, usdChange } = useMemo(() => {
        if (mode === 'default') {
            return {
                displayDate: defaultDate,
                displayValue: defaultUsdValue,
                percentageChange: defaultPercentageChange,
                usdChange: defaultUsdChange,
            };
        } else {
            return {
                displayDate: selectedDate,
                displayValue: selectedUsdValue,
                percentageChange: selectedPercentageChange,
                usdChange: selectedUsdChange,
            };
        }
    }, [
        mode,
        defaultDate,
        defaultUsdValue,
        defaultPercentageChange,
        defaultUsdChange,
        selectedDate,
        selectedUsdValue,
        selectedPercentageChange,
        selectedUsdChange,
    ]);

    useEffect(() => {
        const setValue = (data: any) => {
            setMode('selected');
            setSelectedDate(data.date);
            setSelectedUsdValue(data.value);
            if (firstValue) {
                setSelectedPercentageChange(((data.value - firstValue) / firstValue) * 100);
            } else {
                setSelectedPercentageChange(0);
            }
            setSelectedUsdChange(data.value - firstValue);
        };

        const hideTooltip = (data: any) => {
            setMode('default');
        };

        eventManager.on(EVENT_SET_VALUE, setValue);
        eventManager.on(EVENT_HIDE_TOOLTIP, hideTooltip);

        return () => {
            eventManager.off(EVENT_SET_VALUE, setValue);
            eventManager.off(EVENT_HIDE_TOOLTIP, hideTooltip);
        };
    }, [firstValue]);

    return (
        <div className="p-5 flex flex-row justify-between pb-0">
            <div className="flex flex-col items-start">
                <div className="text-slate-400 text-xs mb-2">{displayDate}</div>
                <div className="font-display tabular-nums text-3xl font-medium mb-1" id="chart-price">
                    {formatMoney(displayValue)}
                </div>
                <div className="flex flex-row items-center">
                    {percentageChange >= 0 ? (
                        <IoMdArrowUp className="text-green-500 text-xs" />
                    ) : (
                        <IoMdArrowDown className="text-red-500 text-xs" />
                    )}

                    <div
                        className={
                            'text-sm ' + (percentageChange >= 0 ? 'text-green-500' : 'text-red-500')
                        }>
                        {percentageChange.toFixed(2)}%
                    </div>

                    <div className="text-slate-500 text-sm font-semibold ml-1">
                        ({usdChange > 0 ? '+' : ''}
                        {formatMoney(usdChange)})
                    </div>
                </div>
            </div>
            {rightView}
        </div>
    );
};

const HighestLowest = (props: HighestLowestProps) => {
    const { data, type } = props;

    const [isHover, setIsHover] = useState(false);

    useEffect(() => {
        const setValue = (data: any) => {
            setIsHover(true);
        };

        const hideTooltip = (data: any) => {
            setIsHover(false);
        };

        eventManager.on(EVENT_SET_VALUE, setValue);
        eventManager.on(EVENT_HIDE_TOOLTIP, hideTooltip);

        return () => {
            eventManager.off(EVENT_SET_VALUE, setValue);
            eventManager.off(EVENT_HIDE_TOOLTIP, hideTooltip);
        };
    }, []);

    const { highest, lowest } = useMemo(() => {
        let highest = 0;
        let lowest = 0;
        if (data.length > 0) {
            highest = Math.max(...data);
            lowest = Math.min(...data);
        }
        return { highest, lowest };
    }, [data]);

    return (
        <div className="flex flex-col items-end justify-center h-[30px] pr-5">
            {!isHover && (
                <>
                    <div className="text-xs text-slate-400">
                        {type === 'highest' ? 'Highest' : 'Lowest'}
                    </div>
                    <div className="text-sm font-semibold">
                        {formatMoney(type === 'highest' ? highest : lowest)}
                    </div>
                </>
            )}
        </div>
    );
};

export default React.memo<PriceChartProps>((props: PriceChartProps) => {
    const { lineColor, data, date, rightView } = props;

    const filteredData = useMemo(() => {
        if (data.length > 1) {
            return data;
        } else {
            return [0, 0, 0];
        }
    }, [data]);

    const filteredDate = useMemo(() => {
        if (date.length > 1) {
            return date;
        } else {
            const now = moment().format('MMM DD, YYYY');
            return [now, now, now];
        }
    }, [date]);

    const theme = useActualTheme();

    const SERIES = useMemo(() => {
        return [
            {
                data: filteredData,
                type: 'line',
                smooth: false,
                symbol: 'circle',
                symbolSize: 10,
                showSymbol: false,
                lineStyle: {
                    color: lineColor,
                    width: 2,
                },
                itemStyle: {
                    color: lineColor,
                    borderWidth: 3,
                    borderColor: '#fff',
                },
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        opacity: 1,
                    },
                },
                areaStyle: {
                    // @ts-ignore
                    color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: lineColor },
                        {
                            offset: 1,
                            color:
                                theme === 'dark'
                                    ? 'rgba(105, 196, 238, 0)'
                                    : 'rgba(255, 255, 255, 0)',
                        },
                    ]),
                },
            },
        ];
    }, [filteredData, lineColor, theme]);

    const X_AXIS = useMemo(() => {
        return {
            type: 'category',
            data: filteredDate,
            boundaryGap: false,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { show: false },
        };
    }, [filteredDate]);

    const TOOLTIP = useMemo(() => {
        return {
            trigger: 'axis',
            backgroundColor: theme === 'dark' ? '#1E3A54' : '#fff',
            borderWidth: 1,
            borderColor: theme === 'dark' ? '#2A4159' : '#e2e8f0',
            formatter: function (params: any) {
                const point = params[0];
                const color = theme === 'dark' ? '#fff' : '#000';
                let moneyValue = formatMoney(point.value);

                eventManager.emit(EVENT_SET_VALUE, {
                    value: point.value,
                    date: point.axisValueLabel,
                });

                return `
                    <div style="text-align:left;color: ${color};">
                        <strong>${moneyValue}</strong><br/>
                        <span style="font-size: 12px;">${point.axisValueLabel}</span>
                    </div>
                    `;
            },
            axisPointer: {
                type: 'line',
                lineStyle: {
                    type: 'solid',
                    color: lineColor,
                    width: 1,
                },
                snap: true,
            },
        };
    }, [lineColor, theme]);

    const onHideTip = useCallback(() => {
        eventManager.emit(EVENT_HIDE_TOOLTIP, {});
    }, []);

    return (
        <>
            <Header data={filteredData} rightView={rightView} />

            <HighestLowest type="highest" data={filteredData} />

            <Echarts
                style={{
                    height: '150px',
                    width: '100%',
                }}
                grid={GRID}
                tooltip={TOOLTIP}
                xAxis={X_AXIS}
                yAxis={Y_AXIS}
                series={SERIES}
                onHideTip={onHideTip}
            />

            <HighestLowest type="lowest" data={filteredData} />
        </>
    );
});
