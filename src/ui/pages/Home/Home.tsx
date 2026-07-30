import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AiFillCaretDown } from 'react-icons/ai';
import { BsBarChartLineFill, BsWalletFill } from 'react-icons/bs';
import { MdOutlineSettings } from 'react-icons/md';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { FaAddressBook, FaExpand, FaLock } from 'react-icons/fa';
import { TbLayoutSidebarRight } from 'react-icons/tb';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { KeyringTypes } from '../../../controller/KeyringController';
import { ensureLedgerWebHidPermission } from '../../../lib/ledger/ensureLedgerWebHidPermission';
import {
    LEDGER_ERR_COULD_NOT_CONNECT,
    LEDGER_ERR_NO_LEDGER_SELECTED,
} from '../../../lib/ledger/ledgerErrorMessages';
import { ENVIRONMENT_TYPE_FULLSCREEN, ENVIRONMENT_TYPE_POPUP } from '../../../shared/constants/app';
import { CONTACT_ROUTE, SETTINGS_ROUTE } from '../../../shared/constants/routes';
import EventType from '../../../shared/types/EventType';
import { HomeTabType } from '../../../shared/types/Home';
import {
    ChillyAccount,
    ChillyWallet,
    PendingTransaction,
    Transaction,
} from '../../../shared/types/Wallet';
import eventManager from '../../../shared/utils/eventManager';
import { getEnvironmentType } from '../../../shared/utils/utils';
import {
    clearLedgerHardwarePreviewSession,
    clearTrezorHardwarePreviewSession,
    lockApp,
    setExploreRedDot,
    setSelectedAccount,
    setSelectedWallet,
} from '../../../store/actions/uiActions';
import {
    useCurrentAccount,
    useCurrentWallet,
    useKeyrings,
    usePreferences,
    useSelectedNetwork,
} from '../../../store/selectors';
import AccountMenu from '../../components/AccountMenu';
import AddAccount from '../../components/AddAccount';
import AddCustomCoinModal from '../../components/AddCustomCoinModal';
import AddressView from '../../components/AddressView';
import ConnectedSitesModal from '../../components/ConnectedSitesModal';
import ContextMenu, { ContextMenuItem } from '../../components/ContextMenu';
import EditAccount from '../../components/EditAccount';
import EditWallet from '../../components/EditWallet';
import EmojiView from '../../components/EmojiView';
import HardwareSelectAddressesModal from '../../components/HardwareSelectAddressesModal';
import NetworkMenu from '../../components/NetworkMenu';
import NotConnectedSiteModal from '../../components/NotConnectedSiteModal';
import PendingTransactionModal from '../../components/PendingTransactionModal';
import PrivateKeyModal from '../../components/PrivateKeyModal';
import SeedPhraseModal from '../../components/SeedPhraseModal';
import SpeedUpAndCancelModal, {
    SpeedUpAndCancelTxData,
} from '../../components/SpeedUpAndCancelModal';
import TextTruncate from '../../components/TextTruncate';
import Toast from '../../components/Toast';
import TransactionDetailModal from '../../components/TransactionDetailModal';
import { useRoutesData } from '../RoutesProvider';
import EOAWalletTab from './EOAWalletTab';
import ExploreTab from './ExploreTab';
import HomeProvider from './HomeProvider';

export type HomeProps = {};

const GLOBAL_CONTEXT_MENUS = [
    {
        id: 'contacts',
        title: 'Contacts',
        icon: <FaAddressBook />,
    },
    {
        id: 'settings',
        title: 'Settings',
        icon: <MdOutlineSettings size={18} />,
    },
    {
        id: 'expand',
        title: 'Expand View',
        icon: <FaExpand />,
    },
    {
        id: 'lock',
        title: 'Lock Chilly',
        icon: <FaLock />,
    },
];

