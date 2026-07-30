import { formatMoney, formatNumber } from '../../../shared/utils/format';
import { getAddress } from 'ethers';
import React, { useCallback, useMemo } from 'react';
import { IconType } from 'react-icons';
import { FaCoins, FaExternalLinkAlt, FaEye, FaLink } from 'react-icons/fa';
import { IoMdAddCircleOutline } from 'react-icons/io';
import { IoCartOutline } from 'react-icons/io5';
import {
    MdAttachMoney,
    MdCallMade,
    MdContentCopy,
    MdOutlineRefresh,
    MdOutlineSwapCalls,
    MdOutlineSwapVert,
    MdQrCode,
    MdVpnKey,
} from 'react-icons/md';
import { SlOptionsVertical } from 'react-icons/sl';
import { useHistory } from 'react-router-dom';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { getCurrentChains } from '../../../lib/ChainsUtils';
import {
    ENVIRONMENT_TYPE_FULLSCREEN,
    ENVIRONMENT_TYPE_SIDEPANEL,
} from '../../../shared/constants/app';
import {
    EARN_ROUTE,
    FIAT_OFF_RAMP_ROUTE,
    FIAT_ON_RAMP_ROUTE,
} from '../../../shared/constants/routes';
import { KeyringTypes } from '../../../controller/KeyringController';
import { PendingTransaction, Transaction } from '../../../shared/types/Wallet';
import eventManager from '../../../shared/utils/eventManager';
import { smartTrim } from '../../../shared/utils/string';
import { getEnvironmentType } from '../../../shared/utils/utils';
import {
    useCurrentAccount,
    useCurrentWallet,
    useIsTestnet,
    usePreferences,
    useSelectedNetwork,
    useSmartAddress,
} from '../../../store/selectors';
import CoinPortfolio from '../../components/CoinPortfolio';
import ContextMenu, { ContextMenuItem } from '../../components/ContextMenu';
import NFTPortfolio from '../../components/NFTPortfolio';
import ScrollWithButton from '../../components/ScrollWithButton';
import { SpeedUpAndCancelTxData } from '../../components/SpeedUpAndCancelModal';
import TransactionPortfolio from '../../components/TransactionPortfolio';
import { useRoutesData } from '../RoutesProvider';
import WalletProvider, { useWalletData } from './WalletProvider';

type Props = {
    setIsShowConnectedSites: (value: {
        isShowConnectedSites: boolean;
        isSmartWallet?: boolean;
    }) => void;
    onTransactionPress: (transaction: Transaction) => void;
    onPendingTransactionPress: (transaction: PendingTransaction) => void;
    setCancelSpeedUpTxData: (data: SpeedUpAndCancelTxData) => void;
};

type ActionButton = {
    type: string;
    name: string;
    icon: IconType;
    disabled?: boolean;
    monadOnly?: boolean;
    tooltip?: string;
};

const ACTION_BUTTONS: ActionButton[] = [
    {
        type: 'buy',
        name: 'Buy',
        icon: IoCartOutline,
    },
    {
        type: 'sell',
        name: 'Sell',
        icon: MdAttachMoney,
    },
    {
        type: 'send',
        name: 'Send',
        icon: MdCallMade,
    },
    {
        type: 'receive',
        name: 'Receive',
        icon: MdQrCode,
    },
    {
        type: 'swap',
        name: 'Swap',
        icon: MdOutlineSwapVert,
    },
    {
        type: 'earn',
        name: 'Earn',
        icon: FaCoins,
    },
    {
        type: 'bridge',
        name: 'Bridge',
        icon: MdOutlineSwapCalls,
        disabled: true,
        tooltip: 'Coming Soon',
    },
];

