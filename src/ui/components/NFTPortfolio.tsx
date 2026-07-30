import React, { useEffect, useMemo, useState } from 'react';
import { AiFillCaretDown } from 'react-icons/ai';
import { useHistory } from 'react-router-dom';
import { ASSET_NFT_COLLECTION_ROUTE } from '../../shared/constants/routes';
import EventType from '../../shared/types/EventType';
import { NFT } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import { filterByHideStatus, groupNFTs } from '../../shared/utils/nft';
import { usePortfolioNfts, usePreferences } from '../../store/selectors';
import { useWalletData } from '../pages/Home/WalletProvider';
import { useRoutesData } from '../pages/RoutesProvider';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import LoadMore from './LoadMore';
import NFTCard, { Placeholder } from './NFTCard';
import NFTCollectionCard from './NFTCollectionCard';

const CONTEXT_MENUS = [
    {
        id: 'by_collection',
        title: 'By Collection',
    },
    {
        id: 'by_nft',
        title: 'By NFT',
    },
    {
        type: 'divider',
    },
    {
        id: 'show_hidden',
        title: 'Show Hidden NFTs',
    },
];

type Props = {
    onNftPress: (nft: NFT, isAAWallet: boolean) => void;
    setShowSpamNft: (show: boolean) => void;
    showSpamNft: boolean;
    walletAddress: string;
    containerClass: string;
    isAAWallet?: boolean;
};

export default React.memo<Props>((props: Props) => {
    const { onNftPress, showSpamNft, walletAddress, isAAWallet = false } = props;

    const nfts = usePortfolioNfts(walletAddress);
    const { loadNfts, nftPagination, loadingMoreNfts } = useWalletData();
    const { setSelectedNFTCollection, setIsAAWallet, setShowHiddenNFTs } = useRoutesData();
    const history = useHistory();
    const { nftCollectionsHideStatus = {}, nftsHideStatus = {} } = usePreferences();

    const [isLoading, setIsLoading] = useState(false);
    const [currentFilter, setCurrentFilter] = useState('by_collection');

    useEffect(() => {
        const func = (status: boolean) => {
            setIsLoading(status);
        };
        eventManager.on(EventType.NFT_LOADING_STATUS, func);

        return () => {
            eventManager.off(EventType.NFT_LOADING_STATUS, func);
        };
    }, []);

    const handledNFTs = useMemo(() => {
        return groupNFTs(nfts);
    }, [nfts]);

    const processedNFTs = useMemo(() => {
        return filterByHideStatus(
            handledNFTs,
            showSpamNft,
            nftCollectionsHideStatus,
            nftsHideStatus,
        );
    }, [handledNFTs, nftCollectionsHideStatus, nftsHideStatus, showSpamNft]);

    const nftCollections = useMemo(() => {
        if (currentFilter === 'by_collection') {
            return processedNFTs.collections;
        } else if (currentFilter === 'show_hidden') {
            return processedNFTs.all;
        }
        return processedNFTs.individuals;
    }, [currentFilter, processedNFTs]);

    const handleLoadMore = () => {
        if (nftPagination?.hasNextPage && !loadingMoreNfts) {
            const nextPage = nftPagination?.page ? nftPagination.page + 1 : 1;
            loadNfts(nextPage);
        }
    };

    return (
        <div className="p-3">
            <div className="col-span-12 flex flex-row justify-end text-sm mb-3">
                <ContextMenu
                    placeholder={
                        <label className="flex flex-row items-center justify-end cursor-pointer">
                            {CONTEXT_MENUS.find(menu => menu.id === currentFilter)?.title ?? ''}

                            <AiFillCaretDown size={14} className="ml-2" />
                        </label>
                    }
                    menus={CONTEXT_MENUS.map((menu, index) => {
                        if (menu.type === 'divider') {
                            return (
                                <div key={index} className="h-0.5 bg-gray-200 dark:bg-gray-800" />
                            );
                        }
                        return (
                            <ContextMenuItem
                                key={index}
                                title={menu.title ?? ''}
                                icon={null}
                                onClick={e => {
                                    e.preventDefault();
                                    setCurrentFilter(menu.id ?? '');
                                }}
                            />
                        );
                    })}
                />
            </div>
            {isLoading ? (
                <div className="grid grid-cols-12 gap-3">
                    {[...Array(8)].map((_, index) => (
                        <Placeholder key={index} />
                    ))}
                </div>
            ) : nftCollections.length ? (
                <div className="grid grid-cols-12 gap-3 relative">
                    {(currentFilter === 'by_collection' || currentFilter === 'show_hidden') &&
                        nftCollections.map((_collection, index) => (
                            <NFTCollectionCard
                                key={index}
                                data={_collection}
                                showHiddenStatus={true}
                                hiddenStatus={_collection.hiddenStatus}
                                onPress={collection => {
                                    setIsAAWallet(isAAWallet);
                                    setSelectedNFTCollection(collection);
                                    setShowHiddenNFTs(currentFilter === 'show_hidden');
                                    history.push(ASSET_NFT_COLLECTION_ROUTE);
                                }}
                            />
                        ))}

                    {currentFilter === 'by_nft' &&
                        processedNFTs.individuals.map(_nft => (
                            <NFTCard
                                key={_nft._id}
                                data={_nft}
                                onPress={nft => onNftPress(nft, isAAWallet)}
                                type="portfolio"
                            />
                        ))}

                    {loadingMoreNfts && <LoadMore />}

                    {nftPagination?.hasNextPage && !loadingMoreNfts && (
                        <div className="col-span-12">
                            <div className="flex items-center justify-center p-6">
                                <button
                                    className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
                                    onClick={handleLoadMore}>
                                    Load More NFTs
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center h-[calc(100%-40px)] justify-center text-sm text-gray-400 text-center pb-12">
                    There are no NFTs
                </div>
            )}
        </div>
    );
});
