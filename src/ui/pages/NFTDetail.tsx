/* eslint-disable jsx-a11y/img-redundant-alt */
import {
    convertTimestampToDateIfNeeds,
    formatMoney,
    formatNumber,
} from '../../shared/utils/format';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { SlOptionsVertical } from 'react-icons/sl';
import { useHistory } from 'react-router-dom';
import { CURRENT_CHAINS } from '../../lib/ChainsUtils';
import CoinsUtils from '../../lib/CoinsUtils';
import { DEFAULT_ROUTE } from '../../shared/constants/routes';
import { NFT, SingleNFTDetail } from '../../shared/types/Wallet';
import { toTitleCase } from '../../shared/utils/string';
import { getCurrentScreenBreakpoint } from '../../shared/utils/utils';
import { useNativeCoinPrice, useSelectedNetwork } from '../../store/selectors';
import Carousel from '../components/Carousel';
import ContextMenu, { ContextMenuItem } from '../components/ContextMenu';
import Header from '../components/Header';
import NFTExpandableCard from '../components/NFTExpandableCard';
import SafeImage from '../components/SafeImage';
import WalletTag from '../components/WalletTag';
import { useRoutesData } from './RoutesProvider';

type Props = {};

type Detail = {
    name: string;
    value?: string;
    link?: string;
};

const Placeholder = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5">
            <div>
                <div className="animate-pulse bg-placeholder nft-box"></div>

                <div className="mt-5 animate-pulse bg-placeholder rounded-md mb-1 h-5"></div>
                <div className="animate-pulse bg-placeholder rounded-md mb-4 h-5"></div>

                <div className="animate-pulse bg-placeholder rounded-md mb-3 h-12"></div>

                <div className="grid grid-cols-2 gap-5">
                    <div className="animate-pulse bg-placeholder rounded-lg mb-3 h-24"></div>
                    <div className="animate-pulse bg-placeholder rounded-lg mb-3 h-24"></div>
                </div>
            </div>

            <div>
                <div className="animate-pulse bg-placeholder rounded-lg mb-3 h-32"></div>

                <div className="animate-pulse bg-placeholder rounded-lg mb-3 h-32"></div>

                <div className="animate-pulse bg-placeholder rounded-lg mb-3 h-32"></div>

                <div className="animate-pulse bg-placeholder rounded-lg mb-3 h-32"></div>
            </div>
        </div>
    );
};

