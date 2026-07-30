import React, { useCallback, useMemo } from 'react';
import { SlOptionsVertical } from 'react-icons/sl';
import { CURRENT_CHAINS } from '../../lib/ChainsUtils';
import { NFTCollection } from '../../shared/types/Wallet';
import { setNftCollectionsHideStatus, setNftsHideStatus } from '../../store/actions/uiActions';
import { usePreferences } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import SafeImage from './SafeImage';

type Props = {
    data: NFTCollection;
    onPress: (coin: NFTCollection) => void;
    showHiddenStatus?: boolean;
    hiddenStatus?: 'visible' | 'hidden';
};

export const Placeholder = () => {
    return (
        <div className="col-span-6 lg:col-span-3 flex flex-col w-full shadow-md rounded-md p-3">
            <div className="flex w-full aspect-square rounded-md shrink-0 overflow-hidden mb-3">
                <div className="w-full h-full animate-pulse bg-placeholder"></div>
            </div>
            <div className="w-full text-left">
                <p className="animate-pulse bg-placeholder h-5 w-full mb-1 rounded-md"></p>
                <p className="animate-pulse bg-placeholder h-3 w-full mb-1 rounded-md"></p>
                <p className="animate-pulse bg-placeholder h-5 w-full mb-1 rounded-md"></p>
                <p className="animate-pulse bg-placeholder h-3 w-full mb-1 rounded-md"></p>
            </div>
        </div>
    );
};

export default React.memo<Props>((props: Props) => {
    const dispatch = useAppDispatch();

    const { onPress, data, showHiddenStatus = false, hiddenStatus = 'visible' } = props;
    const { image_url, name, items = [], platform_id } = data;

    const { nftCollectionsHideStatus = {}, nftsHideStatus = {} } = usePreferences();

    const thumbnail = useMemo(() => {
        let firstNftImage = null;
        if (items.length > 0) {
            const firstItem = items[0];
            firstNftImage = firstItem.image_url ?? firstItem.previews.image_small_url;
        }
        return image_url ? image_url : firstNftImage;
    }, [items, image_url]);

    const chain = useMemo(() => {
        const firstItem = items[0];

        return CURRENT_CHAINS.find(_chain => _chain.chain_key === firstItem.chain);
    }, [items]);

    const menu = useMemo(() => {
        const _menu: { id: string; title: string; icon?: string }[] = [];

        if (hiddenStatus === 'visible') {
            _menu.push({
                id: 'hide',
                title: 'Hide This Collection',
            });
        }

        if (hiddenStatus === 'hidden') {
            _menu.push({
                id: 'show',
                title: 'Show This Collection',
            });
        }

        return _menu;
    }, [hiddenStatus]);

    const filteredItems = useMemo(() => {
        let newItems: any[] = [];
        items.forEach((_item: any) => {
            let isShow = true;
            let collection = _item.nft_collection;
            if (collection.spam_score >= collection.spamThreshold) {
                isShow = false;
            }
            //get override status from redux
            if (nftCollectionsHideStatus.hasOwnProperty(collection._id)) {
                isShow = !nftCollectionsHideStatus[collection._id];
            }

            if (nftsHideStatus.hasOwnProperty(_item._id)) {
                isShow = !nftsHideStatus[_item._id];
            }

            if (hiddenStatus === 'hidden') {
                if (!isShow) {
                    newItems.push(_item);
                }
            } else {
                if (isShow) {
                    newItems.push(_item);
                }
            }
        });
        return newItems;
    }, [items, nftCollectionsHideStatus, nftsHideStatus, hiddenStatus]);

    const handleOnHidePress = useCallback(async () => {
        let hideColStatus = { ...nftCollectionsHideStatus };
        hideColStatus[data._id] = true;
        await dispatch(setNftCollectionsHideStatus(hideColStatus));

        //remove nft hide status from redux
        let hideStatus = { ...nftsHideStatus };
        data.items.forEach((nft: any) => {
            delete hideStatus[nft._id];
        });
        await dispatch(setNftsHideStatus(hideStatus));
    }, [dispatch, nftCollectionsHideStatus, nftsHideStatus, data]);

    const handleOnShowPress = useCallback(async () => {
        let hideColStatus = { ...nftCollectionsHideStatus };
        hideColStatus[data._id] = false;
        await dispatch(setNftCollectionsHideStatus(hideColStatus));

        //remove nft hide status from redux
        let hideStatus = { ...nftsHideStatus };
        data.items.forEach((nft: any) => {
            delete hideStatus[nft._id];
        });
        await dispatch(setNftsHideStatus(hideStatus));
    }, [dispatch, nftCollectionsHideStatus, nftsHideStatus, data]);

    return (
        <button
            className="col-span-6 lg:col-span-3 flex flex-col bg-white dark:bg-dark border border-slate-200 dark:border-darkline/60 hover:border-primary/50 dark:hover:border-accent/50 transition-colors w-full rounded-2xl p-3"
            onClick={e => {
                e.preventDefault();
                onPress(data);
            }}>
            <div className="relative flex bg-slate-100 dark:bg-white/5 w-full aspect-square rounded-xl shrink-0 overflow-hidden mb-3">
                {thumbnail ? (
                    <SafeImage
                        src={thumbnail}
                        className="w-full h-full"
                        alt="NFT Collection"
                        defaultPlaceholder={
                            <div className="w-full h-full flex items-center justify-center font-semibold text-primary text-3xl">
                                NFT
                            </div>
                        }
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center font-semibold text-primary text-3xl">
                        NFT
                    </div>
                )}

                {showHiddenStatus && hiddenStatus === 'hidden' && (
                    <span className="absolute bottom-0 left-0 m-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                        Hidden
                    </span>
                )}

                <div className="absolute top-2 right-2">
                    <ContextMenu
                        placeholder={
                            <div className="w-[30px] h-[30px] flex items-center justify-center bg-gray-300 bg-opacity-50 hover:bg-opacity-80 dark:bg-black dark:bg-opacity-50 hover:dark:bg-opacity-80 rounded-full">
                                <SlOptionsVertical size={14} />
                            </div>
                        }
                        menus={menu.map((menu, index) => (
                            <ContextMenuItem
                                key={index}
                                title={menu.title}
                                icon={null}
                                onClick={() => {
                                    if (menu.id === 'hide') {
                                        handleOnHidePress();
                                    } else if (menu.id === 'show') {
                                        handleOnShowPress();
                                    }
                                }}
                            />
                        ))}
                    />
                </div>
            </div>

            <div className="w-full text-left">
                <div className="text-sm text-black dark:text-white font-semibold truncate">
                    {name}
                </div>
                <div className="text-xs text-gray-500 mt-1">Collected {filteredItems.length}</div>
            </div>
        </button>
    );
});
