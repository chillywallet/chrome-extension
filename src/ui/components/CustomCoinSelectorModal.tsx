import _ from 'lodash';
import { Moment } from 'moment';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BsChevronContract, BsChevronExpand } from 'react-icons/bs';
import { FiSearch } from 'react-icons/fi';
import { getPlatformIdByChainData } from '../../lib/ChainsUtils';
import CoinsUtils from '../../lib/CoinsUtils';
import {
    EVM_NATIVE_TOKEN_ADDRESS,
    POLYGON_NATIVE_TOKEN_ADDRESS,
} from '../../shared/constants/network';
import { ChainData } from '../../shared/types/Chain';
import { PlatformCoin } from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import { isEqualCaseInsensitive } from '../../shared/utils/string';
import { useTopCoinsByNetwork } from '../../store/selectors/coin';
import Header from './Header';
import Modal from './Modal';
import NoData from './NoData';
import SearchingIndicator from './SearchingIndicator';
import SwapCoinCard from './SwapCoinCard';

type Props = {
    visible: boolean;
    data: PlatformCoin[];
    onClose: () => void;
    onCoinPress: (coin: PlatformCoin) => void;
    walletAddress: string | null;
    onLoadStart?: () => void;
    onLoadEnd?: (coins: PlatformCoin[], holdingCoins: PlatformCoin[]) => void;
    network: ChainData;
};

const RETRY_NUM = 3;

