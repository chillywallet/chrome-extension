import _ from 'lodash';
import { HandledNFTs, NFT, NFTList } from '../types/Wallet';

export const groupNFTs = (NFTs: NFTList[]) => {
    const collections: any[] = [];
    const wallets: any[] = [];
    const chains: any[] = [];
    const individuals: any[] = [];
    const all: any[] = [];

    NFTs.forEach(wallet => {
        let { _id, name, address, nftDetails, platform_id, integration_type, spamThreshold } =
            wallet;
        let avatar = null;

        const _wallet: any = {
            _id,
            name,
            avatar,
            wallet_address: address,
            collections: [],
            type: 'exchange',
            platform_id,
            integration_type,
        };

        nftDetails.forEach((_nft: NFT) => {
            const { nft_collection, chain } = _nft;

            _nft.spamThreshold = spamThreshold;
            _nft.wallet_address = address;
            _nft.platform_id = platform_id;

            nft_collection.spamThreshold = spamThreshold;

            const collectionIndex = collections.findIndex(
                _item => _item?.collection_id === _nft?.nft_collection?.collection_id,
            );

            if (collectionIndex === -1) {
                collections.push({
                    ...nft_collection,
                    platform_id,
                    items: [_nft],
                    type: 'collection',
                    spamThreshold,
                });
                all.push({
                    ...nft_collection,
                    platform_id,
                    items: [_nft],
                    type: 'collection',
                    spamThreshold,
                });
            } else {
                collections[collectionIndex].items.push(_nft);
                all[collectionIndex].items.push(_nft);
            }

            const walletIndex = _wallet.collections.findIndex(
                (_item: any) => _item?.collection_id === _nft?.nft_collection?.collection_id,
            );

            if (walletIndex === -1) {
                _wallet.collections.push({
                    ...nft_collection,
                    items: [_nft],
                });
            } else {
                _wallet.collections[walletIndex].items.push(_nft);
            }

            const chainIndex = chains.findIndex((_item: any) => _item.chain === _nft?.chain);

            if (chainIndex === -1) {
                chains.push({
                    _id: chain,
                    chain,
                    collections: [{ ...nft_collection, items: [_nft] }],
                    type: 'chain',
                    name: chain,
                    wallet_address: address,
                    platform_id,
                    integration_type,
                });
            } else {
                const chainCollectionIndex = chains[chainIndex].collections.findIndex(
                    (_item: any) => _item?.collection_id === _nft?.nft_collection?.collection_id,
                );

                if (chainCollectionIndex === -1) {
                    chains[chainIndex].collections.push({
                        ...nft_collection,
                        items: [_nft],
                    });
                } else {
                    chains[chainIndex].collections[chainCollectionIndex].items.push(_nft);
                }
            }

            individuals.push(_nft);
        });

        wallets.push(_wallet);
    });

    //fill with the total usd value
    collections.forEach((collection: any) => {
        let totalPrice = 0;
        collection.items.forEach((item: any) => {
            totalPrice += item.current_usd_value;
        });
        collection.total_price = totalPrice;
    });

    //sort by highest total usd value
    collections.sort((a, b) => {
        return b.total_price - a.total_price;
    });

    all.sort((a, b) => {
        return b.floor_price - a.floor_price;
    });

    individuals.sort((a, b) => {
        return b.current_usd_value - a.current_usd_value;
    });

    return {
        collections,
        chains,
        wallets,
        individuals,
        all: _.cloneDeep(collections),
    } as HandledNFTs;
};

