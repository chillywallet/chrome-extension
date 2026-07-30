import moment from 'moment';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
//@ts-ignore
import { useExtractColor } from 'react-extract-colors';
import { FiShoppingCart } from 'react-icons/fi';
import { HiArrowUpRight } from 'react-icons/hi2';
import { MdAttachMoney, MdSwapVert } from 'react-icons/md';
import { useHistory } from 'react-router-dom';
import { zeroAddress } from 'viem';
import { MarketRequest } from '../../api/graphQL';
import {
    ENVIRONMENT_TYPE_FULLSCREEN,
    ENVIRONMENT_TYPE_SIDEPANEL,
    PRIMARY_COLOR,
} from '../../shared/constants/app';
import {
    DEFAULT_ROUTE,
    FIAT_OFF_RAMP_ROUTE,
    FIAT_ON_RAMP_ROUTE,
} from '../../shared/constants/routes';
import { ChartFilterType } from '../../shared/types/Chart';
import { Coin, PlatformCoin, Transaction } from '../../shared/types/Wallet';
import { Images } from '../../shared/utils/Images';
import { getTokenTransactionHistory } from '../../shared/utils/portfolio';
import { isEqualCaseInsensitive } from '../../shared/utils/string';
import { getEnvironmentType } from '../../shared/utils/utils';
import { useIsTestnet, useSelectedNetwork } from '../../store/selectors';
import PriceChart, { PriceChartPlaceholder } from '../components/PriceChart';
import Header from '../components/Header';
import SafeImage from '../components/SafeImage';
import TransactionCard, { Placeholder } from '../components/TransactionCard';
import TransactionDetailModal from '../components/TransactionDetailModal';
import WalletTag from '../components/WalletTag';
import { useRoutesData } from './RoutesProvider';

type Props = {};

let cachedData: {
    day?: any[];
    week?: any[];
    month?: any[];
    year?: any[];
    all?: any[];
} = {};

const CHART_LABELS: Record<string, string> = {
    day: '24H',
    week: '1 W',
    month: '1 M',
    year: '1 Y',
    all: 'ALL',
};