export default React.memo<Props>((props: Props) => {
    const {
        visible,
        data: ownedCoins,
        onClose,
        onCoinPress,
        onLoadEnd,
        onLoadStart,
        network,
    } = props;

    const topCoins = useTopCoinsByNetwork(network);

    const retryNumRef = useRef(RETRY_NUM);
    const listRef = useRef<HTMLDivElement>(null);

    const loadDataBalanceTimeRef = useRef<null | Moment>(null);
    const loadCoinsBalanceTimeRef = useRef<null | Moment>(null);

    const [searchingIndicator, setSearchingIndicator] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [notFound, setNotFound] = useState(false);
    const [coins, setCoins] = useState<PlatformCoin[]>([]);
    const [filteredData, setFilteredData] = useState<PlatformCoin[]>([]);
    const [filteredCoins, setFilteredCoins] = useState<PlatformCoin[]>([]);
    const [showMoreCoins, setShowMoreCoins] = useState(false);

    const combinedFilteredCoins = useMemo(() => {
        return [...filteredData, ...filteredCoins];
    }, [filteredData, filteredCoins]);

    const getFilteredCoins = useCallback(
        (_coins: PlatformCoin[]) => {
            const _filteredCoins = _coins
                .filter(_coin => {
                    const isNativeToken =
                        !_coin.coinAddress ||
                        isEqualCaseInsensitive(_coin.coinAddress, EVM_NATIVE_TOKEN_ADDRESS);

                    if (isNativeToken) {
                        return false;
                    }

                    if (network.chain_key === 'polygon' || network.chain_key === 'polygon_amoy') {
                        const isPolygonNativeToken = isEqualCaseInsensitive(
                            _coin.coinAddress,
                            POLYGON_NATIVE_TOKEN_ADDRESS,
                        );

                        if (isPolygonNativeToken) {
                            return false;
                        }
                    }

                    const ownedToken = ownedCoins.some(_ownedCoin =>
                        isEqualCaseInsensitive(_ownedCoin.coinAddress, _coin.coinAddress),
                    );

                    if (ownedToken) {
                        return false;
                    }

                    return true;
                })
                .map((coin: any) => coin);

            return _filteredCoins;
        },
        [network, ownedCoins],
    );

    const loadCoins = useCallback(
        (_name: string, callback: (params: { error: boolean; result: PlatformCoin[] }) => void) => {
            const _platformId = getPlatformIdByChainData(network);
            CoinsUtils.loadCoins(_name, _platformId, ({ error, result }) => {
                const _filteredCoins = getFilteredCoins(result);
                callback({ error, result: _filteredCoins });
            });
        },
        [network, getFilteredCoins],
    );

    const debounceSearchFunc = useMemo(() => {
        return _.debounce((text: string) => {
            if (text) {
                setSearchingIndicator(true);
                let _notFound = false;
                const _searchText = text.trim().toLowerCase();
                const _filteredCoins = ownedCoins.filter(
                    _coin =>
                        _coin.name?.toLowerCase().includes(_searchText) ||
                        _coin.symbol?.toLowerCase().includes(_searchText),
                );

                loadCoins(text, ({ error, result }) => {
                    setSearchingIndicator(false);

                    if (!error) {
                        setFilteredCoins(result);
                        setFilteredData(_filteredCoins);
                        _notFound = _filteredCoins.length === 0 && result.length === 0;

                        setNotFound(_notFound);
                    }
                });
            } else {
                setNotFound(false);
                setFilteredData([]);
                setFilteredCoins([]);
            }
        }, 500);
    }, [ownedCoins, loadCoins]);

    const onSearchText = useCallback(
        (text: string) => {
            setSearchText(text);
            debounceSearchFunc(text);
        },
        [debounceSearchFunc],
    );

    useEffect(() => {
        if (!visible) {
            setSearchText('');
            setShowMoreCoins(false);
            retryNumRef.current = RETRY_NUM;
        }
    }, [visible]);

    useEffect(() => {
        if (showMoreCoins && listRef.current) {
            listRef.current.scrollBy({
                top: 100,
                behavior: 'smooth',
            });
        }
    }, [showMoreCoins]);

    useEffect(() => {
        if (ownedCoins.length) {
            loadDataBalanceTimeRef.current = loadCoinsBalanceTimeRef.current = null;

            if (topCoins.length) {
                const _filteredCoins = getFilteredCoins(topCoins);
                setCoins(_filteredCoins);
                onLoadEnd && onLoadEnd(_filteredCoins, ownedCoins);
            } else {
                const loadData = (isRetry: boolean = false) => {
                    if (!isRetry) {
                        onLoadStart && onLoadStart();
                    }

                    loadCoins('', ({ error, result }) => {
                        if (!error) {
                            if (result?.length > 0) {
                                setCoins(result);
                                retryNumRef.current = RETRY_NUM;
                                onLoadEnd && onLoadEnd(result, ownedCoins);
                            } else if (retryNumRef.current > 0) {
                                retryNumRef.current -= 1;
                                setTimeout(() => {
                                    loadData(true);
                                    logger.log('CustomCoinSelector', 'Retry load coins');
                                }, 1000);
                            } else {
                                onLoadEnd && onLoadEnd([], []);
                            }
                        }
                    });
                };

                loadData();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadCoins, onLoadEnd, network, topCoins, ownedCoins, getFilteredCoins]);

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
                <div ref={listRef} className="flex flex-col h-[400px] overflow-y-auto">
                    {searchText ? (
                        notFound ? (
                            <NoData>No result found</NoData>
                        ) : (
                            <div className="flex flex-col divide-y dark:divide-darker">
                                {combinedFilteredCoins.map((item, index) => (
                                    <SwapCoinCard
                                        key={index}
                                        testnet={network?.testnet}
                                        data={item}
                                        onPress={onCoinPress}
                                    />
                                ))}
                            </div>
                        )
                    ) : (
                        <>
                            <div className="flex flex-col divide-y dark:divide-darker">
                                {ownedCoins.map((item, index) => (
                                    <SwapCoinCard
                                        key={index}
                                        testnet={network?.testnet}
                                        data={item}
                                        onPress={onCoinPress}
                                    />
                                ))}
                            </div>
                            <div
                                className="flex flex-row items-center justify-center p-3 gap-3 cursor-pointer"
                                onClick={() => setShowMoreCoins(!showMoreCoins)}>
                                <div className="bg-gray-200 dark:bg-gray-600 flex-1 h-[1px]" />
                                <div className="flex flex-row items-center gap-2 text-gray-500 text-sm">
                                    <span>Other Coins</span>
                                    {showMoreCoins ? <BsChevronContract /> : <BsChevronExpand />}
                                </div>
                                <div className="bg-gray-200 dark:bg-gray-600 flex-1 h-[1px]" />
                            </div>
                            {showMoreCoins ? (
                                <div className="flex flex-col divide-y dark:divide-darker">
                                    {coins.map((item, index) => (
                                        <SwapCoinCard
                                            key={index}
                                            testnet={network?.testnet}
                                            data={item}
                                            onPress={onCoinPress}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </>
                    )}
                </div>

                {searchingIndicator && <SearchingIndicator />}
            </div>
        </Modal>
    );
});