export const filterByHideStatus = (
    data: HandledNFTs,
    spamNft: boolean,
    nftCollectionsHideStatus: { [key: string]: boolean },
    nftsHideStatus: { [key: string]: boolean },
) => {
    let returns: HandledNFTs = {
        collections: [],
        chains: [],
        wallets: [],
        individuals: [],
        all: [],
    };
    const _data = _.cloneDeep(data);

    Object.keys(_data).forEach((key: string) => {
        // @ts-ignore
        let array: any[] = _data[key];

        let nftList = [];

        if (key === 'individuals') {
            //filter by hide status
            array.forEach((item: any) => {
                let isShow = true;
                let collection = item.nft_collection;
                if (spamNft) {
                    if (collection.spam_score >= collection.spamThreshold) {
                        isShow = false;
                    }
                }
                //get override status from redux
                if (nftCollectionsHideStatus.hasOwnProperty(collection._id)) {
                    isShow = !nftCollectionsHideStatus[collection._id];
                }

                if (nftsHideStatus.hasOwnProperty(item._id)) {
                    isShow = !nftsHideStatus[item._id];
                }

                if (isShow) {
                    nftList.push(item);
                }
            });
        } else if (key === 'all') {
            nftList = array
                .map((collection: any) => {
                    let collectionStatus = 'visible';
                    if (spamNft) {
                        if (collection.spam_score >= collection.spamThreshold) {
                            collectionStatus = 'hidden';
                        }
                    }
                    //get override status from redux
                    if (nftCollectionsHideStatus.hasOwnProperty(collection._id)) {
                        collectionStatus = nftCollectionsHideStatus[collection._id]
                            ? 'hidden'
                            : 'visible';
                    }
                    collection.items = collection.items
                        .map((item: any) => {
                            //copy the status from collection
                            let status = collectionStatus;
                            if (nftsHideStatus.hasOwnProperty(item._id)) {
                                status = nftsHideStatus[item._id] ? 'hidden' : 'visible';
                            }
                            item.hiddenStatus = status;

                            if (status === 'hidden') {
                                return item;
                            }
                            return null;
                        })
                        .filter((item: any) => item !== null);

                    collection.hiddenStatus = 'hidden';
                    if (collection.items.length > 0) {
                        return collection;
                    }
                    return null;
                })
                .filter((item: any) => item !== null);
        } else if (key === 'collections') {
            nftList = array
                .map((collection: any) => {
                    let collectionStatus = 'visible';
                    if (spamNft) {
                        if (collection.spam_score >= collection.spamThreshold) {
                            collectionStatus = 'hidden';
                        }
                    }
                    //get override status from redux
                    if (nftCollectionsHideStatus.hasOwnProperty(collection._id)) {
                        collectionStatus = nftCollectionsHideStatus[collection._id]
                            ? 'hidden'
                            : 'visible';
                    }
                    collection.items = collection.items
                        .map((item: any) => {
                            //copy the status from collection
                            let status = collectionStatus;
                            if (nftsHideStatus.hasOwnProperty(item._id)) {
                                status = nftsHideStatus[item._id] ? 'hidden' : 'visible';
                            }
                            if (status === 'visible') {
                                return item;
                            }
                            return null;
                        })
                        .filter((item: any) => item !== null);

                    if (collection.items.length > 0) {
                        return collection;
                    }
                    return null;
                })
                .filter((item: any) => item !== null);
        } else if (key === 'wallets') {
            nftList = array
                .map((wallet: any) => {
                    wallet.collections = wallet.collections
                        .map((collection: any) => {
                            let collectionStatus = 'visible';
                            if (spamNft) {
                                if (collection.spam_score >= collection.spamThreshold) {
                                    collectionStatus = 'hidden';
                                }
                            }
                            //get override status from redux
                            if (nftCollectionsHideStatus.hasOwnProperty(collection._id)) {
                                collectionStatus = nftCollectionsHideStatus[collection._id]
                                    ? 'hidden'
                                    : 'visible';
                            }
                            collection.items = collection.items
                                .map((item: any) => {
                                    //copy the status from collection
                                    let status = collectionStatus;
                                    if (nftsHideStatus.hasOwnProperty(item._id)) {
                                        status = nftsHideStatus[item._id] ? 'hidden' : 'visible';
                                    }
                                    if (status === 'visible') {
                                        return item;
                                    }
                                    return null;
                                })
                                .filter((item: any) => item !== null);
                            if (collection.items.length > 0) {
                                return collection;
                            }
                            return null;
                        })
                        .filter((item: any) => item !== null);
                    return wallet;
                })
                .filter((item: any) => item !== null);
        } else {
            nftList = array;
        }

        // @ts-ignore
        returns[key] = nftList;
    });

    return returns;
};