export default React.memo<Props>((props: Props) => {
    const { sendAssetViewData, onCoinSendPress, onCoinSwapPress } = useRoutesData();
    const coin = sendAssetViewData?.coinToSend;
    const isAAWallet = sendAssetViewData?.isAAWallet ?? false;

    const history = useHistory();

    const [chartTypes] = useState(['day', 'week', 'month', 'year', 'all'] as ChartFilterType[]);
    const [selectedType, setSelectedType] = useState<ChartFilterType>('day');

    const selectedNetwork = useSelectedNetwork();
    const isTestnet = useIsTestnet();

    const [chartLoading, setChartLoading] = useState(false);
    const [chartData, setChartData] = useState<any[]>([]);
    const [transactionsLoading, setTransactionsLoading] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [{ isShowTransactionDetail, transactionDetailData }, setTransactionDetail] = useState<{
        transactionDetailData?: Transaction;
        isShowTransactionDetail: boolean;
    }>({
        isShowTransactionDetail: false,
    });

    const { darkerColor } = useExtractColor(coin?.logo);

    const isNativeCoin = useMemo(() => {
        return coin && selectedNetwork
            ? isEqualCaseInsensitive(coin.token_address, selectedNetwork.native_coin_address)
            : false;
    }, [coin, selectedNetwork]);

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

    const canSwap = useMemo(() => {
        return !isAAWallet && selectedNetwork?.swapSupport;
    }, [selectedNetwork, isAAWallet]);

    const getChartData = useCallback((coin: Coin, type: ChartFilterType = 'day') => {
        //@ts-ignore
        if (cachedData[type]) {
            //@ts-ignore
            const cacheChartData = cachedData[type] ?? [];
            setChartData(cacheChartData);
        } else {
            setChartLoading(true);

            // Approximation: historical price of the coin scaled by the current
            // balance (per-datapoint historical balances were a backend feature).
            MarketRequest.getCoinChartData(coin.token_id, type)
                .then(result => {
                    const quotes = result?.data?.quotes?.[0]?.quotes ?? [];
                    const balance = (coin as any).total ?? (coin as any).coin_balance ?? 0;
                    const chart = quotes.map((quote: any) => ({
                        y: quote.price * balance,
                        x: moment(quote.last_updated).unix(),
                    }));

                    const newData = { ...cachedData, [type]: chart };
                    cachedData = newData;
                    setChartData(chart);
                })
                .catch(e => {
                    setChartData([]);
                })
                .finally(() => {
                    setChartLoading(false);
                });
        }
    }, []);

    const loadTransactions = useCallback(
        (_address: string, _platform_id: number, token_address: string, page: number = 1) => {
            if (_address) {
                setTransactionsLoading(true);

                setHasMore(false);
                getTokenTransactionHistory(_address, _platform_id, token_address, page)
                    .then(response => {
                        if (response.pagination.page === 1) {
                            setTransactions(response.data);
                        } else {
                            setTransactions([...transactions, ...response.data]);
                        }
                        setPage(response.pagination.page + 1);
                        setHasMore(response.pagination.hasNextPage);
                        setTransactionsLoading(false);
                    })
                    .catch(() => {
                        setTransactionsLoading(false);
                    });
            }
        },
        [transactions],
    );

    const handleFiatOnOffRampNavigation = useCallback(
        (route: string) => {
            const params = new URLSearchParams();

            if (coin?.token_address && selectedNetwork?.chain_id) {
                params.append('contractAddress', isNativeCoin ? zeroAddress : coin.token_address);
                params.append('chainId', selectedNetwork.chain_id.toString());
            }

            const queryString = params.toString();
            const url = queryString ? `${route}?${queryString}` : route;
            const environmentType = getEnvironmentType();

            if (
                environmentType === ENVIRONMENT_TYPE_FULLSCREEN ||
                environmentType === ENVIRONMENT_TYPE_SIDEPANEL
            ) {
                history.push(url);
            } else {
                global.platform.openExtensionInBrowser(url);
            }
        },
        [coin, selectedNetwork, history, isNativeCoin],
    );

    const onSwapPress = useCallback(() => {
        if (coin && canSwap) {
            const _fromCoin: PlatformCoin = {
                name: coin.coin_name,
                id: 1_000_000_000,
                rank: 0,
                logo_lrg: '',
                symbol: coin.symbol ?? '',
                coinAddress: coin.token_address,
                coinId: coin.token_id,
                icon: coin.icon,
                logo: coin.logo ?? '',
                platformId: coin.platform_id,
                is_verified: coin.is_verified,
                latest: {
                    price: 1,
                    percent_change_24h: 0,
                },
            };
            onCoinSwapPress(_fromCoin);
        }
    }, [coin, canSwap, onCoinSwapPress]);

    useEffect(() => {
        if (!coin) {
            history.replace(DEFAULT_ROUTE);
        }
    }, [coin, history]);

    useEffect(() => {
        cachedData = {};

        if (coin) {
            getChartData(coin, 'day');
            loadTransactions(coin.wallet_address, coin.platform_id, coin.token_address, 1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coin, getChartData]);

    return (
        <>
            <Header
                title={
                    <div className="flex flex-row items-center gap-2">
                        <SafeImage
                            src={(coin?.icon ? coin.icon : coin?.logo) ?? ''}
                            className="w-8 h-8 rounded-full"
                            alt="Logo"
                            fallback={Images.iconQuestion}
                        />

                        <div>{coin?.coin_name ?? 'Unknown'}</div>
                    </div>
                }
                action={<WalletTag isAAWallet={isAAWallet} />}
            />

            <div className="h-[calc(100vh-52px)] sm:h-[calc(100vh-90px)] overflow-y-auto overflow-x-hidden">
                {lineColor && !chartLoading && data.length > 0 ? (
                    <PriceChart data={data} date={date} lineColor={lineColor} />
                ) : (
                    <PriceChartPlaceholder />
                )}

                <div className="px-10 flex flex-row items-center justify-center gap-3 text-xs">
                    {chartTypes.map(type => {
                        const selected = type === selectedType;
                        const label = CHART_LABELS[type];
                        return (
                            <button
                                key={type}
                                className={`rounded-md px-4 py-2 ${
                                    selected
                                        ? 'bg-primary text-white'
                                        : 'bg-transparent text-slate-500'
                                }`}
                                onClick={() => {
                                    setSelectedType(type);

                                    if (coin) {
                                        getChartData(coin, type);
                                    }
                                }}>
                                {label}
                            </button>
                        );
                    })}
                </div>

                <div className="px-4 sm:px-10 py-4">
                    <div className="bg-white dark:bg-dark rounded-2xl border border-slate-200 dark:border-darkline/60">
                        <div className="flex flex-row items-center justify-around h-24">
                            {/* Buy Button */}
                            <button
                                className={`flex flex-col items-center w-20 transition-opacity ${
                                    isAAWallet || isTestnet
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'cursor-pointer hover:opacity-80'
                                }`}
                                disabled={isAAWallet || isTestnet}
                                onClick={() => {
                                    if (!isAAWallet && !isTestnet) {
                                        handleFiatOnOffRampNavigation(FIAT_ON_RAMP_ROUTE);
                                    }
                                }}>
                                <div
                                    className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 shadow-sm ${
                                        isAAWallet || isTestnet
                                            ? 'bg-gray-300 dark:bg-gray-600'
                                            : 'bg-primary'
                                    }`}>
                                    <FiShoppingCart className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-xs font-medium text-gray-900 dark:text-white">
                                    Buy
                                </span>
                            </button>

                            {/* Sell Button */}
                            <button
                                className={`flex flex-col items-center w-20 transition-opacity ${
                                    isAAWallet || isTestnet
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'cursor-pointer hover:opacity-80'
                                }`}
                                disabled={isAAWallet || isTestnet}
                                onClick={() => {
                                    if (!isAAWallet && !isTestnet) {
                                        handleFiatOnOffRampNavigation(FIAT_OFF_RAMP_ROUTE);
                                    }
                                }}>
                                <div
                                    className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 shadow-sm ${
                                        isAAWallet || isTestnet
                                            ? 'bg-gray-300 dark:bg-gray-600'
                                            : 'bg-primary'
                                    }`}>
                                    <MdAttachMoney className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-xs font-medium text-gray-900 dark:text-white">
                                    Sell
                                </span>
                            </button>

                            {/* Send Button */}
                            <button
                                className={`flex flex-col items-center w-20 transition-opacity ${
                                    !coin
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'cursor-pointer hover:opacity-80'
                                }`}
                                disabled={!coin}
                                onClick={() => {
                                    if (coin) {
                                        onCoinSendPress(coin, isAAWallet);
                                    }
                                }}>
                                <div className="w-11 h-11 bg-primary rounded-full flex items-center justify-center mb-1.5 shadow-sm">
                                    <HiArrowUpRight className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-xs font-medium text-gray-900 dark:text-white">
                                    Send
                                </span>
                            </button>

                            {/* Swap Button */}
                            <button
                                className={`flex flex-col items-center w-20 transition-opacity ${
                                    !canSwap || !coin
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'cursor-pointer hover:opacity-80'
                                }`}
                                disabled={!canSwap || !coin}
                                onClick={onSwapPress}>
                                <div
                                    className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 shadow-sm ${
                                        !canSwap || !coin
                                            ? 'bg-gray-300 dark:bg-gray-600'
                                            : 'bg-primary'
                                    }`}>
                                    <MdSwapVert className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-xs font-medium text-gray-900 dark:text-white">
                                    Swap
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-3 py-3 sticky top-0 bg-white dark:bg-darker z-10">
                    Latest Transactions
                </div>

                <div className="">
                    {transactions.length > 0 ? (
                        transactions.map((_history, index) => (
                            <TransactionCard
                                key={index}
                                data={_history}
                                onPress={() => {
                                    setTransactionDetail({
                                        transactionDetailData: _history,
                                        isShowTransactionDetail: true,
                                    });
                                }}
                            />
                        ))
                    ) : (
                        <>
                            {!transactionsLoading && (
                                <p className="text-sm text-gray-400 text-center pt-3">
                                    There are no transactions
                                </p>
                            )}
                        </>
                    )}

                    {hasMore && !transactionsLoading && (
                        <button
                            className="w-full p-3 text-center text-sm text-gray-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                            onClick={() => {
                                if (coin) {
                                    loadTransactions(
                                        coin.wallet_address ?? '',
                                        coin.platform_id,
                                        coin.token_id,
                                        page,
                                    );
                                }
                            }}>
                            Load more
                        </button>
                    )}

                    {transactionsLoading &&
                        [...Array(2)].map((_, index) => <Placeholder key={index} />)}
                </div>
            </div>

            <TransactionDetailModal
                visible={isShowTransactionDetail}
                data={transactionDetailData}
                onClosePress={() => setTransactionDetail({ isShowTransactionDetail: false })}
            />
        </>
    );
});