export default React.memo<Props>((props: Props) => {
    const { sendAssetViewData, onNFTSendPress } = useRoutesData();
    const nft = sendAssetViewData?.nftToSend;
    const isAAWallet = sendAssetViewData?.isAAWallet ?? false;

    const { _id, spamThreshold } = nft ?? {};

    const history = useHistory();
    const selectedNetwork = useSelectedNetwork();
    const nativeCoinPrice = useNativeCoinPrice();

    const [data, setData] = useState<SingleNFTDetail | null>(null);
    const [defaultExpanded, setDefaultExpanded] = useState(false);

    const nftDetails = useMemo(() => {
        return data?.nftDetails ?? ({} as NFT);
    }, [data]);

    useEffect(() => {
        let breakpoint = getCurrentScreenBreakpoint();
        if (breakpoint) {
            if (['lg', 'xl', '2xl'].includes(breakpoint)) {
                setDefaultExpanded(true);
            }
        }
    }, []);

    useEffect(() => {
        CoinsUtils.fetchNativeCoinPrice(selectedNetwork);
    }, [selectedNetwork]);

    const {
        name,
        image_url,
        audio_url,
        video_url,
        token_id,
        nft_collection: {
            name: collection_name,
            floor_prices,
            floor_price,
            image_url: collection_image_url,
            description: collection_description,
            spam_score,
        } = { name: '' },
        estimate_eth_price,
        description,
        extra_metadata,
    } = nftDetails;

    const [loading, setLoading] = useState(true);

    const [selectedMarketIndex, setSelectedMarketIndex] = useState(0);
    const [detailsList, setDetailsList] = useState<Detail[]>([]);

    useEffect(() => {
        if (!nft) {
            history.replace(DEFAULT_ROUTE);
        }
    }, [nft, history]);

    const selectedChain = useMemo(() => {
        return CURRENT_CHAINS.find(chain => chain.chain_key === nftDetails.chain);
    }, [nftDetails]);

    useEffect(() => {
        // NFT details now come straight from the data provider's list payload —
        // there is no separate backend detail endpoint anymore.
        if (nft) {
            const details = (nft as any).nftDetails ?? nft;
            setData({
                _id: details._id ?? _id ?? '',
                name: details.name ?? '',
                address: details.contract_address ?? '',
                platform_id: details.platform_id ?? selectedNetwork.platform_id,
                integration_type: 'wallet',
                nftDetails: details,
            });
        } else {
            setData(null);
        }
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_id, nft]);

    useEffect(() => {
        if (nftDetails && selectedNetwork) {
            const details: Detail[] = [];
            details.push({
                name: 'Contract Address',
                value: nftDetails.contract_address,
                link: `${selectedNetwork.explorer_url}/address/${nftDetails.contract_address}`,
            });
            details.push({
                name: 'Token ID',
                value: nftDetails.token_id,
            });
            nftDetails.contract?.type &&
                details.push({
                    name: 'Token Standard',
                    value: nftDetails.contract?.type,
                });
            details.push({
                name: 'Blockchain',
                value: nftDetails.chain,
            });
            details.push({
                name: 'Status',
                value: nftDetails.status,
            });

            if (nftDetails.nft_collection) {
                const { external_url, marketplace_pages } = nftDetails.nft_collection;
                external_url &&
                    details.push({
                        name: 'Website',
                        value: external_url,
                        link: external_url,
                    });

                if (marketplace_pages?.length) {
                    marketplace_pages.forEach((market: any) => {
                        details.push({
                            name: market.marketplace_name,
                            value: market.collection_url,
                            link: market.collection_url,
                        });
                    });
                }
            }

            setDetailsList(details);
        }
    }, [nftDetails, selectedNetwork]);

    const onFloorPricePress = useCallback(() => {
        let index = selectedMarketIndex + 1;
        if (floor_prices?.length && index > floor_prices?.length - 1) {
            index = 0;
        }
        setSelectedMarketIndex(index);
    }, [floor_prices, selectedMarketIndex]);

    const selectedMarketplace = useMemo(() => {
        let ret = floor_prices ? floor_prices[selectedMarketIndex] : null;
        if (ret == null) {
            ret = {
                marketplace_id: 'opensea',
                marketplace_name: 'OpenSea',
                value: floor_price ?? 0,
            };
        }
        return ret;
    }, [floor_price, floor_prices, selectedMarketIndex]);

    const slides = useMemo(() => {
        let _slides = [];
        if (video_url) {
            _slides.push(<video key={'video'} src={video_url} className="nft-box" />);
        }

        if (audio_url) {
            _slides = [<audio key={'audio'} src={audio_url} controls className="nft-box" />];
        } else if (image_url) {
            _slides.push(
                <div className="relative" key={'image'}>
                    {/* {nftPreviews?.blurhash && (
                        <Blurhash
                            hash={nftPreviews?.blurhash}
                            width={400}
                            height={400}
                            resolutionX={32}
                            resolutionY={32}
                            punch={1}
                        />
                    )} */}

                    <SafeImage
                        src={image_url}
                        className="w-full h-full object-cover rounded-lg"
                        alt="NFT Image"
                        defaultPlaceholder={
                            <div className="w-full bg-slate-100 dark:bg-slate-900 aspect-square flex items-center justify-center text-primary text-3xl">
                                NFT
                            </div>
                        }
                    />
                </div>,
            );
        }

        return _slides;
    }, [video_url, audio_url, image_url]);

    const propertiesView = useMemo(() => {
        return extra_metadata?.attributes?.length ? (
            <NFTExpandableCard
                title="Properties"
                className="mb-5"
                defaultExpanded={defaultExpanded}>
                <table className="w-full text-xs">
                    <tbody>
                        {extra_metadata?.attributes.map((property: any, key: number) => (
                            <tr key={key}>
                                <td>{toTitleCase(property.trait_type)}</td>
                                <td className="text-primary dark:text-gray-200">
                                    {convertTimestampToDateIfNeeds(property.value)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </NFTExpandableCard>
        ) : null;
    }, [extra_metadata, defaultExpanded]);

    const detailsView = useMemo(() => {
        return detailsList.length !== 0 ? (
            <NFTExpandableCard title="Details" className="mb-5" defaultExpanded={defaultExpanded}>
                <table className="w-full text-xs">
                    <tbody>
                        {detailsList.map((detail, key) => (
                            <tr key={key}>
                                <td>{detail.name}</td>
                                <td>
                                    {detail.link ? (
                                        <div
                                            className="text-primary dark:text-white hover:underline cursor-pointer truncate w-[100px]"
                                            onClick={() => {
                                                if (detail.link) {
                                                    global.platform.openLink(detail.link, '_blank');
                                                }
                                            }}>
                                            {detail.value}
                                        </div>
                                    ) : (
                                        <div className="text-gray-500 dark:text-gray-200 truncate w-[100px]">
                                            {detail.value}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </NFTExpandableCard>
        ) : null;
    }, [detailsList, defaultExpanded]);

    return (
        <>
            <Header
                title={name}
                action={
                    <div className="flex flex-row items-center justify-center">
                        <WalletTag className="mr-2" isAAWallet={isAAWallet} />
                        <ContextMenu
                            placeholder={<SlOptionsVertical size={18} />}
                            menus={
                                <ContextMenuItem
                                    title={'View on ' + selectedNetwork.explorer_name}
                                    icon={<FaExternalLinkAlt className="text-xs" />}
                                    onClick={() => {
                                        global.platform.openLink(
                                            `${selectedNetwork.explorer_url}/address/${nftDetails.contract_address}`,
                                            '_blank',
                                        );
                                    }}
                                />
                            }
                        />
                    </div>
                }
            />

            {loading ? (
                <Placeholder />
            ) : data ? (
                <div className="h-[calc(100vh-3rem)] sm:h-[calc(100vh-40px-3rem)] overflow-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5">
                        <div className="flex flex-col gap-5">
                            {spam_score && spamThreshold && spam_score > spamThreshold ? (
                                <div className="bg-red-200 text-red-600 rounded-md text-sm p-3">
                                    This NFT has a high spam score. Please be cautious.
                                </div>
                            ) : null}

                            {slides.length > 0 && (
                                <div className="nft-box">
                                    {slides.length > 1 ? (
                                        <div className="relative">
                                            <Carousel slides={slides} />
                                        </div>
                                    ) : (
                                        slides
                                    )}
                                </div>
                            )}

                            <div>
                                {collection_name && (
                                    <div className="text-gray-500 text-sm mb-1">
                                        {collection_name}
                                    </div>
                                )}

                                <div className="text-lg font-semibold">
                                    {name ?? token_id ?? 'N/A'}
                                </div>
                            </div>

                            <button
                                className="btn btn-primary w-full"
                                onClick={() => {
                                    if (nft) {
                                        onNFTSendPress(nft, isAAWallet);
                                    }
                                }}>
                                Send This NFT
                            </button>
                            <div className="grid grid-cols-2 gap-5">
                                {selectedMarketplace?.value > 0 ? (
                                    <div
                                        className="flex flex-col items-center cursor-pointer bg-white dark:bg-dark border border-slate-200 dark:border-darkline/60 hover:border-primary/50 dark:hover:border-accent/50 rounded-2xl py-3 transition-colors"
                                        onClick={onFloorPricePress}>
                                        <div className="text-gray-500 dark:text-white text-center text-sm">
                                            Floor Price
                                        </div>

                                        <div className="text-lg font-semibold text-center text-primary">
                                            {formatNumber(selectedMarketplace?.value)}
                                        </div>

                                        {!selectedChain?.testnet && nativeCoinPrice > 0 && (
                                            <div className="text-sm font-semibold text-center text-gray-600 dark:text-white">
                                                {formatMoney(
                                                    selectedMarketplace?.value * nativeCoinPrice,
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : null}

                                {estimate_eth_price && estimate_eth_price > 0 ? (
                                    <div className="flex flex-col items-center bg-white dark:bg-dark border border-slate-200 dark:border-darkline/60 rounded-2xl py-3">
                                        <div className="text-gray-500 dark:text-white text-center text-sm">
                                            Estimated Price
                                        </div>

                                        <div className="text-lg font-semibold text-center text-primary">
                                            {formatNumber(estimate_eth_price ?? 0)}
                                        </div>

                                        {!selectedChain?.testnet && nativeCoinPrice > 0 && (
                                            <div className="text-sm font-semibold text-center text-gray-600 dark:text-white">
                                                {formatMoney(
                                                    (estimate_eth_price ?? 0) * nativeCoinPrice,
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div>
                            {description && (
                                <NFTExpandableCard
                                    title="Description"
                                    defaultExpanded
                                    className="mb-5">
                                    {description}
                                </NFTExpandableCard>
                            )}

                            <NFTExpandableCard
                                title="About Collection"
                                defaultExpanded={defaultExpanded}
                                className="mb-5">
                                <div className="flex flex-row items-center">
                                    <div className="w-8 h-8 bg-gray-100 flex items-center justify-center rounded-lg overflow-hidden">
                                        {collection_image_url ? (
                                            <SafeImage
                                                src={collection_image_url}
                                                className="w-full h-full"
                                                alt="NFT Collection"
                                                defaultPlaceholder={
                                                    <div className="w-full h-full flex items-center justify-center text-primary text-3xl">
                                                        NFT
                                                    </div>
                                                }
                                            />
                                        ) : (
                                            <div className="text-primary">NFT</div>
                                        )}
                                    </div>

                                    <div className="font-semibold ml-3">{collection_name}</div>
                                </div>

                                {collection_description && (
                                    <div className="mt-5 text-sm">{collection_description}</div>
                                )}
                            </NFTExpandableCard>

                            {/* Properties */}
                            {propertiesView}

                            {/* Details */}
                            {detailsView}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-5">
                    <div className="bg-red-200 text-red-600 border border-red-600 rounded-md text-sm p-3 mb-3">
                        Cannot Load NFT Data
                    </div>
                </div>
            )}
        </>
    );
});
