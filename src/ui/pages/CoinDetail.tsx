import { formatMoney, formatNumber } from '../../shared/utils/format';
import moment from 'moment';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
//@ts-ignore
import { useExtractColor } from 'react-extract-colors';
import { FaInfinity } from 'react-icons/fa';
import { MdOutlineRefresh } from 'react-icons/md';
import { useHistory } from 'react-router-dom';
import { MarketRequest } from '../../api/graphQL';
import { PRIMARY_COLOR } from '../../shared/constants/app';
import { DEFAULT_ROUTE } from '../../shared/constants/routes';
import { ChartFilterType } from '../../shared/types/Chart';
import { Images } from '../../shared/utils/Images';
import { setFavoriteCoins } from '../../store/actions/uiActions';
import { useActualTheme, usePreferences } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import ChartFilterButtons from '../components/ChartFilterButtons';
import FavoriteButton from '../components/FavoriteButton';
import PriceChart, { PriceChartPlaceholder } from '../components/PriceChart';
import Header from '../components/Header';
import MarketStatRow from '../components/MarketStatRow';
import SafeImage from '../components/SafeImage';
import Toast from '../components/Toast';
import { useRoutesData } from './RoutesProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const { coin } = useRoutesData();

    const dispatch = useAppDispatch();
    const history = useHistory();
    const theme = useActualTheme();
    const { favoriteCoins } = usePreferences();

    const cachedDataRef = useRef<Partial<Record<ChartFilterType, any[]>>>({});

    const isFavorite = useMemo(() => {
        return favoriteCoins?.find(item => item.coinId === coin?.coinId) !== undefined;
    }, [coin, favoriteCoins]);

    const { max_supply = null, symbol = '', latest, rank = '' } = coin ?? {};
    const { fully_diluted_market_cap = null } = latest ?? {};

    const [chartTypes] = useState(['day', 'week', 'month', 'year', 'all'] as ChartFilterType[]);
    const [selectedType, setSelectedType] = useState<ChartFilterType>('day');

    const [chartLoading, setChartLoading] = useState(false);
    const [chartData, setChartData] = useState<any[]>([]);

    const { darkerColor } = useExtractColor(coin?.logo);

    const lineColor = useMemo(() => {
        if (darkerColor) {
            return darkerColor;
        }

        return PRIMARY_COLOR;
    }, [darkerColor]);

    const { date, data } = useMemo(() => {
        let date: string[] = [];
        let data: number[] = [];
        chartData.forEach(item => {
            date.push(moment.unix(item.x).format('MMM DD, HH:mm'));
            data.push(item.y);
        });
        return { date, data };
    }, [chartData]);

    const getChartData = useCallback((_id: string, type: ChartFilterType = 'day') => {
        if (cachedDataRef.current[type]) {
            const cacheChartData = cachedDataRef.current[type] ?? [];
            setChartData(cacheChartData);
        } else {
            setChartLoading(true);
            MarketRequest.getCoinChartData(_id, type)
                .then(result => {
                    setChartLoading(false);
                    let chart: Array<{ x: number; y: number }> = [];

                    if (result?.data?.quotes?.length) {
                        const { quotes } = result?.data?.quotes[0];
                        chart = quotes.map((quote: any) => ({
                            y: quote.price,
                            x: moment(quote.last_updated).unix(),
                        }));
                    }

                    const newData = { ...cachedDataRef.current, [type]: chart };
                    cachedDataRef.current = newData;
                    setChartData(chart);
                })
                .catch(() => {
                    setChartLoading(false);
                    setChartData([]);
                });
        }
    }, []);

    const setCoinInfo = useCallback(
        (_coin: any, type: ChartFilterType) => {
            if (_coin) {
                cachedDataRef.current = {};
                getChartData(_coin.coinId, type);
            }
        },
        [getChartData],
    );

    useEffect(() => {
        if (coin?.coinId) {
            getChartData(coin.coinId, selectedType);
        }
    }, [coin, getChartData, selectedType]);

    useEffect(() => {
        if (!coin) {
            history.replace(DEFAULT_ROUTE);
        }
    }, [coin, history]);

    const addToFavoritePress = useCallback(async () => {
        const newFavorite = favoriteCoins ?? [];
        if (coin) {
            await dispatch(setFavoriteCoins([...newFavorite, coin]));
            Toast.showSuccess('Coin added to favorites');
        }
    }, [coin, dispatch, favoriteCoins]);

    const removeFromFavoritePress = useCallback(async () => {
        if (coin) {
            const newFavorite = favoriteCoins?.filter(item => item.coinId !== coin.coinId);
            await dispatch(setFavoriteCoins(newFavorite));
            Toast.showSuccess('Coin removed from favorites');
        }
    }, [coin, dispatch, favoriteCoins]);

    return (
        <>
            <Header
                title={
                    <div className="flex flex-row items-center gap-2">
                        <SafeImage
                            src={coin?.logo ?? ''}
                            className="w-8 h-8 rounded-full"
                            alt="Logo"
                            fallback={Images.iconQuestion}
                        />

                        <div>{coin?.name ?? 'Unknown'}</div>
                    </div>
                }
                action={
                    <div className="flex flex-row gap-3">
                        <FavoriteButton
                            isFavorite={isFavorite}
                            onAdd={addToFavoritePress}
                            onRemove={removeFromFavoritePress}
                        />

                        {chartLoading ? (
                            <MdOutlineRefresh size={18} className="custom-anim-fast" />
                        ) : (
                            <div
                                className="cursor-pointer w-5"
                                data-tooltip-id="chilly-tooltip"
                                data-tooltip-variant={theme === 'dark' ? 'light' : 'dark'}
                                data-tooltip-content="Refresh Chart Data"
                                data-tooltip-place="top"
                                onClick={() => {
                                    cachedDataRef.current[selectedType] = undefined;
                                    setCoinInfo({ ...coin }, selectedType);
                                }}>
                                <MdOutlineRefresh size={18} />
                            </div>
                        )}
                    </div>
                }
            />

            <div>
                {lineColor && !chartLoading && data.length > 0 ? (
                    <PriceChart data={data} date={date} lineColor={lineColor} />
                ) : (
                    <PriceChartPlaceholder />
                )}

                <ChartFilterButtons
                    chartTypes={chartTypes}
                    selectedType={selectedType}
                    onTypeChange={setSelectedType}
                />

                <div className="px-3 mb-3 mt-4">Market Statistics</div>

                <div className="px-3">
                    <MarketStatRow
                        label="Market Capitalization"
                        value={
                            fully_diluted_market_cap === null
                                ? 'N/A'
                                : fully_diluted_market_cap === 0
                                ? '--'
                                : `${formatMoney(fully_diluted_market_cap)}`
                        }
                    />

                    <MarketStatRow
                        label="Maximum Supply"
                        value={
                            max_supply === null ? (
                                <FaInfinity />
                            ) : (
                                <div>{`${formatNumber(max_supply)} ${symbol}`}</div>
                            )
                        }
                    />

                    <MarketStatRow label="Ranking" value={rank !== null ? rank : 'N/A'} />
                </div>
            </div>
        </>
    );
});
