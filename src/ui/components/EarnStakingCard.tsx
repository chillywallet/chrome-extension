import { formatNumber } from '../../shared/utils/format';
import { ethers } from 'ethers';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentChainByPlatformId } from '../../lib/ChainsUtils';
import { EARN_PARTNERS, EarnItem, EarnListItem } from '../../shared/types/Earn';
import { getTokenBalance } from '../../store/actions/uiActions';
import { useCurrentAddress } from '../../store/selectors';
import Header from './Header';
import Modal from './Modal';
import SafeImage from './SafeImage';

// Sub-component to display each earn item with its balance
const EarnItemRow = React.memo<{
    index: number;
    item: EarnItem;
    platformId: number;
    onPress: (item: EarnItem) => void;
    onBalanceLoaded?: (index: number, balance: number) => void;
}>(props => {
    const { index, item, platformId, onPress, onBalanceLoaded } = props;
    const { partner_name, partner, apr, enabled, link } = item;

    const partnerObj = useMemo(() => {
        if (partner) {
            return partner;
        }
        return EARN_PARTNERS.find(p => p.name === partner_name);
    }, [partner_name, partner]);

    const walletAddress = useCurrentAddress(false);
    const [showValue, setShowValue] = useState(false);

    const tokenAddress = useMemo(() => {
        return item.toCoin.tokenAddress;
    }, [item]);

    const [{ balance, loadingBalance }, setBalanceData] = useState<{
        balance: number;
        loadingBalance: boolean;
    }>({ balance: 0, loadingBalance: true });

    useEffect(() => {
        if (walletAddress) {
            const chain = getCurrentChainByPlatformId(platformId);
            getTokenBalance(walletAddress, tokenAddress, false, chain.chain_id)
                .then(result => {
                    let finalBalance = 0;

                    if (!result.error) {
                        finalBalance = Number(
                            ethers.formatUnits(result.balance.toString(), result.decimals),
                        );
                    }

                    setBalanceData({ balance: finalBalance, loadingBalance: false });
                    // Notify parent component of the loaded balance
                    if (onBalanceLoaded) {
                        onBalanceLoaded(index, finalBalance);
                    }
                    setShowValue(true);
                })
                .catch((error: any) => {
                    setBalanceData({ balance: 0, loadingBalance: false });
                    if (onBalanceLoaded) {
                        onBalanceLoaded(index, 0);
                    }
                });
        } else {
            setBalanceData({ balance: 0, loadingBalance: false });
            if (onBalanceLoaded) {
                onBalanceLoaded(index, 0);
            }
        }
    }, [tokenAddress, walletAddress, platformId, onBalanceLoaded, index]);

    const processLink = useMemo(() => {
        if (link) {
            let processedLink = link;
            if (walletAddress) {
                processedLink = processedLink.replace(/{wallet}/g, walletAddress);
            }
            return processedLink;
        }
        return null;
    }, [link, walletAddress]);

    const handleClick = useCallback(() => {
        if (processLink && processLink.trim() !== '') {
            global.platform.openLink(processLink, '_blank', 'noopener,noreferrer');
        } else {
            if (enabled) {
                onPress(item);
            }
        }
    }, [processLink, enabled, onPress, item]);

    return (
        <div
            className={`p-4 border-b dark:border-slate-700 transition ${
                enabled === false
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
            onClick={handleClick}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div>
                        <div className="flex items-center gap-1 mt-1">
                            {partnerObj ? (
                                <>
                                    {partnerObj.imageUrl && (
                                        <img
                                            src={partnerObj.imageUrl}
                                            alt="Partner"
                                            className="w-4 h-4"
                                        />
                                    )}
                                    <span className="text-sm text-gray-500 dark:text-slate-200 font-medium">
                                        {partnerObj.name}
                                    </span>
                                </>
                            ) : null}

                            {enabled === false && (
                                <span className="text-xs bg-slate-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full ml-2">
                                    Coming Soon
                                </span>
                            )}
                        </div>
                        <div className="flex flex-row items-center gap-1 text-sm text-black dark:text-white">
                            <span>Staked: </span>
                            {loadingBalance ? (
                                <div className="w-20 h-4 bg-placeholder animate-pulse rounded"></div>
                            ) : (
                                <>
                                    {showValue ? (
                                        <div className="text-gray-500">
                                            {formatNumber(balance)} {item.toCoin.symbol}
                                        </div>
                                    ) : (
                                        <div className="bg-primary bg-opacity-10 text-gray-500 text-xs rounded-md px-2 py-1 mt-1">
                                            Click here to view balance
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <p className="text-sm">APR</p>
                    {apr ? (
                        <p className="text-sm text-green-500">{apr.toFixed(2)}%</p>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">TBD</p>
                    )}
                </div>
            </div>
        </div>
    );
});

type Props = {
    className?: string;
    onPress: (item: EarnItem) => void;
    data: EarnListItem;
};

export default React.memo<Props>((props: Props) => {
    const { className, onPress, data } = props;

    const [modalVisible, setModalVisible] = useState(false);

    return (
        <>
            <div
                className={
                    'mb-3 bg-white dark:bg-dark border border-slate-200 dark:border-darkline/60 rounded-2xl cursor-pointer hover:border-primary/50 dark:hover:border-accent/50 transition-colors ' +
                    className
                }
                onClick={() => setModalVisible(true)}>
                <div className="flex justify-between items-center border-b dark:border-b-slate-500 p-3 bg-slate-100 dark:bg-slate-900 rounded-t-lg">
                    <div className="flex items-center space-x-2">
                        <SafeImage src={data.imageUrl} className="w-8 h-8" alt="Icon" />
                        <span className="text-gray-800 dark:text-white text-sm font-semibold">
                            {data.name}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-700 dark:text-white">
                        <div className="bg-primary text-white text-xs px-2 py-1 rounded-lg">
                            Liquid
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-between items-center p-3 rounded-b-lg">
                    <div className="flex flex-row gap-3">
                        {data.data.map((item, index) => {
                            const partner = EARN_PARTNERS.find(p => p.name === item.partner_name);
                            return (
                                <div
                                    key={`${partner?.name}-${index}`}
                                    className="flex flex-row items-center gap-2"
                                    style={{ zIndex: data.data.length - index }}>
                                    <SafeImage
                                        src={partner?.imageUrl || null}
                                        className="w-4 h-4"
                                        alt={partner?.name ?? ''}
                                    />
                                    <span className="text-sm">{partner?.name}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-col items-end">
                        <p className="text-sm">APR</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Varies</p>
                    </div>
                </div>
            </div>

            <Modal visible={modalVisible} onClose={() => setModalVisible(false)}>
                <Header title="Select Provider" hasBackButton={false} onClosePress={() => setModalVisible(false)} />
                <div className="max-h-[60vh] overflow-y-auto">
                    {data.data && data.data.length > 0 ? (
                        data.data.map((item, index) => (
                            <EarnItemRow
                                key={index}
                                item={item}
                                platformId={data.platformId}
                                onPress={selectedItem => {
                                    setModalVisible(false);
                                    onPress(selectedItem);
                                }}
                                index={index}
                            />
                        ))
                    ) : (
                        <div className="p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400">No options available</p>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
});
