import moment, { Moment } from 'moment';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { MarketRequest, WalletRequest } from '../../api/graphQL';
import { getPlatformIdByChainData } from '../../lib/ChainsUtils';
import { USD_COIN } from '../../shared/constants/network';
import { PAGING_LIMIT } from '../../shared/constants/number';
import { ChainData } from '../../shared/types/Chain';
import { PlatformCoin } from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import { useTopCoinsByNetwork } from '../../store/selectors/coin';
import CoinSelectorCard from './CoinSelectorCard';
import Header from './Header';
import LoadMore from './LoadMore';
import Modal from './Modal';
import NoData from './NoData';
import SearchingIndicator from './SearchingIndicator';

type Props = {
    excludeUsd?: boolean;
    visible: boolean;
    onClose: () => void;
    onCoinPress: (coin: PlatformCoin) => void;
    onLoadStart?: () => void;
    onLoadEnd?: (coins: PlatformCoin[]) => void;
    network?: ChainData;
};

const TYPE_DURATION = 300;
const RETRY_NUM = 3;

export default React.memo<Props>((props: Props) => {
    const { visible, onClose, onCoinPress, onLoadEnd, onLoadStart, excludeUsd, network } = props;

    const topCoins = useTopCoinsByNetwork(network);

    const retryNumRef = useRef(RETRY_NUM);
    const currentTimeRef = useRef<Moment | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [searchingIndicator, setSearchingIndicator] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [loadingMore, setLoadingMore] = useState(false);
    const [firstLoad, setFirstLoad] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [offset, setOffset] = useState<number | null>(0);
    const [searchOffset, setSearchOffset] = useState<number>(0);
    const [coins, setCoins] = useState<PlatformCoin[]>([]);
    const [filteredCoins, setFilteredCoins] = useState<PlatformCoin[]>([]);

    const isExcludeUSD = useMemo(() => excludeUsd ?? false, [excludeUsd]);

    const loadCoins = useCallback(
        (
            _name: string,
            curOffset: number,
            setCurOffset: Function,
            callback: (params: { error: boolean; result: PlatformCoin[] }) => void,
        ) => {
            const task = network
                ? WalletRequest.getCoinsByPlatformIds(
                      _name,
                      [getPlatformIdByChainData(network)],
                      PAGING_LIMIT,
                      curOffset,
                  )
                : MarketRequest.getCoins(_name, PAGING_LIMIT, curOffset);
            task.then(result => {
                const _data = network ? (result?.data as any)?.platformCoins : (result?.data as any)?.coins;

                if (_data) {
                    const { data, pagination } = _data;
                    const paging = pagination && pagination.length ? pagination[0] : null;

                    if (paging) {
                        if (paging.page >= paging.last) {
                            setCurOffset(null);
                        } else {
                            setCurOffset(PAGING_LIMIT * paging.page);
                        }
                    } else {
                        setCurOffset(null);
                    }

                    callback({ error: false, result: data });
                } else {
                    setCurOffset(null);
                    callback({
                        error: false,
                        result: [],
                    });
                }
            }).catch(() => {
                setCurOffset(null);
                callback({ error: true, result: [] });
            });
        },
        [network],
    );

    const onSearchText = useCallback(
        (text: string) => {
            setSearchText(text);
            const now = moment();
            currentTimeRef.current = now;
            setSearchOffset(0);

            setTimeout(() => {
                if (moment().diff(currentTimeRef.current, 'millisecond') >= TYPE_DURATION) {
                    currentTimeRef.current = now;
                    if (text) {
                        setSearchingIndicator(true);
                        loadCoins(text, 0, setSearchOffset, ({ error, result }) => {
                            setSearchingIndicator(false);
                            listRef.current && listRef.current.scrollTo(0, 1000);

                            if (!error) {
                                if (result.length) {
                                    setNotFound(false);
                                    setFilteredCoins(result);
                                } else {
                                    setNotFound(true);
                                }
                            }
                        });
                    }
                }
            }, TYPE_DURATION);
        },
        [currentTimeRef, loadCoins],
    );

    useEffect(() => {
        if (topCoins.length && network) {
            if (isExcludeUSD) {
                setCoins(topCoins);
            } else {
                setCoins([USD_COIN, ...topCoins]);
            }

            setOffset(PAGING_LIMIT);
            setFirstLoad(false);
            onLoadEnd && onLoadEnd(topCoins);
        } else {
            const loadData = (isRetry: boolean = false) => {
                if (!isRetry) {
                    onLoadStart && onLoadStart();
                    setFirstLoad(true);
                }

                loadCoins('', 0, setOffset, ({ result }) => {
                    if (result?.length > 0) {
                        if (isExcludeUSD) {
                            setCoins(result);
                        } else {
                            setCoins([USD_COIN, ...result]);
                        }

                        retryNumRef.current = RETRY_NUM;
                        setFirstLoad(false);
                        onLoadEnd && onLoadEnd(result);
                    } else {
                        if (retryNumRef.current > 0) {
                            retryNumRef.current--;
                            setTimeout(() => {
                                loadData(true);
                                logger.log('CoinSelector', 'Retry load coins');
                            }, 1000);
                        } else {
                            setCoins([]);
                            setFirstLoad(false);
                            onLoadEnd && onLoadEnd([]);
                        }
                    }
                });
            };

            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadCoins, isExcludeUSD, network]);

    useEffect(() => {
        const handleScroll = () => {
            const scrollableDiv = listRef.current;

            if (scrollableDiv) {
                const curCoins = searchText ? filteredCoins : coins;
                let curSetOffset = searchText ? setSearchOffset : setOffset;
                let curOffset = searchText ? searchOffset : offset;

                if (
                    scrollableDiv.scrollHeight - scrollableDiv.scrollTop - 50 <=
                        scrollableDiv.clientHeight &&
                    !loadingMore &&
                    curOffset !== null &&
                    curCoins.length
                ) {
                    setLoadingMore(true);
                    loadCoins(searchText, curOffset, curSetOffset, ({ error, result }) => {
                        if (error) {
                            setLoadingMore(false);
                        } else {
                            if (!searchText) {
                                setCoins([...coins, ...result]);
                            } else {
                                setFilteredCoins([...filteredCoins, ...result]);
                            }

                            setTimeout(() => {
                                setLoadingMore(false);
                            }, 300);
                        }
                    });
                }
            }
        };

        const scrollableDiv = listRef.current;
        scrollableDiv?.addEventListener('scroll', handleScroll);

        return () => scrollableDiv?.removeEventListener('scroll', handleScroll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listRef.current, coins, filteredCoins, loadCoins, loadingMore, searchOffset, searchText]);

    useEffect(() => {
        if (!visible) {
            setSearchText('');
            setFilteredCoins([]);
        }
    }, [visible]);

    return (
        <Modal visible={visible} onClose={onClose}>
            <Header title="Select Coin" hasBackButton={false} onClosePress={onClose} />

            <div className="flex flex-row items-center px-3 py-2">
                <FiSearch className="text-gray-500 mr-2" />
                <input
                    value={searchText}
                    onChange={e => onSearchText(e.target.value)}
                    placeholder="Search coin"
                    className="flex flex-1 border-none focus:outline-none bg-transparent"
                />
            </div>

            <div className="relative">
                <div
                    ref={listRef}
                    className="flex flex-col h-[400px] divide-y dark:divide-darker overflow-y-auto">
                    {firstLoad ? (
                        <img src="/images/loading.gif" alt="loading" />
                    ) : searchText && notFound ? (
                        <NoData>No result found</NoData>
                    ) : (
                        <>
                            {(searchText ? filteredCoins : coins).map((item, index) => (
                                <CoinSelectorCard
                                    data={item}
                                    key={index}
                                    onPress={onCoinPress}
                                    testnet={network?.testnet}
                                />
                            ))}
                        </>
                    )}
                </div>

                {searchingIndicator && <SearchingIndicator />}
                {loadingMore && <LoadMore />}
            </div>
        </Modal>
    );
});
