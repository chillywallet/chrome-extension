import { formatMoney } from '../../shared/utils/format';
import React, { useCallback, useMemo } from 'react';
import { SlOptionsVertical } from 'react-icons/sl';
import { CURRENT_CHAINS } from '../../lib/ChainsUtils';
import { NFT } from '../../shared/types/Wallet';
import { setNftsHideStatus } from '../../store/actions/uiActions';
import { usePreferences } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import SafeImage from './SafeImage';

type Props = {
    data: NFT;
    onPress: (coin: NFT) => void;
    showMenu?: boolean;
    type?: 'portfolio' | 'send';
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
    const { onPress, data, showMenu = true, type = 'portfolio' } = props;

    const dispatch = useAppDispatch();
    const { nftsHideStatus = {}, nftCollectionsHideStatus = {} } = usePreferences();

    const hiddenStatus =
        nftsHideStatus[data._id] || nftCollectionsHideStatus[data.nft_collection._id]
            ? 'hidden'
            : 'visible';

    const selectedChain = useMemo(() => {
        return CURRENT_CHAINS.find(chain => chain.chain_key === data.chain);
    }, [data]);

    let logo = data.image_url ?? data.previews.image_small_url;

    const menu = useMemo(() => {
        const _menu: { id: string; title: string; icon?: string }[] = [];

        if (hiddenStatus === 'visible') {
            _menu.push({
                id: 'hide',
                title: 'Hide This NFT',
            });
        }

        if (hiddenStatus === 'hidden') {
            _menu.push({
                id: 'show',
                title: 'Show This NFT',
            });
        }

        return _menu;
    }, [hiddenStatus]);

    const onMenuPress = useCallback(
        (type: string) => {
            switch (type) {
                case 'hide':
                    dispatch(setNftsHideStatus({ ...nftsHideStatus, [data._id]: true }));
                    break;

                case 'show': {
                    const next = { ...nftsHideStatus };
                    delete next[data._id];
                    dispatch(setNftsHideStatus(next));
                    break;
                }
            }
        },
        [data._id, dispatch, nftsHideStatus],
    );

    return (
        <button
            className={
                'col-span-6 lg:col-span-3 flex flex-col bg-white dark:bg-dark border border-slate-200 dark:border-darkline/60 hover:border-primary/50 dark:hover:border-accent/50 transition-colors w-full rounded-2xl p-3 ' +
                (type === 'portfolio' ? 'dark:bg-darker' : 'dark:bg-dark')
            }
            onClick={e => {
                e.preventDefault();
                onPress(data);
            }}>
            <div className="relative flex bg-slate-100 dark:bg-white/5 w-full aspect-square rounded-xl shrink-0 overflow-hidden mb-3">
                {logo ? (
                    <SafeImage
                        src={logo}
                        className="w-full h-full"
                        alt="NFT Image"
                        defaultPlaceholder={
                            <div className="w-full h-full flex items-center justify-center text-primary font-semibold text-3xl">
                                NFT
                            </div>
                        }
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-semibold text-3xl">
                        NFT
                    </div>
                )}

                {hiddenStatus === 'hidden' && (
                    <span className="absolute bottom-0 left-0 m-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                        Hidden
                    </span>
                )}

                {showMenu && menu.length > 0 && (
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
                                        onMenuPress(menu.id);
                                    }}
                                />
                            ))}
                        />
                    </div>
                )}
            </div>
            <div className="w-full text-left">
                <div className="text-sm text-black dark:text-white font-semibold truncate">
                    {data.name ?? data.token_id ?? 'N/A'}
                </div>

                {!selectedChain?.testnet && (
                    <div className="flex flex-row items-center justify-between mt-1">
                        <div className="text-sm text-gray-500">Price</div>
                        <div className="text-sm font-semibold text-black dark:text-white">
                            {formatMoney(data.current_usd_value)}
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
});
