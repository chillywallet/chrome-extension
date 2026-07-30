import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import CoinsUtils from '../../../lib/CoinsUtils';
import { DEFAULT_ROUTE } from '../../../shared/constants/routes';
import { Coin, NFT, NFTList } from '../../../shared/types/Wallet';
import { groupNFTs } from '../../../shared/utils/nft';
import { getNftHoldings } from '../../../shared/utils/portfolio';
import { setPortfolioNfts } from '../../../store/actions/uiActions';
import { useCurrentAccount, usePortfolioCoins, usePortfolioNfts } from '../../../store/selectors';
import { useCurrentPlatformId } from '../../../store/selectors/wallet';
import { useAppDispatch } from '../../../store/store';
import CoinCard from '../../components/CoinCard';
import Header from '../../components/Header';
import NFTCard from '../../components/NFTCard';
import WalletTag from '../../components/WalletTag';

type Props = {
    onCoinPress: (coin: Coin) => void;
    onNFTPress: (nft: NFT) => void;
    setTabIndex: (tabIndex: number) => void;
    tabIndex: number;
    setShowSpamNft: (show: boolean) => void;
    showSpamNft: boolean;
    isAAWallet: boolean;
};

export default React.memo<Props>((props: Props) => {
    const { onCoinPress, onNFTPress, setTabIndex, tabIndex, isAAWallet } = props;
    const history = useHistory();
    const currentAccount = useCurrentAccount();
    const dispatch = useAppDispatch();

    const [coinSearchText, setCoinSearchText] = useState('');
    const [nftSearchText, setNFTSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<NFTList[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const walletAddress = useMemo(() => {
        return isAAWallet ? currentAccount?.smartAddress : currentAccount?.address;
    }, [isAAWallet, currentAccount]);

    const portfolioCoins = usePortfolioCoins(walletAddress);
    const portfolioNfts = usePortfolioNfts(walletAddress);
    const platformId = useCurrentPlatformId();

    const filteredCoins = useMemo(() => {
        const handledSearchText = coinSearchText.trim().toLowerCase();
        return !handledSearchText
            ? portfolioCoins
            : portfolioCoins.filter(
                  _coin =>
                      _coin.coin_name?.toLowerCase().includes(handledSearchText) ||
                      _coin.symbol?.toLowerCase().includes(handledSearchText),
              );
    }, [coinSearchText, portfolioCoins]);

    const loadNFTs = useCallback(
        async (searchText: string) => {
            if (!walletAddress || !platformId) return;

            setIsSearching(true);
            try {
                const response = await getNftHoldings(walletAddress, platformId, searchText, 1);
                return response.nfts;
            } catch (error) {
                console.error('Error searching NFTs:', error);
                return [];
            } finally {
                setIsSearching(false);
            }
        },
        [walletAddress, platformId],
    );

    const handledNFTs = useMemo(() => {
        return groupNFTs(nftSearchText !== '' ? searchResults : portfolioNfts);
    }, [portfolioNfts, searchResults, nftSearchText]);

    const nfts = useMemo(() => {
        return handledNFTs.individuals;
    }, [handledNFTs]);

    const debouncedSearch = useMemo(
        () =>
            debounce((searchText: string) => {
                if (searchText.trim()) {
                    loadNFTs(searchText.trim()).then(nfts => {
                        if (nfts && nfts.length > 0) {
                            setSearchResults(nfts);
                        }
                    });
                } else {
                    setSearchResults([]);
                }
            }, 300),
        [loadNFTs],
    );

    useEffect(() => {
        debouncedSearch(nftSearchText);

        return () => {
            debouncedSearch.cancel();
        };
    }, [nftSearchText, debouncedSearch]);

    useEffect(() => {
        if (walletAddress) {
            CoinsUtils.fetchPortfolioCoins(walletAddress);
        }
    }, [walletAddress]);

    useEffect(() => {
        if (nfts.length === 0 && walletAddress && platformId) {
            loadNFTs('').then(nfts => {
                if (nfts && nfts.length > 0) {
                    dispatch(setPortfolioNfts(walletAddress, platformId, nfts));
                }
            });
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletAddress, platformId, dispatch, loadNFTs]);

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Select Asset"
                onBackPress={() => history.replace(DEFAULT_ROUTE)}
                action={<WalletTag isAAWallet={isAAWallet} />}
            />

            <div className="flex flex-col flex-1 min-h-[400px]">
                <Tabs
                    onSelect={index => {
                        setTabIndex(index);
                    }}
                    defaultIndex={tabIndex}
                    selectedTabClassName="tab-selected-tab-class-name"
                    selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                    className="tab-class-name">
                    <TabList className="tab-tablist">
                        <Tab className="tab-tablist-tab">Coins</Tab>
                        <Tab className="tab-tablist-tab">NFTs</Tab>
                    </TabList>

                    <TabPanel className="divide-y divide-gray-200 dark:divide-gray-700">
                        <input
                            value={coinSearchText}
                            type={'search'}
                            className="text-sm h-11 px-4 text-black-500 placeholder-gray-400 form-input bg-transparent block w-full focus:outline-none"
                            placeholder="Search..."
                            onChange={e => {
                                setCoinSearchText(e.target.value);
                            }}
                        />
                        <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-auto h-[calc(600px-8.25rem)] sm:h-[calc(100vh-40px-8.25rem)]">
                            {filteredCoins.length ? (
                                filteredCoins.map(_coin => (
                                    <CoinCard
                                        key={_coin.token_address}
                                        data={_coin}
                                        onPress={onCoinPress}
                                        showMenu={false}
                                        type="send"
                                    />
                                ))
                            ) : (
                                <div className="flex items-center h-full justify-center text-sm text-gray-400 text-center pt-3">
                                    There are no coins
                                </div>
                            )}
                        </div>
                    </TabPanel>
                    <TabPanel className="divide-y divide-gray-200 dark:divide-gray-700">
                        <input
                            value={nftSearchText}
                            type={'search'}
                            className="text-sm h-11 px-4 text-black-500 placeholder-gray-400 form-input bg-transparent block w-full focus:outline-none"
                            placeholder="Search..."
                            onChange={e => {
                                setNFTSearchText(e.target.value);
                            }}
                        />
                        <div className="overflow-auto p-3 h-[calc(600px-8.25rem)] sm:h-[calc(100vh-40px-8.25rem)]">
                            {isSearching ? (
                                <div className="flex items-center h-full justify-center text-sm text-gray-400 text-center pb-12">
                                    <div className="text-sm text-gray-400">Searching NFTs...</div>
                                </div>
                            ) : nfts.length ? (
                                <div className="grid grid-cols-12 gap-3">
                                    {nfts.map((_nft, index) => (
                                        <NFTCard
                                            key={_nft.contract_address + index}
                                            data={_nft}
                                            onPress={onNFTPress}
                                            showMenu={false}
                                            type="send"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center h-full justify-center text-sm text-gray-400 text-center pb-12">
                                    {nftSearchText.trim()
                                        ? 'No NFTs found matching your search'
                                        : 'There are no NFTs'}
                                </div>
                            )}
                        </div>
                    </TabPanel>
                </Tabs>
            </div>
        </div>
    );
});
