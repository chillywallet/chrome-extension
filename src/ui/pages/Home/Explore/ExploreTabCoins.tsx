import _ from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaRegStar, FaSpinner, FaStar } from 'react-icons/fa';
import { MarketRequest } from '../../../../api/graphQL';
import logger from '../../../../shared/utils/logger';
import { setFavoriteCoins } from '../../../../store/actions/uiActions';
import { useActualTheme,  usePreferences } from '../../../../store/selectors';
import { useAppDispatch } from '../../../../store/store';
import MarketCoinCard from '../../../components/MarketCoinCard';
import ScrollWithButton from '../../../components/ScrollWithButton';
import TextInput from '../../../components/TextInput';
import { useRoutesData } from '../../RoutesProvider';

type Props = {};

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
                <p className="animate-pulse bg-placeholder h-5 w-16 mb-2 rounded-md"></p>
                <p className="animate-pulse bg-placeholder h-3 w-8 rounded-md"></p>
            </div>
        </div>
    );
};

const PAGING_LIMIT = 20;

const ExploreTabCoins = React.memo<Props>((props: Props) => {
    const dispatch = useAppDispatch();
    const { favoriteCoins = [] } = usePreferences();
    const theme = useActualTheme();

    const { onMarketCoinPress } = useRoutesData();
    const {
        exploreCoinData,
        coinSearchText,
        setCoinSearchText,
        setExploreCoinData,
        isFavorite,
        setIsFavorite,
    } = useRoutesData();

    const { data, offset, hasMore } = exploreCoinData;

    const [firstLoad, setFirstLoad] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const filteredFavoriteCoins = useMemo(() => {
        const searchText = (coinSearchText ?? '').trim().toLowerCase();
        return searchText === ''
            ? favoriteCoins
            : favoriteCoins.filter(
                  _coin =>
                      (_coin.name ?? '').toLowerCase().includes(searchText) ||
                      (_coin.symbol ?? '').toLowerCase().includes(searchText),
              );
    }, [favoriteCoins, coinSearchText]);

    const loadFavoriteCoins = useCallback(
        (coinIds: string[]) => {
            if (coinIds.length === 0) {
                return Promise.resolve();
            }

            logger.log('loadFavoriteCoins', coinIds);
            setIsLoading(true);
            return MarketRequest.getCoinsByIds(coinIds, true)
                .then(result => {
                    if (result?.data?.coins?.data) {
                        const { data: newData } = result.data.coins;
                        dispatch(setFavoriteCoins(newData));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    setIsLoading(false);
                });
        },
        [dispatch],
    );

    const loadCoins = useCallback(
        (name: string, _offset: number, reset: boolean, showSearching: boolean) => {
            logger.log('loadCoins', name);

            setIsLoading(true);
            showSearching && setIsSearching(true);
            return MarketRequest.getCoins(name, PAGING_LIMIT, _offset, true)
                .then(result => {
                    if (result?.data?.coins?.data) {
                        const { data: newData, pagination } = result.data.coins;

                        //@ts-ignore
                        setExploreCoinData(prevData => ({
                            data: reset ? newData : [...prevData.data, ...newData],
                            offset: _offset,
                            hasMore:
                                pagination.length > 0
                                    ? pagination[0].page < pagination[0].last
                                    : false,
                        }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    setIsLoading(false);
                    showSearching && setIsSearching(false);
                });
        },
        [setExploreCoinData],
    );

    const debouncedLoadData = useMemo(() => {
        return _.debounce((name: string) => {
            loadCoins(name, 0, true, true);
        }, 500);
    }, [loadCoins]);

    const onTextChange = useCallback(
        (e: any) => {
            const text = e.target.value;
            setCoinSearchText(text);

            if (!isFavorite) {
                debouncedLoadData(text);
            }
        },
        [debouncedLoadData, isFavorite, setCoinSearchText],
    );

    useEffect(() => {
        setFirstLoad(true);
        setCoinSearchText('');

        if (isFavorite) {
            const coinIds = favoriteCoins?.map(coin => coin.coinId);
            loadFavoriteCoins(coinIds).then(() => setFirstLoad(false));
        } else {
            loadCoins('', 0, true, false).then(() => setFirstLoad(false));
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadFavoriteCoins, loadCoins, isFavorite]);

    const onLoadMore = useCallback(() => {
        const nextOffset = offset + PAGING_LIMIT;
        loadCoins(coinSearchText, nextOffset, false, false); // Do not reset data
    }, [coinSearchText, loadCoins, offset]);

    const scrollClass = 'h-[calc(100vh-196px)] sm:h-[calc(100vh-40px-196px)]';

    const tooltipVariant = useMemo(() => {
        return theme === 'dark' ? 'light' : 'dark';
    }, [theme]);

    return (
        <div className="relative">
            <div className="px-3 pt-3 flex flex-row items-center mb-3">
                {isFavorite ? (
                    <div
                        className="cursor-pointer border dark:border-darker rounded-full w-8 h-8 flex items-center justify-center mr-2"
                        data-tooltip-id="chilly-tooltip"
                        data-tooltip-variant={tooltipVariant}
                        data-tooltip-content="Show all coins"
                        data-tooltip-place="top"
                        onClick={() => {
                            setIsFavorite(false);
                        }}>
                        <FaStar size={18} className="text-yellow-500" />
                    </div>
                ) : (
                    <div
                        className="cursor-pointer border dark:border-darker rounded-full w-8 h-8 flex items-center justify-center mr-2"
                        data-tooltip-id="chilly-tooltip"
                        data-tooltip-variant={tooltipVariant}
                        data-tooltip-content="Show favorite coins"
                        data-tooltip-place="top"
                        onClick={() => {
                            setIsFavorite(true);
                        }}>
                        <FaRegStar size={18} />
                    </div>
                )}
                <div className="flex flex-col flex-1">
                    <TextInput
                        type="text"
                        placeholder="Search for coin"
                        value={coinSearchText}
                        onChange={onTextChange}
                    />
                </div>
            </div>

            {isSearching && (
                <div className="absolute top-12 left-0 w-full">
                    <div className="flex flex-row items-center justify-center">
                        <div className="flex flex-row items-center justify-center px-3 py-2 bg-white dark:bg-darker border rounded-md cursor-default">
                            <FaSpinner className="custom-anim-fast text-3lg z-999" />

                            <div className="ml-2 text-sm">Searching</div>
                        </div>
                    </div>
                </div>
            )}

            <ScrollWithButton className={'overflow-auto ' + scrollClass}>
                {isFavorite ? (
                    <div className="flex flex-col divide-y dark:divide-darker">
                        {filteredFavoriteCoins.map((coin, index) => (
                            <MarketCoinCard key={index} coin={coin} onClick={onMarketCoinPress} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col divide-y dark:divide-darker">
                        {data.map((coin, index) => (
                            <MarketCoinCard key={index} coin={coin} onClick={onMarketCoinPress} />
                        ))}

                        {hasMore && !firstLoad && !isSearching && (
                            <button
                                disabled={isLoading}
                                className="w-full p-3 text-center text-sm text-gray-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                                onClick={onLoadMore}>
                                {isLoading ? 'Loading...' : 'Load more'}
                            </button>
                        )}

                        {firstLoad && [...Array(5)].map((_, index) => <Placeholder key={index} />)}
                    </div>
                )}
            </ScrollWithButton>
        </div>
    );
});

export default ExploreTabCoins;