export default React.memo<HomeProps>((props: HomeProps) => {
    const {
        setHomeTabIndex,
        homeTabIndex,
        connectedAccounts,
        isShowNotConnectedModal,
        setIsShowNotConnectedModal,
    } = useRoutesData();

    const { exploreRedDotDate, exploreRedDot } = usePreferences();

    const history = useHistory();
    const dispatch = useDispatch();
    const keyrings = useKeyrings();

    const currentAccount = useCurrentAccount();
    const currentWallet = useCurrentWallet();
    const selectedNetwork = useSelectedNetwork();

    const [isShowNetworkMenu, setIsShowNetworkMenu] = useState(false);
    const [isShowAccountMenu, setIsShowAccountMenu] = useState(false);
    const [
        {
            isShowAddressView,
            showAddressViewAccount,
            showAddressViewSmart,
            showAddressViewWalletAddress,
        },
        setShowAddressData,
    ] = useState<{
        isShowAddressView: boolean;
        showAddressViewAccount?: ChillyAccount;
        showAddressViewSmart?: boolean;
        showAddressViewWalletAddress?: string;
    }>({ isShowAddressView: false });
    const [{ isShowConnectedSites, isSmartWallet }, setIsShowConnectedSites] = useState<{
        isShowConnectedSites: boolean;
        isSmartWallet?: boolean;
    }>({ isShowConnectedSites: false });
    const [{ isShowSeedPhrase, showSeedPhraseWallet }, setShowSeedPhraseData] = useState<{
        isShowSeedPhrase: boolean;
        showSeedPhraseWallet?: ChillyWallet;
    }>({ isShowSeedPhrase: false });
    const [{ isShowPrivateKey, showPrivateKeyAccount }, setShowPrivateKeyData] = useState<{
        isShowPrivateKey: boolean;
        showPrivateKeyAccount?: ChillyAccount;
    }>({ isShowPrivateKey: false });
    const [{ isShowAddAccount, addAccountWallet }, setAddAccountData] = useState<{
        isShowAddAccount: boolean;
        addAccountWallet?: ChillyWallet;
    }>({
        isShowAddAccount: false,
    });
    const [hardwareAddAccountModal, setHardwareAddAccountModal] = useState<{
        visible: boolean;
        walletId: string | null;
        hardware: 'ledger' | 'trezor';
    }>({ visible: false, walletId: null, hardware: 'ledger' });
    const [{ isShowEditAccount, editAccount, isEditSmartAccount }, setEditAccountData] = useState<{
        editAccount?: ChillyAccount;
        isShowEditAccount: boolean;
        isEditSmartAccount?: boolean;
    }>({
        isShowEditAccount: false,
    });
    const [{ isShowEditWallet, editWallet }, setEditWalletData] = useState<{
        editWallet?: ChillyWallet;
        isShowEditWallet: boolean;
    }>({
        isShowEditWallet: false,
    });
    const [{ isShowTransactionDetail, transactionDetailData }, setTransactionDetail] = useState<{
        transactionDetailData?: Transaction;
        isShowTransactionDetail: boolean;
    }>({
        isShowTransactionDetail: false,
    });
    const [{ isShowPendingTxDetail, pendingTxDetailData }, setPendingTxDetail] = useState<{
        pendingTxDetailData?: PendingTransaction;
        isShowPendingTxDetail: boolean;
    }>({
        isShowPendingTxDetail: false,
    });
    const [{ isShowAddCustomCoinModal, addingWalletAddress }, setAddCustomCoinData] = useState<{
        addingWalletAddress?: string;
        isShowAddCustomCoinModal: boolean;
    }>({
        isShowAddCustomCoinModal: false,
    });
    const [cancelSpeedUpTxData, setCancelSpeedUpTxData] = useState<SpeedUpAndCancelTxData>({
        visible: false,
    });
    const [showSidePanelButton, setShowSidePanelButton] = useState(false);
    const [isRunningInIncognito, setIsRunningInIncognito] = useState(false);

    const settingsMenu = useMemo(() => {
        return GLOBAL_CONTEXT_MENUS;
    }, []);

    const showExpandMenu = useMemo(() => {
        return getEnvironmentType() !== ENVIRONMENT_TYPE_FULLSCREEN && !isRunningInIncognito;
    }, [isRunningInIncognito]);

    const accountName = useMemo(() => {
        return currentAccount?.metadata.name ?? '';
    }, [currentAccount]);

    const onContextMenuClick = useCallback(
        (action: string) => {
            switch (action) {
                case 'expand':
                    global.platform.openExtensionInBrowser();
                    break;

                case 'contacts':
                    history.push(CONTACT_ROUTE);
                    break;

                case 'settings':
                    history.push(SETTINGS_ROUTE);
                    break;

                case 'lock':
                    dispatch(lockApp());
                    break;
            }
        },
        [dispatch, history],
    );

    const onTransactionPress = useCallback((transaction: Transaction) => {
        setTransactionDetail({ transactionDetailData: transaction, isShowTransactionDetail: true });
    }, []);

    const onPendingTransactionPress = useCallback((transaction: PendingTransaction) => {
        setPendingTxDetail({ isShowPendingTxDetail: true, pendingTxDetailData: transaction });
    }, []);

    const onAccountPress = useCallback(
        (account: ChillyAccount, wallet: ChillyWallet) => {
            if (currentWallet && currentWallet.id !== wallet.id) {
                dispatch(setSelectedWallet(wallet.id));
            }

            dispatch(setSelectedAccount(account.id));
            setIsShowAccountMenu(false);
        },
        [currentWallet, dispatch],
    );

    const onSwitchAccountPress = useCallback(
        (account: ChillyAccount, wallet: ChillyWallet) => {
            if (currentWallet && currentWallet.id !== wallet.id) {
                dispatch(setSelectedWallet(wallet.id));
            }

            dispatch(setSelectedAccount(account.id));
            setIsShowNotConnectedModal(false);
        },
        [currentWallet, dispatch, setIsShowNotConnectedModal],
    );

    const onEditAccountBackPress = useCallback(() => {
        setIsShowAccountMenu(true);
        setEditAccountData({ isShowEditAccount: false });
    }, []);

    const onTabPress = useCallback(
        (index: number) => {
            setHomeTabIndex(index);
        },
        [setHomeTabIndex],
    );

    const handleHardwareAddAccountModalClose = useCallback(async () => {
        setHardwareAddAccountModal({ visible: false, walletId: null, hardware: 'ledger' });
        try {
            await dispatch(clearLedgerHardwarePreviewSession());
            await dispatch(clearTrezorHardwarePreviewSession());
        } catch {
            /* best-effort */
        }
    }, [dispatch]);

    const handleHardwareAddAccountComplete = useCallback(async () => {
        eventManager.emit(EventType.ACCOUNTS_CHANGE);
        await handleHardwareAddAccountModalClose();
    }, [handleHardwareAddAccountModalClose]);

    const onAddNewAccountPress = useCallback(
        async (wallet: ChillyWallet) => {
            const kr = keyrings.find(k => k.id === wallet.id);

            if (kr?.type === KeyringTypes.ledger) {
                try {
                    await ensureLedgerWebHidPermission();
                    setHardwareAddAccountModal({
                        visible: true,
                        walletId: wallet.id,
                        hardware: 'ledger',
                    });
                } catch (error: unknown) {
                    const message =
                        error instanceof Error ? error.message : LEDGER_ERR_COULD_NOT_CONNECT;

                    if (message === LEDGER_ERR_NO_LEDGER_SELECTED) {
                        return;
                    }

                    Toast.showError(message);
                    return;
                }
                return;
            }

            if (kr?.type === KeyringTypes.trezor) {
                setHardwareAddAccountModal({
                    visible: true,
                    walletId: wallet.id,
                    hardware: 'trezor',
                });
                return;
            }

            setAddAccountData({ isShowAddAccount: true, addAccountWallet: wallet });
        },
        [keyrings],
    );

    useEffect(() => {
        global.platform.isRunningInIncognito().then(setIsRunningInIncognito);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const func = async () => {
            if (getEnvironmentType() === ENVIRONMENT_TYPE_POPUP) {
                const activeTabs = await global.platform.getCurrentActiveTabs();
                const expandedViewIds = await global.platform.getExpandedViewIds();

                let isShow = true;
                if (activeTabs.length > 0) {
                    const currentTab = activeTabs[0];
                    if (currentTab?.id && expandedViewIds.includes(currentTab.id)) {
                        isShow = false;
                    }
                }

                setShowSidePanelButton(isShow);
            } else {
                setShowSidePanelButton(false);
            }
        };

        func();
    }, []);

    useEffect(() => {
        const showSeedPhraseCb = (wallet: ChillyWallet) => {
            setShowSeedPhraseData({
                isShowSeedPhrase: true,
                showSeedPhraseWallet: wallet,
            });
        };
        const showPrivateKeyCb = (account: ChillyAccount) => {
            setShowPrivateKeyData({
                isShowPrivateKey: true,
                showPrivateKeyAccount: account,
            });
        };
        const showWalletAddressCb = (params: {
            account?: ChillyAccount;
            isSmartWallet?: boolean;
            walletAddress?: string;
        }) => {
            const { account, isSmartWallet, walletAddress } = params;
            setShowAddressData({
                isShowAddressView: true,
                showAddressViewAccount: account,
                showAddressViewSmart: isSmartWallet,
                showAddressViewWalletAddress: walletAddress,
            });
        };
        const showAddCustomCoinCb = (walletAddress: string) => {
            setAddCustomCoinData({
                isShowAddCustomCoinModal: true,
                addingWalletAddress: walletAddress,
            });
        };
        eventManager.on(EventType.SHOW_SEED_PHRASE_MODAL, showSeedPhraseCb);
        eventManager.on(EventType.SHOW_PRIVATE_KEY_MODAL, showPrivateKeyCb);
        eventManager.on(EventType.SHOW_WALLET_ADDRESS_MODAL, showWalletAddressCb);
        eventManager.on(EventType.SHOW_ADD_CUSTOM_COIN_MODAL, showAddCustomCoinCb);

        return () => {
            eventManager.off(EventType.SHOW_SEED_PHRASE_MODAL, showSeedPhraseCb);
            eventManager.off(EventType.SHOW_PRIVATE_KEY_MODAL, showPrivateKeyCb);
            eventManager.off(EventType.SHOW_WALLET_ADDRESS_MODAL, showWalletAddressCb);
            eventManager.off(EventType.SHOW_ADD_CUSTOM_COIN_MODAL, showAddCustomCoinCb);
        };
    }, []);

    useEffect(() => {
        // Display red dot in Explore Tab once a day
        const now = new Date();
        const checkValue = now.getDate() + '-' + now.getMonth();

        if (!exploreRedDotDate || exploreRedDotDate !== checkValue) {
            dispatch(setExploreRedDot(true, checkValue));
        }
    }, [dispatch, exploreRedDotDate]);

    const openSidePanel = useCallback(() => {
        //@ts-ignore
        global.platform.openSidePanel();
    }, []);

    return (
        <HomeProvider>
            <div className="flex flex-col items-center h-full relative">
                <div className="flex flex-row items-center w-full h-12 gap-2 bg-white/85 dark:bg-darker/85 backdrop-blur-md border-b border-slate-200 dark:border-darkline justify-between px-3 shrink-0 z-30">
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label={`Account: ${accountName}`}
                        className="flex flex-row items-center min-w-0 cursor-pointer rounded-full py-1 pl-1 pr-2 -ml-1 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        onClick={() => {
                            setIsShowAccountMenu(true);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                setIsShowAccountMenu(true);
                            }
                        }}>
                        <EmojiView
                            emojiSize={13}
                            width={26}
                            emoji={currentAccount?.metadata.avatar}
                            walletAddress={currentAccount?.address}
                        />
                        <TextTruncate
                            className="text-sm font-medium max-w-[120px] sm:max-w-[180px] mx-1.5"
                            position="end"
                            text={accountName}
                        />
                        <AiFillCaretDown
                            size={11}
                            className="shrink-0 text-gray-400 dark:text-gray-500"
                        />
                    </div>
                    <div className="flex flex-row items-center gap-1 shrink-0">
                        <div
                            data-testid="network-selector"
                            role="button"
                            tabIndex={0}
                            aria-label={`Selected network: ${selectedNetwork.short_name}`}
                            className={
                                'flex flex-row items-center cursor-pointer px-2 h-[28px] rounded-full text-xs font-medium whitespace-nowrap border transition-colors ' +
                                (selectedNetwork.testnet
                                    ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-600 dark:text-yellow-400'
                                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-darkline text-gray-700 dark:text-gray-200 hover:border-primary/50 dark:hover:border-accent/50')
                            }
                            onClick={() => {
                                setIsShowNetworkMenu(true);
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    setIsShowNetworkMenu(true);
                                }
                            }}>
                            <img
                                src={selectedNetwork.icon}
                                className="w-4 h-4 rounded-full mr-1.5 overflow-hidden"
                                alt=""
                            />
                            <div className="text-nowrap mr-1">{selectedNetwork.short_name}</div>
                            <AiFillCaretDown
                                size={11}
                                className="text-gray-400 dark:text-gray-500"
                            />
                        </div>
                        <ContextMenu
                            id="home-context-menu"
                            placeholder={
                                <div className="flex w-8 h-8 justify-center items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    <MdOutlineSettings size={19} />
                                </div>
                            }
                            menus={settingsMenu.map((menu, index) => {
                                if (menu.id === 'expand' && !showExpandMenu) {
                                    return null;
                                }
                                return (
                                    <ContextMenuItem
                                        key={index}
                                        title={menu.title}
                                        icon={menu.icon}
                                        onClick={e => {
                                            e.preventDefault();
                                            onContextMenuClick(menu.id);
                                        }}
                                    />
                                );
                            })}
                        />

                        {showSidePanelButton && (
                            <div
                                data-testid="open-side-panel"
                                className="flex w-8 h-8 justify-center items-center rounded-full cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                onClick={openSidePanel}>
                                <TbLayoutSidebarRight className="text-lg" />
                            </div>
                        )}
                    </div>
                </div>
                <Tabs
                    onSelect={onTabPress}
                    selectedIndex={homeTabIndex}
                    selectedTabClassName="bottom-tab-selected-tab-class-name"
                    selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                    className="tab-class-name">
                    <TabPanel>
                        <ExploreTab />
                    </TabPanel>
                    <TabPanel>
                        <EOAWalletTab
                            setIsShowConnectedSites={setIsShowConnectedSites}
                            onTransactionPress={onTransactionPress}
                            onPendingTransactionPress={onPendingTransactionPress}
                            setCancelSpeedUpTxData={setCancelSpeedUpTxData}
                        />
                    </TabPanel>
                    <TabList className="bottom-tab-tablist">
                        <Tab className="bottom-tab-tablist-tab">
                            <div className="flex flex-col items-center">
                                <div className="flex flex-col relative justify-center items-center">
                                    <BsBarChartLineFill className="text-lg" />
                                    <p className="text-xs mt-1">{HomeTabType.Explore}</p>
                                    {exploreRedDot && (
                                        <div className="w-2 h-2 bg-red-500 rounded-full absolute top-0 right-[6px]" />
                                    )}
                                </div>
                            </div>
                        </Tab>
                        <Tab className="bottom-tab-tablist-tab">
                            <div className="flex flex-col items-center">
                                <BsWalletFill className="text-lg" />
                                <p className="text-xs mt-1 text-center">
                                    {HomeTabType.LegacyWallet}
                                </p>
                            </div>
                        </Tab>
                    </TabList>
                </Tabs>

                <NetworkMenu
                    visible={isShowNetworkMenu}
                    onClosePress={() => setIsShowNetworkMenu(false)}
                />
                <AccountMenu
                    visible={isShowAccountMenu}
                    isSmartWallet={false}
                    selectedAccount={currentAccount}
                    onAccountPress={onAccountPress}
                    onClosePress={() => setIsShowAccountMenu(false)}
                    onAddNewAccountPress={onAddNewAccountPress}
                    onEditWalletPress={editWallet => {
                        setEditWalletData({
                            isShowEditWallet: true,
                            editWallet,
                        });
                    }}
                    onEditAccountPress={(editAccount, isEditSmartAccount) => {
                        setEditAccountData({
                            isEditSmartAccount,
                            isShowEditAccount: true,
                            editAccount,
                        });
                    }}
                />
                <AddressView
                    account={showAddressViewAccount}
                    isSmartWallet={showAddressViewSmart}
                    walletAddress={showAddressViewWalletAddress}
                    visible={isShowAddressView}
                    onClosePress={() => setShowAddressData({ isShowAddressView: false })}
                />
                <AddAccount
                    visible={isShowAddAccount}
                    wallet={addAccountWallet}
                    onClosePress={() => setAddAccountData({ isShowAddAccount: false })}
                />
                <HardwareSelectAddressesModal
                    visible={hardwareAddAccountModal.visible}
                    onClose={() => void handleHardwareAddAccountModalClose()}
                    onComplete={handleHardwareAddAccountComplete}
                    hardware={hardwareAddAccountModal.hardware}
                    existingHardwareWalletId={hardwareAddAccountModal.walletId ?? undefined}
                />
                <EditAccount
                    visible={isShowEditAccount}
                    account={editAccount}
                    isSmartWallet={isEditSmartAccount}
                    onClosePress={() => setEditAccountData({ isShowEditAccount: false })}
                    onBackPress={onEditAccountBackPress}
                />
                <EditWallet
                    visible={isShowEditWallet}
                    wallet={editWallet}
                    onClosePress={() => setEditWalletData({ isShowEditWallet: false })}
                />
                <ConnectedSitesModal
                    isSmartWallet={isSmartWallet}
                    visible={isShowConnectedSites}
                    onClosePress={() => setIsShowConnectedSites({ isShowConnectedSites: false })}
                />
                <SeedPhraseModal
                    wallet={showSeedPhraseWallet}
                    visible={isShowSeedPhrase}
                    onClosePress={() => setShowSeedPhraseData({ isShowSeedPhrase: false })}
                />
                <PrivateKeyModal
                    account={showPrivateKeyAccount}
                    visible={isShowPrivateKey}
                    onClosePress={() => setShowPrivateKeyData({ isShowPrivateKey: false })}
                />
                <SpeedUpAndCancelModal
                    {...cancelSpeedUpTxData}
                    onCloseRequest={() => setCancelSpeedUpTxData({ visible: false })}
                />
                <TransactionDetailModal
                    visible={isShowTransactionDetail}
                    data={transactionDetailData}
                    onClosePress={() => setTransactionDetail({ isShowTransactionDetail: false })}
                />
                <PendingTransactionModal
                    visible={isShowPendingTxDetail}
                    data={pendingTxDetailData}
                    onClosePress={() => setPendingTxDetail({ isShowPendingTxDetail: false })}
                />
                <NotConnectedSiteModal
                    visible={isShowNotConnectedModal}
                    currentAccount={currentAccount}
                    connectedAccounts={connectedAccounts}
                    onClose={() => setIsShowNotConnectedModal(false)}
                    onSwitchAccount={onSwitchAccountPress}
                />
                <AddCustomCoinModal
                    visible={isShowAddCustomCoinModal}
                    walletAddress={addingWalletAddress}
                    onClosePress={() => setAddCustomCoinData({ isShowAddCustomCoinModal: false })}
                />
            </div>
        </HomeProvider>
    );
});
