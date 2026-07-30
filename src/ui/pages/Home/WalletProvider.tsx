import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { ethers, getAddress } from 'ethers';
import { useDispatch } from 'react-redux';
import CoinsUtils from '../../../lib/CoinsUtils';
import { isNativeCoinByTokenAddress } from '../../../lib/WalletUtils';
import { REFRESH_WALLET_INTERVAL } from '../../../shared/constants/number';
import EventType from '../../../shared/types/EventType';
import { Coin, CoinPrice, Pagination } from '../../../shared/types/Wallet';
import eventManager from '../../../shared/utils/eventManager';
import logger from '../../../shared/utils/logger';
import {
    getCoinHoldings,
    getNftHoldings,
    getTransactionHistory,
    importPortfolioWallet,
} from '../../../shared/utils/portfolio';
import { isEqualCaseInsensitive } from '../../../shared/utils/string';
import {
    getTokenBalance,
    setCoinPrices,
    setPortfolioCoins,
    setPortfolioNfts,
    setPortfolioTransactions,
    updatePortfolioCoins,
} from '../../../store/actions/uiActions';
import {
    useActualTheme,
    useIsTestnet,
    
    usePortfolioCoins,
    usePortfolioNfts,
    usePortfolioTransactions,
    useSelectedNetwork,
} from '../../../store/selectors';
import { useCurrentPlatformId } from '../../../store/selectors/wallet';
import Toast from '../../components/Toast';

type WalletContextType = {
    containerClass: string;
    tooltipText: string;
    tooltipVariant: 'dark' | 'light';
    currentTotalCoins: number;
    isLoading: boolean;
    hasMore: boolean;
    onAddressPress: () => void;
    loadData: () => void;
    onLoadMore: () => void;
    loadNfts: (page: number) => void;
    nftPagination: Pagination | null;
    loadingNftsRef: React.MutableRefObject<boolean>;
    loadingMoreNfts: boolean;
    showAllCoins: boolean;
    setShowAllCoins: (show: boolean) => void;
    onShowMoreCoins: () => void;
    onShowLessCoins: () => void;
    filteredCoins: Coin[];
    hasHiddenCoins: boolean;
};

export const WalletContext = createContext<WalletContextType>({
    containerClass: '',
    tooltipText: '',
    tooltipVariant: 'light',
    currentTotalCoins: 0,
    isLoading: false,
    hasMore: false,
    onAddressPress: () => {},
    loadData: () => {},
    onLoadMore: () => {},
    loadNfts: () => {},
    nftPagination: null,
    loadingNftsRef: { current: false },
    loadingMoreNfts: false,
    showAllCoins: false,
    setShowAllCoins: () => {},
    onShowMoreCoins: () => {},
    onShowLessCoins: () => {},
    filteredCoins: [],
    hasHiddenCoins: false,
});

export const useWalletData = () => {
    return useContext(WalletContext);
};

type Props = {
    isSmartWallet: boolean;
    walletAddress?: string;
    otherAddress?: string;
    children: React.ReactNode;
};

