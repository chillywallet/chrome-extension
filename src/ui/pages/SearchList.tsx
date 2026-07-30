import { formatMoney } from '../../shared/utils/format';
import { getAddress } from 'ethers';
import _ from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaGlobe } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { MarketRequest } from '../../api/graphQL';
import { Contact } from '../../api/graphQL/Types';
import { TRUSTED_DAPPS, TrustedDapp } from '../../config/trustedDapps';
import { CONTACT_ROUTE } from '../../shared/constants/routes';
import { checkValidWalletAddress } from '../../shared/utils/utils';
import { hideLoadingIndicator, showLoadingIndicator } from '../../store/actions/uiActions';
import { useContacts, useSelectedNetwork } from '../../store/selectors';
import EmojiView from '../components/EmojiView';
import Header from '../components/Header';
import SafeImage from '../components/SafeImage';
import ScrollWithButton from '../components/ScrollWithButton';
import TextTruncate from '../components/TextTruncate';
import Toast from '../components/Toast';
import { useRoutesData } from './RoutesProvider';

const MAX_RESULT_PER_TYPE = 5;

type MarketCoin = {
    id: number;
    coinId: string;
    name: string;
    symbol: string;
    logo: string;
    latest: {
        price: number;
        percent_change_24h: number;
    };
    rank: number;
};

type SearchAddress = {
    name: string;
    url: string;
};

type SearchData = {
    type: 'header' | 'domain' | '0xaddress' | 'coin_price' | 'contact';
    data?: TrustedDapp | SearchAddress | Contact | MarketCoin | { title: string };
};

export const Placeholder = () => {
    return (
        <div className="flex flex-row w-full p-3">
            <div className="flex w-8 h-8 rounded-md shrink-0 overflow-hidden">
                <div className="w-full h-full animate-pulse bg-placeholder"></div>
            </div>
            <div className="flex-1 text-left ml-3">
                <p className="animate-pulse bg-placeholder h-5 w-1/2 mb-2 rounded-md"></p>
                <p className="animate-pulse bg-placeholder h-3 w-1/3 rounded-md"></p>
            </div>
        </div>
    );
};

type Props = {};