const EOAWalletTab = React.memo<Props>((props: Props) => {
    const {
        onAssetNFTPress,
        onCoinSendPress,
        onAssetCoinPress,
        setSubTabIndex,
        subTabIndex,
        showSpamNft,
        setShowSpamNft,
        onCoinSwapPress,
    } = useRoutesData();
    const {
        setIsShowConnectedSites,
        onTransactionPress,
        onPendingTransactionPress,
        setCancelSpeedUpTxData,
    } = props;

    const {
        containerClass,
        tooltipText,
        tooltipVariant,
        currentTotalCoins,
        isLoading,
        hasMore,
        onAddressPress,
        loadData,
        onLoadMore,
    } = useWalletData();

    const history = useHistory();
    const currentWallet = useCurrentWallet();
    const currentAccount = useCurrentAccount();
    const selectedNetwork = useSelectedNetwork();
    const isTestnet = useIsTestnet();
    const { earnList, earnEnabled, buyEnabled, sellEnabled, bridgeUrl } = usePreferences();

    const earnSupportedChainsIds = useMemo(() => {
        const ids: number[] = [];
        earnList?.forEach(earnItem => {
            const c = getCurrentChains().find(
                chain => chain.platform_id === earnItem.platformId,
            );
            if (c) {
                ids.push(c.chain_id);
            }
        });
        return [...new Set(ids)];
    }, [earnList]);

    const canRevealSeedPhrase = useMemo(() => {
        return currentAccount?.metadata?.keyring?.type === KeyringTypes.hd;
    }, [currentAccount?.metadata?.keyring?.type]);

    const canViewPrivateKey = useMemo(() => {
        const t = currentAccount?.metadata?.keyring?.type;
        return t === KeyringTypes.hd || t === KeyringTypes.simple;
    }, [currentAccount?.metadata?.keyring?.type]);

    const menu = useMemo(() => {
        const _menu = [
            {
                id: 'connected_sites',
                title: 'Connected Sites',
                icon: <FaLink />,
            },
        ];

        if (canRevealSeedPhrase) {
            _menu.push({
                id: 'reveal_seed_phrase',
                title: 'Reveal Seed Phrase',
                icon: <FaEye />,
            });
        }

        if (canViewPrivateKey) {
            _menu.push({
                id: 'get_private_key',
                title: 'View Private Key',
                icon: <MdVpnKey />,
            });
        }

        _menu.push({
            id: 'add_custom_token',
            title: 'Add Custom Token',
            icon: <IoMdAddCircleOutline size={18} />,
        });

        if (selectedNetwork.explorer_url) {
            _menu.unshift({
                id: 'view_explorer',
                title: 'View on Explorer',
                icon: <FaExternalLinkAlt />,
            });
        }

        return _menu;
    }, [canRevealSeedPhrase, canViewPrivateKey, selectedNetwork]);

    const onContextMenuClick = useCallback(
        (action: string) => {
            switch (action) {
                case 'view_explorer':
                    if (currentAccount) {
                        global.platform.openLink(
                            `${selectedNetwork.explorer_url}/address/${currentAccount.address}`,
                        );
                    }
                    break;

                case 'connected_sites':
                    setIsShowConnectedSites({ isShowConnectedSites: true });
                    break;

                case 'reveal_seed_phrase':
                    if (currentWallet) {
                        eventManager.showSeedPhraseModal(currentWallet);
                    }
                    break;

                case 'get_private_key':
                    if (currentAccount) {
                        eventManager.showPrivateKeyModal(currentAccount);
                    }
                    break;

                case 'add_custom_token':
                    if (currentAccount) {
                        eventManager.showAddCustomCoinModal(currentAccount.address);
                    }
                    break;
            }
        },
        [currentAccount, setIsShowConnectedSites, selectedNetwork, currentWallet],
    );

    const handleFiatOnOffRampNavigation = useCallback(
        (route: string) => {
            const environmentType = getEnvironmentType();

            if (
                environmentType === ENVIRONMENT_TYPE_FULLSCREEN ||
                environmentType === ENVIRONMENT_TYPE_SIDEPANEL
            ) {
                history.push(route);
            } else {
                global.platform.openExtensionInBrowser(route);
            }
        },
        [history],
    );

    const onActionButtonPress = useCallback(
        (type: string) => {
            switch (type) {
                case 'buy':
                    handleFiatOnOffRampNavigation(FIAT_ON_RAMP_ROUTE);
                    break;

                case 'sell':
                    handleFiatOnOffRampNavigation(FIAT_OFF_RAMP_ROUTE);
                    break;

                case 'send':
                    onCoinSendPress();
                    break;

                case 'receive':
                    if (currentAccount) {
                        eventManager.showWalletAddressModal({
                            account: currentAccount,
                            isSmartWallet: false,
                        });
                    }

                    break;

                case 'swap':
                    //reset coin to swap
                    onCoinSwapPress();
                    break;

                case 'earn':
                    history.push(EARN_ROUTE);
                    break;

                case 'bridge':
                    if (bridgeUrl) {
                        global.platform.openLink(bridgeUrl, '_blank');
                    }
                    break;
            }
        },
        [
            currentAccount,
            history,
            handleFiatOnOffRampNavigation,
            onCoinSendPress,
            onCoinSwapPress,
            bridgeUrl,
        ],
    );

    const actionButtons = useMemo(() => {
        return ACTION_BUTTONS.filter(button => {
            if (button.monadOnly && selectedNetwork.chain_key !== 'monad_testnet') {
                return false;
            }

            if (button.type === 'earn' && !earnEnabled) {
                return false;
            }

            // Fiat on/off-ramp is gated by FEATURE_FLAGS.buy/sellEnabled (src/config/defaults.ts).
            if (button.type === 'buy' && !buyEnabled) {
                return false;
            }

            if (button.type === 'sell' && !sellEnabled) {
                return false;
            }

            if (
                button.type === 'earn' &&
                !earnSupportedChainsIds?.includes(selectedNetwork.chain_id)
            ) {
                return false;
            }

            return true;
        }).map(button => {
            if (!selectedNetwork.swapSupport && button.type === 'swap') {
                return {
                    ...button,
                    disabled: true,
                    tooltip: 'Swap is not supported on this network',
                };
            }

            if (isTestnet && (button.type === 'buy' || button.type === 'sell')) {
                return {
                    ...button,
                    disabled: true,
                    tooltip: 'Buy/Sell is not available on testnet',
                };
            }

            if (button.type === 'bridge') {
                return {
                    ...button,
                    disabled: !bridgeUrl,
                    tooltip: bridgeUrl ? undefined : 'Coming Soon',
                };
            }

            return button;
        });
    }, [
        isTestnet,
        selectedNetwork,
        earnSupportedChainsIds,
        earnEnabled,
        buyEnabled,
        sellEnabled,
        bridgeUrl,
    ]);

    const checksumAddress = useMemo(() => {
        try {
            return getAddress(currentAccount?.address ?? '');
        } catch (error) {
            return currentAccount?.address ?? '';
        }
    }, [currentAccount]);

    return (
        <ScrollWithButton
            className={
                'flex flex-col items-center w-full relative overflow-y-auto ' + containerClass
            }>
            <div className="flex flex-col mt-6 justify-center items-center w-full relative px-4">
                {/* Balance hero */}
                <div className="flex flex-row items-center gap-2">
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Total balance</p>
                    {isLoading ? (
                        <MdOutlineRefresh
                            size={15}
                            className="custom-anim-fast text-gray-400 dark:text-gray-500"
                        />
                    ) : (
                        <div
                            id="refresh-wallet"
                            className="cursor-pointer text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-accent transition-colors"
                            data-tooltip-id="chilly-tooltip"
                            data-tooltip-variant={tooltipVariant}
                            data-tooltip-content="Refresh Wallet"
                            data-tooltip-place="top"
                            onClick={loadData}>
                            <MdOutlineRefresh size={15} />
                        </div>
                    )}
                    <ContextMenu
                        placeholder={
                            <div className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-accent transition-colors">
                                <SlOptionsVertical size={13} className="wallet-context-menu" />
                            </div>
                        }
                        menus={menu.map((menu, index) => (
                            <ContextMenuItem
                                key={index}
                                title={menu.title}
                                icon={menu.icon}
                                onClick={() => {
                                    onContextMenuClick(menu.id);
                                }}
                            />
                        ))}
                    />
                </div>

                {isTestnet ? (
                    <p className="font-display tabular-nums text-[28px] leading-tight font-medium mt-1">
                        {formatNumber(currentTotalCoins)} {selectedNetwork.native_coin_symbol}
                    </p>
                ) : (
                    <p className="font-display tabular-nums text-[34px] leading-tight font-medium mt-1">
                        {formatMoney(currentTotalCoins)}
                    </p>
                )}

                <button
                    data-tooltip-id="chilly-tooltip"
                    data-tooltip-variant={tooltipVariant}
                    data-tooltip-content={tooltipText}
                    data-tooltip-place="top"
                    className="flex flex-row items-center gap-1.5 mt-2.5 px-3 h-7 rounded-full bg-slate-100 dark:bg-white/5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-accent transition-colors"
                    onClick={onAddressPress}>
                    <p>{smartTrim(checksumAddress, 15)}</p>
                    <MdContentCopy size={13} />
                </button>

                <div className="aurora-line w-16 mt-5" aria-hidden="true" />

                {/* Action tiles */}
                <div className="grid grid-flow-col auto-cols-fr gap-2 w-full lg:w-[400px] mt-5">
                    {actionButtons.map(button => {
                        const tooltip = button.tooltip
                            ? {
                                  'data-tooltip-id': 'chilly-tooltip',
                                  'data-tooltip-variant': tooltipVariant,
                                  'data-tooltip-content': button.tooltip,
                                  'data-tooltip-place': 'top',
                              }
                            : {};
                        return (
                            // @ts-ignore
                            <button
                                disabled={!!button.disabled}
                                key={button.type}
                                className="flex flex-col items-center justify-center gap-1.5 h-16 min-w-0 rounded-[14px] bg-white dark:bg-dark border border-slate-200 dark:border-darkline/60 hover:border-primary/50 dark:hover:border-accent/50 disabled:opacity-40 disabled:hover:border-slate-200 dark:disabled:hover:border-darkline/60 transition-colors"
                                onClick={e => {
                                    e.preventDefault();
                                    onActionButtonPress(button.type);
                                }}
                                {...tooltip}>
                                <button.icon size={20} className="text-primary dark:text-accent" />
                                <p className="text-[11px] leading-none text-gray-600 dark:text-gray-300">
                                    {button.name}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>
            <Tabs
                onSelect={index => {
                    setSubTabIndex(index);
                }}
                selectedIndex={subTabIndex}
                selectedTabClassName="tab-selected-tab-class-name"
                selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                className="tab-class-name mt-6">
                <TabList className="tab-tablist sticky top-0 z-20">
                    <Tab className="tab-tablist-tab">Coins</Tab>
                    <Tab className="tab-tablist-tab">NFTs</Tab>
                    <Tab className="tab-tablist-tab">Transactions</Tab>
                </TabList>

                <TabPanel>
                    <CoinPortfolio
                        onCoinPress={onAssetCoinPress}
                        walletAddress={currentAccount?.address ?? ''}
                    />
                </TabPanel>
                <TabPanel>
                    <NFTPortfolio
                        onNftPress={onAssetNFTPress}
                        showSpamNft={showSpamNft}
                        setShowSpamNft={setShowSpamNft}
                        walletAddress={currentAccount?.address ?? ''}
                        containerClass={containerClass}
                    />
                </TabPanel>
                <TabPanel>
                    <TransactionPortfolio
                        hasMore={hasMore}
                        onLoadMore={onLoadMore}
                        onTransactionPress={onTransactionPress}
                        onPendingTransactionPress={onPendingTransactionPress}
                        walletAddress={currentAccount?.address ?? ''}
                        containerClass={containerClass}
                        setCancelSpeedUpTxData={setCancelSpeedUpTxData}
                    />
                </TabPanel>
            </Tabs>
        </ScrollWithButton>
    );
});

const EOAWalletTabWithProvider = React.memo<Props>((props: Props) => {
    const currentAccount = useCurrentAccount();
    const smartAddress = useSmartAddress();

    return (
        <WalletProvider
            isSmartWallet={false}
            walletAddress={currentAccount?.address}
            otherAddress={smartAddress}>
            <EOAWalletTab {...props} />
        </WalletProvider>
    );
});

export default EOAWalletTabWithProvider;
