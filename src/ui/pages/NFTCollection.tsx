/* eslint-disable jsx-a11y/img-redundant-alt */
import React, { useEffect, useMemo } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { SlOptionsVertical } from 'react-icons/sl';
import { useHistory } from 'react-router-dom';
import { CURRENT_CHAINS } from '../../lib/ChainsUtils';
import { DEFAULT_ROUTE } from '../../shared/constants/routes';
import { usePreferences } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import ContextMenu, { ContextMenuItem } from '../components/ContextMenu';
import Header from '../components/Header';
import NFTCard from '../components/NFTCard';
import ScrollWithButton from '../components/ScrollWithButton';
import { useRoutesData } from './RoutesProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const history = useHistory();
    const dispatch = useAppDispatch();
    const { nftCollectionsHideStatus = {}, nftsHideStatus = {} } = usePreferences();

    const { selectedNFTCollection, onAssetNFTPress, showHiddenNFTs, isAAWallet } = useRoutesData();
    const { image_url, name, items = [] } = selectedNFTCollection ?? {};

    useEffect(() => {
        if (selectedNFTCollection == null) {
            history.replace(DEFAULT_ROUTE);
        }
    }, [history, selectedNFTCollection]);

    const selectedNetwork = useMemo(() => {
        return CURRENT_CHAINS.find(chain => selectedNFTCollection?.chain === chain.chain_key);
    }, [selectedNFTCollection?.chain]);

    const menu = useMemo(() => {
        const items = selectedNFTCollection?.items;
        const contract_address = items?.length ? items[0].contract_address : null;
        if (selectedNetwork?.explorer_url && contract_address) {
            return (
                <ContextMenu
                    placeholder={<SlOptionsVertical size={14} />}
                    menus={
                        <ContextMenuItem
                            title={'View Smart Contract'}
                            icon={<FaExternalLinkAlt className="text-xs" />}
                            onClick={() => {
                                global.platform.openLink(
                                    `${selectedNetwork?.explorer_url}/address/${contract_address}`,
                                    '_blank',
                                );
                            }}
                        />
                    }
                />
            );
        }
        return null;
    }, [selectedNFTCollection?.items, selectedNetwork?.explorer_url]);

    const filteredItems = useMemo(() => {
        let newItems: any[] = [];
        items.forEach((_item: any) => {
            let isShow = true;
            let collection = _item.nft_collection;
            if (collection.spam_score >= collection.spamThreshold) {
                isShow = false;
            }
            //get override status from redux
            if (nftCollectionsHideStatus[collection._id]) {
                isShow = !nftCollectionsHideStatus[collection._id];
            }

            if (nftsHideStatus[_item._id]) {
                isShow = !nftsHideStatus[_item._id];
            }

            if (showHiddenNFTs) {
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
    }, [items, nftCollectionsHideStatus, nftsHideStatus, showHiddenNFTs]);

    return (
        <>
            <Header title={name ?? 'NFT Collection'} action={menu} />

            <ScrollWithButton
                className={'overflow-auto p-3 h-[calc(100vh-48px)] sm:h-[calc(100vh-48px)]'}>
                {filteredItems.length > 0 ? (
                    <div className="grid grid-cols-12 gap-3">
                        {filteredItems.map(_nft => (
                            <NFTCard
                                key={_nft._id}
                                data={_nft}
                                onPress={() => onAssetNFTPress(_nft, isAAWallet)}
                                showMenu={false}
                                type="send"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center h-[calc(100%-40px)] justify-center text-sm text-gray-400 text-center pb-12">
                        There are no NFTs
                    </div>
                )}
            </ScrollWithButton>
        </>
    );
});