export default function WalletProvider(props: Props) {
    const { isSmartWallet, walletAddress, otherAddress } = props;
    const actualTheme = useActualTheme();
    const dispatch = useDispatch();

    const loadingCoinsRef = useRef(false);
    const refreshTimestampRef = useRef(0);
    const newSmartWalletRef = useRef(!isSmartWallet ? otherAddress : undefined);
    const loadingNftsRef = useRef(false);

    const selectedNetwork = useSelectedNetwork();
    const platformId = useCurrentPlatformId();
    const portfolioCoins = usePortfolioCoins(walletAddress);
    const nfts = usePortfolioNfts(walletAddress);
    const nftsRef = useRef(nfts);
    const transactions = usePortfolioTransactions(walletAddress);
    const isTestnet = useIsTestnet();

    const [tooltipText, setTooltipText] = useState('Click to Copy Address');
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [currentTotalCoins, setCurrentTotalCoins] = useState(0);
    const [nftPagination, setNftPagination] = useState<Pagination | null>(null);
    const [loadingMoreNfts, setLoadingMoreNfts] = useState(false);
    const [showAllCoins, setShowAllCoins] = useState(false);
    const showAllCoinsRef = useRef(false);

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    const filteredCoins = useMemo(() => {
        if (showAllCoins) {
            return portfolioCoins;
        }

        return portfolioCoins.filter(coin => {
            // Explicitly shown - always show
            if (coin.is_hidden === false) {
                return true;
            }
            // Explicitly hidden - always hide
            if (coin.is_hidden === true) {
                return false;
            }
            // Default behavior: show verified/custom tokens, hide others
            return coin.is_verified || coin.is_custom;
        });
    }, [portfolioCoins, showAllCoins]);

    const hasHiddenCoins = useMemo(() => {
        // Check if there are any tokens that should be hidden:
        // 1. Explicitly hidden tokens (is_hidden === true)
        // 2. Unverified, non-custom tokens that are not explicitly shown (is_hidden !== false)
        return portfolioCoins.some(coin => {
            // Explicitly hidden
            if (coin.is_hidden === true) {
                return true;
            }

            // Explicitly shown - not hidden
            if (coin.is_hidden === false) {
                return false;
            }

            // Default behavior: unverified, non-custom tokens are hidden
            return !coin.is_verified && !coin.is_custom;
        });
    }, [portfolioCoins]);

    const loadCoinBalances = useCallback(
        (
            _walletAddress: string,
            _data: Coin[],
            coinPrices: CoinPrice | null = null,
            _platformId: number,
            callback?: () => void,
        ) => {
            if (_walletAddress && _data && _data.length > 0) {
                logger.log('💎 Load Coins Balance', _data.length);
                const tasks: any[] = [];
                let tokenAddresses: string[] = [];
                let _priceData: CoinPrice = {};

                _data.forEach(coin => {
                    if (coin.token_address) {
                        tokenAddresses.push(coin.token_address);
                    }

                    if (_walletAddress) {
                        const _isNativeCoin = isNativeCoinByTokenAddress(
                            selectedNetwork.chain_key,
                            coin.token_address,
                        );

                        const task = getTokenBalance(
                            _walletAddress,
                            coin.token_address,
                            _isNativeCoin,
                            selectedNetwork.chain_id,
                        ).then(({ balance: _balance, decimals, error }) => {
                            if (!error) {
                                let finalBalance = Number(ethers.formatUnits(_balance, decimals));
                                coin.coin_balance = finalBalance;

                                if (selectedNetwork.testnet && _isNativeCoin) {
                                    setCurrentTotalCoins(finalBalance);
                                }

                                eventManager.emit(
                                    EventType.REFRESH_WALLET_COIN_BALANCE,
                                    finalBalance,
                                    _platformId,
                                    _walletAddress,
                                    coin.token_address,
                                );
                            }
                        });

                        tasks.push(task);
                    }
                });

                if (!isTestnet) {
                    if (coinPrices === null) {
                        const priceTask = CoinsUtils.getCoinsByTokenAddresses(
                            _platformId,
                            tokenAddresses,
                        )
                            .then(result => {
                                const keys = Object.keys(result);

                                if (keys.length > 0) {
                                    keys.forEach(key => {
                                        eventManager.emit(
                                            EventType.REFRESH_WALLET_COIN_PRICE,
                                            result[key].usdPrice,
                                            _platformId,
                                            key,
                                            _walletAddress,
                                        );
                                    });

                                    _priceData = result;
                                    dispatch(setCoinPrices(_platformId, result));
                                }
                            })
                            .catch(() => {});

                        tasks.push(priceTask);
                    } else {
                        _priceData = coinPrices;
                    }
                }

                Promise.all(tasks).then(() => {
                    const keys = Object.keys(_priceData);

                    if (keys.length > 0) {
                        keys.forEach(key => {
                            const index = _data.findIndex(item =>
                                isEqualCaseInsensitive(item.token_address, key),
                            );

                            if (_priceData) {
                                _data[index].coin_price = _priceData[key].usdPrice;
                            }
                        });
                    }

                    dispatch(updatePortfolioCoins(_walletAddress, _platformId, _data));

                    callback && callback();
                });
            } else {
                callback && callback();
            }
        },
        [dispatch, isTestnet, selectedNetwork],
    );

    const onShowMoreCoins = useCallback(() => {
        if (walletAddress && platformId) {
            setShowAllCoins(true);
            loadCoinBalances(walletAddress, portfolioCoins, null, platformId);
        }
    }, [walletAddress, platformId, portfolioCoins, loadCoinBalances]);

    const onShowLessCoins = useCallback(() => {
        setShowAllCoins(false);
    }, []);

    const onAddressPress = useCallback(() => {
        if (walletAddress) {
            //copy to clipboard
            navigator.clipboard.writeText(getAddress(walletAddress));
            setTooltipText('Copied');

            setTimeout(() => {
                setTooltipText('Click to Copy Address');
            }, 2000);
        }
    }, [walletAddress]);

    const walletImport = useCallback(
        (_address: string, _isSmartWallet: boolean, otherAddress?: string) => {
            if (_address) {
                importPortfolioWallet(
                    dispatch,
                    _address,
                    platformId,
                    true,
                    (error, status) => {
                        if (!error && status === 'failed') {
                            Toast.showError(
                                'Oops, we could not import the wallet. Please try again later.',
                            );
                        }
                    },
                    true,
                    _isSmartWallet,
                    otherAddress,
                );
            }
        },
        [dispatch, platformId],
    );

    const loadCoins = useCallback(
        (_address: string, _platform_id: number) => {
            if (_address) {
                loadingCoinsRef.current = true;
                setIsLoading(true);

                getCoinHoldings(_address, true, _platform_id, true, true)
                    .then(response => {
                        const _coins = response.assets.groupByCoins.map(_group => {
                            const { items, ...rest } = _group;
                            return rest;
                        });

                        dispatch(setPortfolioCoins(_address, _platform_id, _coins));

                        const needLoadBalance = showAllCoinsRef.current
                            ? _coins
                            : _coins.filter(
                                  coin =>
                                      coin.is_hidden === false ||
                                      ((coin.is_verified || coin.is_custom) &&
                                          coin.is_hidden !== true),
                              );

                        loadCoinBalances(_address, needLoadBalance, null, _platform_id, () => {
                            setIsLoading(false);
                            loadingCoinsRef.current = false;
                        });

                        if (_coins.length === 0) {
                            walletImport(_address, isSmartWallet, otherAddress);
                        }
                    })
                    .catch(error => {
                        logger.log('getHoldings error', error);
                        setIsLoading(false);
                        loadingCoinsRef.current = false;
                    });
            }
        },
        [dispatch, loadCoinBalances, walletImport, isSmartWallet, otherAddress],
    );

    const loadNfts = useCallback(
        (page: number = 1) => {
            if (walletAddress && platformId && !loadingNftsRef.current) {
                loadingNftsRef.current = true;
                if (!nftsRef.current.length) {
                    eventManager.emit(EventType.NFT_LOADING_STATUS, true);
                } else {
                    // Loading more NFTs (pagination)
                    setLoadingMoreNfts(true);
                }

                logger.log('💎 Loading NFTs', page);
                getNftHoldings(walletAddress, platformId, '', page)
                    .then(response => {
                        const newNFTs = response.nfts;
                        const paginationData = response.pagination;

                        // Update pagination state
                        setNftPagination(paginationData);

                        if (page === 1) {
                            dispatch(setPortfolioNfts(walletAddress, platformId, newNFTs));
                        } else {
                            dispatch(
                                setPortfolioNfts(walletAddress, platformId, [
                                    ...nftsRef.current,
                                    ...newNFTs,
                                ]),
                            );
                        }
                    })
                    .catch(() => {})
                    .finally(() => {
                        eventManager.emit(EventType.NFT_LOADING_STATUS, false);
                        setLoadingMoreNfts(false);
                        loadingNftsRef.current = false;
                    });
            }
        },
        [dispatch, walletAddress, platformId],
    );

    const loadTransactions = useCallback(
        (_address: string, _platform_id: number, page: number = 1) => {
            if (_address) {
                if (transactions.length === 0 || page !== 1) {
                    eventManager.emit(EventType.TRANSACTION_LOADING_STATUS, true);
                }

                setHasMore(false);
                getTransactionHistory(_address, _platform_id, page)
                    .then(response => {
                        if (response.pagination.page === 1) {
                            dispatch(
                                setPortfolioTransactions(_address, _platform_id, response.data),
                            );
                        } else {
                            dispatch(
                                setPortfolioTransactions(_address, _platform_id, [
                                    ...transactions,
                                    ...response.data,
                                ]),
                            );
                        }
                        setPage(response.pagination.page + 1);
                        setHasMore(response.pagination.hasNextPage);
                        eventManager.emit(EventType.TRANSACTION_LOADING_STATUS, false);
                    })
                    .catch(() => {
                        eventManager.emit(EventType.TRANSACTION_LOADING_STATUS, false);
                    });
            }
        },
        [dispatch, setHasMore, setPage, transactions],
    );

    const onLoadMore = useCallback(() => {
        if (walletAddress) {
            loadTransactions(walletAddress, platformId, page);
        }
    }, [loadTransactions, page, platformId, walletAddress]);

    const loadData = useCallback(() => {
        if (
            walletAddress &&
            platformId &&
            (!isSmartWallet || (isSmartWallet && selectedNetwork.smartWalletSupport))
        ) {
            refreshTimestampRef.current = Date.now();
            loadCoins(walletAddress, platformId);
            loadNfts(1);
            loadTransactions(walletAddress, platformId);
        }
    }, [
        walletAddress,
        platformId,
        isSmartWallet,
        selectedNetwork,
        loadCoins,
        loadNfts,
        loadTransactions,
    ]);

    const containerClass = 'h-[calc(100vh-96px)] sm:h-[calc(100vh-138px)]';

    useEffect(() => {
        if (walletAddress) {
            CoinsUtils.fetchPortfolioCoins(walletAddress, selectedNetwork);
        }
    }, [walletAddress, selectedNetwork]);

    useEffect(() => {
        nftsRef.current = nfts;
    }, [nfts]);

    useEffect(() => {
        showAllCoinsRef.current = showAllCoins;
    }, [showAllCoins]);

    useEffect(() => {
        loadData();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletAddress, platformId]);

    useEffect(() => {
        const callback = () => {
            logger.log('🔄 Refresh Wallet');
            loadData();
        };

        const intervalId = setInterval(() => {
            const diff = Date.now() - refreshTimestampRef.current;

            // Only refresh the data if the interval >= REFRESH_WALLET_INTERVAL and not loading
            if (diff >= REFRESH_WALLET_INTERVAL && !loadingCoinsRef.current) {
                callback();
            }
        }, REFRESH_WALLET_INTERVAL);

        eventManager.on(EventType.REFRESH_WALLET, callback);

        return () => {
            clearInterval(intervalId);
            eventManager.off(EventType.REFRESH_WALLET, callback);
        };
    }, [loadData]);

    useEffect(() => {
        if (!isSmartWallet) {
            if (otherAddress) {
                if (!newSmartWalletRef.current) {
                    newSmartWalletRef.current = otherAddress;
                    walletImport(otherAddress, true);
                }
            } else {
                newSmartWalletRef.current = undefined;
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSmartWallet, otherAddress]);

    useEffect(() => {
        let _total = 0;

        if (isTestnet) {
            portfolioCoins.forEach(item => {
                if (
                    isEqualCaseInsensitive(item.token_address, selectedNetwork.native_coin_address)
                ) {
                    _total = item.coin_balance ?? 0;
                }
            });
        } else {
            portfolioCoins.forEach(item => {
                const _price = item.coin_price ?? 0;
                const _balance = item.coin_balance ?? 0;
                _total += _price * _balance;
            });
        }

        setCurrentTotalCoins(_total);
    }, [portfolioCoins, isTestnet, selectedNetwork]);

    return (
        <WalletContext.Provider
            value={{
                containerClass,
                tooltipText,
                tooltipVariant,
                currentTotalCoins,
                isLoading,
                hasMore,
                onAddressPress,
                loadData,
                onLoadMore,
                loadNfts,
                nftPagination,
                loadingNftsRef,
                loadingMoreNfts,
                showAllCoins,
                setShowAllCoins,
                onShowMoreCoins,
                onShowLessCoins,
                filteredCoins,
                hasHiddenCoins,
            }}>
            {props.children}
        </WalletContext.Provider>
    );
}