export default React.memo<Props>((props: Props) => {
    const [searchText, setSearchText] = useState('');
    const [contents, setContents] = useState<TrustedDapp[]>([]);
    const [loading, setLoading] = useState(false);
    const [coins, setCoins] = useState<MarketCoin[]>([]);
    const { onMarketCoinPress } = useRoutesData();
    const dispatch = useDispatch();

    const history = useHistory();
    const currentChain = useSelectedNetwork();
    const contacts = useContacts();

    const isAddress = useMemo(() => {
        return checkValidWalletAddress(searchText);
    }, [searchText]);

    const trustedDomainResults = useMemo(() => {
        let results = contents.filter(domain => domain.level !== 'SCAM');

        if (searchText.length > 0) {
            results = results.filter(domain => {
                return domain.name.toLowerCase().includes(searchText.toLowerCase());
            });
        }

        if (results.length > MAX_RESULT_PER_TYPE) {
            results = results.slice(0, MAX_RESULT_PER_TYPE);
        }

        return results;
    }, [contents, searchText]);

    const filteredContacts = useMemo(() => {
        let results = contacts;

        if (searchText.length > 0) {
            results = contacts.filter(contact => {
                return (
                    contact.name.toLowerCase().includes(searchText.toLowerCase()) ||
                    contact.walletAddress.toLowerCase().includes(searchText.toLowerCase())
                );
            });
        }

        return results.slice(0, MAX_RESULT_PER_TYPE);
    }, [contacts, searchText]);

    const fetchTrustedDapps = useCallback(async () => {
        // The dapp directory is committed locally (src/config/trustedDapps.ts);
        // there is no backend to fetch it from.
        setContents(TRUSTED_DAPPS.filter(content => content.level !== 'SCAM'));
        setLoading(false);
    }, []);

    const searchCoins = useCallback((name: string) => {
        MarketRequest.getCoins(name, 20, 0, false)
            .then(result => {
                setCoins(result.data.coins.data);
            })
            .catch(() => {
                // do nothing
            });
    }, []);

    const debounceSearchFunc = useMemo(() => {
        return _.debounce((text: string) => {
            searchCoins(text);
        }, 500);
    }, [searchCoins]);

    useEffect(() => {
        fetchTrustedDapps();
    }, [fetchTrustedDapps]);

    useEffect(() => {
        if (searchText.trim() !== '') {
            debounceSearchFunc(searchText);
        } else {
            setCoins([]);
        }

        return () => {
            debounceSearchFunc.cancel();
        };
    }, [searchText, debounceSearchFunc]);

    const searchList = useMemo(() => {
        if (isAddress) {
            const results: SearchData[] = [
                {
                    type: '0xaddress',
                    data: {
                        name: 'Blockscan',
                        url: `https://blockscan.com/address/${searchText}`,
                    },
                },
                {
                    type: '0xaddress',
                    data: {
                        name: currentChain?.explorer_name ?? 'Unknown Explorer',
                        url: `${currentChain?.explorer_url}/address/${searchText}`,
                    },
                },
            ];

            const _contacts: SearchData[] = filteredContacts
                .slice(0, MAX_RESULT_PER_TYPE)
                .map(item => ({
                    type: 'contact',
                    data: item,
                }));

            if (_contacts.length > 0) {
                results.push({
                    type: 'header',
                    data: {
                        title: 'Contacts',
                    },
                });

                results.push(..._contacts);
            }

            return results;
        } else {
            const allData: SearchData[] = [];

            const _trustedDomains: SearchData[] = trustedDomainResults
                .slice(0, MAX_RESULT_PER_TYPE)
                .map(item => ({
                    type: 'domain',
                    data: item,
                }));

            if (_trustedDomains.length > 0) {
                allData.push({
                    type: 'header',
                    data: {
                        title: 'Trusted Domains',
                    },
                });

                allData.push(..._trustedDomains);
            }

            const _contacts: SearchData[] = filteredContacts
                .slice(0, MAX_RESULT_PER_TYPE)
                .map(item => ({
                    type: 'contact',
                    data: item,
                }));

            if (_contacts.length > 0) {
                allData.push({
                    type: 'header',
                    data: {
                        title: 'Contacts',
                    },
                });

                allData.push(..._contacts);
            }

            const _coins: SearchData[] = coins.slice(0, MAX_RESULT_PER_TYPE).map(item => ({
                type: 'coin_price',
                data: item,
            }));

            if (_coins.length > 0) {
                allData.push({
                    type: 'header',
                    data: {
                        title: 'Coin Prices',
                    },
                });

                allData.push(..._coins);
            }

            return allData;
        }
    }, [
        trustedDomainResults,
        isAddress,
        currentChain,
        searchText,
        filteredContacts,
        coins,
    ]);

    const handleSearch = useCallback((text: string) => {
        // You can add search history logic here
        global.platform.openLink(text.startsWith('http') ? text : `https://${text}`, '_blank');
    }, []);

    const handleContactPress = useCallback(() => {
        history.push(CONTACT_ROUTE);
    }, [history]);

    const handleCoinPress = useCallback(
        (coin: MarketCoin) => {
            dispatch(showLoadingIndicator());
            MarketRequest.getCoinsByIds([coin.coinId], true)
                .then(result => {
                    if (result?.data?.coins?.data) {
                        const { data: newData } = result.data.coins;
                        if (newData.length > 0) {
                            onMarketCoinPress(newData[0]);
                        }
                    }
                })
                .catch(() => {
                    Toast.showError('Failed to load coin data');
                })
                .finally(() => {
                    dispatch(hideLoadingIndicator());
                });
        },
        [dispatch, onMarketCoinPress],
    );

    const renderSearchItem = useCallback(
        (item: SearchData, index: number) => {
            switch (item.type) {
                case 'header':
                    return (
                        <div
                            key={`header-${index}`}
                            className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {(item.data as { title: string })?.title}
                        </div>
                    );

                case 'domain':
                    const domainData = item.data as TrustedDapp;
                    return (
                        <button
                            key={`domain-${domainData.url}`}
                            onClick={() => handleSearch(domainData.url)}
                            className="flex flex-row items-center w-full text-sm hover:text-primary px-3 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                            <SafeImage
                                src={`https://chilly.me/api/favicon/${domainData.url}`}
                                className="w-8 h-8 rounded-md"
                                alt={`Logo ${domainData.name}`}
                            />
                            <div className="ml-3 text-left flex-1">
                                <TextTruncate
                                    className="whitespace-nowrap w-[calc(100vw-105px)] sm:w-[calc(450px-105px)]"
                                    text={domainData.name}
                                    position="end"
                                />
                                <TextTruncate
                                    className="whitespace-nowrap text-xs text-gray-700 dark:text-gray-200 w-[calc(100vw-105px)] sm:w-[calc(450px-105px)]"
                                    text={domainData.url}
                                    position="end"
                                />
                            </div>
                        </button>
                    );

                case '0xaddress':
                    const addressData = item.data as SearchAddress;
                    return (
                        <button
                            key={`address-${addressData.url}`}
                            onClick={() => handleSearch(addressData.url)}
                            className="flex flex-row items-center w-full text-sm hover:text-primary px-3 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                            <FaGlobe className="w-8 h-8 text-gray-400 mr-3" />
                            <div className="ml-3 text-left flex-1">
                                <TextTruncate
                                    className="whitespace-nowrap w-[calc(100vw-105px)] sm:w-[calc(450px-105px)]"
                                    text={addressData.name}
                                    position="end"
                                />
                                <TextTruncate
                                    className="whitespace-nowrap text-xs text-gray-700 dark:text-gray-200 w-[calc(100vw-105px)] sm:w-[calc(450px-105px)]"
                                    text={addressData.url}
                                    position="end"
                                />
                            </div>
                        </button>
                    );

                case 'contact':
                    const contactData = item.data as Contact;
                    let checksumAddress = '';

                    try {
                        checksumAddress = getAddress(contactData.walletAddress ?? '');
                    } catch (error) {}

                    return (
                        <button
                            key={`contact-${contactData.id}`}
                            onClick={handleContactPress}
                            className="flex flex-row items-center w-full text-sm hover:text-primary px-3 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                            <EmojiView
                                emoji={contactData.avatar}
                                walletAddress={contactData.walletAddress}
                                width={32}
                                emojiSize={12}
                            />
                            <div className="ml-3 text-left flex-1">
                                <TextTruncate
                                    className="whitespace-nowrap max-w-[200px]"
                                    text={contactData.name}
                                    position="end"
                                />
                                <TextTruncate
                                    className="whitespace-nowrap text-xs text-gray-700 dark:text-gray-200 w-[200px]"
                                    text={checksumAddress}
                                    position="middle"
                                />
                            </div>
                        </button>
                    );

                case 'coin_price':
                    const coinData = item.data as MarketCoin;
                    return (
                        <button
                            key={`coin-${coinData.coinId}`}
                            onClick={() => handleCoinPress(coinData)}
                            className="flex flex-row items-center w-full text-sm hover:text-primary px-3 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                            <SafeImage
                                src={coinData.logo}
                                className="w-8 h-8 rounded-full"
                                alt={`${coinData.name} logo`}
                            />
                            <div className="ml-3 text-left flex-1">
                                <TextTruncate
                                    className="whitespace-nowrap w-[calc(100vw-105px)] sm:w-[calc(450px-105px)]"
                                    text={coinData.name}
                                    position="end"
                                />
                                <div className="flex flex-row items-center">
                                    <span className="text-xs text-gray-500 mr-2">
                                        {coinData.rank ? `#${coinData.rank} ` : ''}
                                        {coinData.symbol}
                                    </span>
                                    <span className="text-xs text-gray-700 dark:text-gray-200">
                                        {formatMoney(coinData.latest.price)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span
                                    className={`text-xs ${
                                        coinData.latest.percent_change_24h >= 0
                                            ? 'text-green-600'
                                            : 'text-red-600'
                                    }`}>
                                    {coinData.latest.percent_change_24h >= 0 ? '+' : ''}
                                    {coinData.latest.percent_change_24h.toFixed(2)}%
                                </span>
                            </div>
                        </button>
                    );

                default:
                    return null;
            }
        },
        [handleCoinPress, handleContactPress, handleSearch],
    );

    return (
        <div className="flex flex-col w-full h-full">
            <Header title="Search" />

            <div className="p-3 bg-white dark:bg-darker border-b border-slate-100 dark:border-darkline/40">
                <input
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    placeholder="Search domains, addresses, contacts, or coins..."
                    className="w-full p-3 text-sm border border-slate-200 dark:border-darkline rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-accent focus:border-transparent"
                    autoFocus
                />
            </div>

            <ScrollWithButton
                className={'h-[calc(100vh-120px)] sm:h-[calc(100vh-161px)] overflow-x-hidden'}>
                {loading ? (
                    <div className="flex flex-col">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Placeholder key={index} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {searchList.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <span className="text-gray-500 text-sm">No results found</span>
                            </div>
                        ) : (
                            searchList.map((item, index) => renderSearchItem(item, index))
                        )}
                    </div>
                )}
            </ScrollWithButton>
        </div>
    );
});
