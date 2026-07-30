import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ENVIRONMENT_TYPE_FULLSCREEN } from '../../shared/constants/app';
import { ADD_NEW_WALLET_ROUTE } from '../../shared/constants/routes';
import EventType from '../../shared/types/EventType';
import { ChillyAccount, ChillyWallet } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import { getEnvironmentType } from '../../shared/utils/utils';
import { removeAccount, removeWallet } from '../../store/actions/uiActions';
import { useCurrentWallet, useWallets } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import Header from './Header';
import Modal from './Modal';
import Toast from './Toast';
import WalletCard from './WalletCard';

type Props = {
    visible: boolean;
    isSmartWallet: boolean;
    selectedAccount: ChillyAccount | null;
    onClosePress: () => void;
    onAccountPress: (account: ChillyAccount, wallet: ChillyWallet) => void;
    onAddNewAccountPress?: (wallet: ChillyWallet) => void;
    onEditAccountPress?: (account: ChillyAccount, isSmartWallet: boolean) => void;
    onEditWalletPress?: (wallet: ChillyWallet) => void;
    editable?: boolean;
};

export default React.memo<Props>((props: Props) => {
    const {
        visible,
        isSmartWallet,
        selectedAccount,
        onClosePress,
        onAccountPress,
        onAddNewAccountPress,
        onEditAccountPress,
        onEditWalletPress,
        editable = true,
    } = props;
    const currentWallet = useCurrentWallet();
    const history = useHistory();
    const wallets = useWallets();
    const dispatch = useAppDispatch();

    const [expandedWallet, setExpandedWallet] = useState<ChillyWallet | null>(currentWallet);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    //sort account by import time
    const sortedWallets = useMemo(() => {
        return wallets.sort((a, b) => {
            return a.importTime - b.importTime;
        });
    }, [wallets]);

    const onWalletPress = useCallback(
        (wallet: ChillyWallet) => {
            if (wallet.id === expandedWallet?.id) {
                setExpandedWallet(null);
            } else {
                setExpandedWallet(wallet);
            }
        },
        [expandedWallet],
    );

    useEffect(() => {
        // Auto-scroll on last <WalletCard>
        if (expandedWallet && scrollContainerRef.current) {
            const walletIndex = sortedWallets.findIndex(w => w.id === expandedWallet.id);
            const isLastWallet = walletIndex === sortedWallets.length - 1;

            if (isLastWallet) {
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTo({
                            top: scrollContainerRef.current.scrollHeight,
                            behavior: 'smooth',
                        });
                    }
                }, 150);
            }
        }
    }, [expandedWallet, sortedWallets]);

    const deleteAccount = useCallback(
        async (account: ChillyAccount) => {
            eventManager.showAlertModal({
                title: 'Delete Account',
                message: `Are you sure you want to delete the account: ${account.metadata.name}?`,
                buttons: [
                    {
                        name: 'Delete Account',
                        onPress: async () => {
                            try {
                                await dispatch(removeAccount(account.address));
                                eventManager.emit(EventType.ACCOUNTS_CHANGE);
                                Toast.showSuccess('Delete account succeeded.');
                            } catch (error: any) {
                                const message = error?.message;

                                if (message) {
                                    Toast.showError(message);
                                }
                            }
                        },
                    },
                    { name: 'Cancel', type: 'cancel' },
                ],
            });
        },
        [dispatch],
    );

    const deleteWallet = useCallback(
        async (wallet: ChillyWallet) => {
            eventManager.showAlertModal({
                title: 'Delete Wallet',
                message: `Are you sure you want to delete the wallet: ${wallet.name}?`,
                buttons: [
                    {
                        name: 'Delete Wallet',
                        onPress: async () => {
                            try {
                                await dispatch(removeWallet(wallet.id));
                                Toast.showSuccess('Delete wallet succeeded.');
                            } catch (error: any) {
                                const message = error?.message;

                                if (message) {
                                    Toast.showError(message);
                                }
                            }
                        },
                    },
                    { name: 'Cancel', type: 'cancel' },
                ],
            });
        },
        [dispatch],
    );

    const onWalletContextMenuClick = useCallback(
        (wallet: ChillyWallet, action: string) => {
            switch (action) {
                case 'rename':
                    onEditWalletPress && onEditWalletPress(wallet);
                    break;

                case 'reveal_seed_phrase':
                    eventManager.showSeedPhraseModal(wallet);
                    break;

                case 'delete':
                    deleteWallet(wallet);
                    break;
            }
        },
        [onEditWalletPress, deleteWallet],
    );

    const onAccountContextMenuClick = useCallback(
        (account: ChillyAccount, action: string) => {
            switch (action) {
                case 'edit':
                    onEditAccountPress && onEditAccountPress(account, isSmartWallet);
                    break;

                case 'get_private_key':
                    eventManager.showPrivateKeyModal(account);
                    break;

                case 'view_address':
                    eventManager.showWalletAddressModal({
                        account,
                        isSmartWallet,
                    });
                    break;

                case 'delete':
                    deleteAccount(account);
                    break;
            }
        },
        [isSmartWallet, onEditAccountPress, deleteAccount],
    );

    const onAddNewWalletPress = useCallback(() => {
        if (getEnvironmentType() === ENVIRONMENT_TYPE_FULLSCREEN) {
            history.push(ADD_NEW_WALLET_ROUTE);
        } else {
            global.platform.openExtensionInBrowser(ADD_NEW_WALLET_ROUTE);
        }
    }, []);
    return (
        <>
            <Modal
                visible={visible}
                onClose={() => {
                    onClosePress();
                }}>
                <Header
                    title={isSmartWallet ? 'Smart Wallets' : 'Wallets'}
                    hasBackButton={false}
                    onClosePress={onClosePress}
                />
                <div className="pt-2 flex-1 h-[55vh] overflow-auto" ref={scrollContainerRef}>
                    {sortedWallets.map(wallet => {
                        return (
                            <WalletCard
                                key={wallet.id}
                                data={wallet}
                                onPress={onWalletPress}
                                onAccountPress={onAccountPress}
                                onContextMenuClick={onWalletContextMenuClick}
                                onAccountContextMenuClick={onAccountContextMenuClick}
                                editable={editable}
                                isSmartWallet={isSmartWallet}
                                selectedAccount={selectedAccount}
                                deletable={sortedWallets.length > 1}
                                onAddNewAccountPress={onAddNewAccountPress}
                                expanded={expandedWallet?.id === wallet.id}
                            />
                        );
                    })}
                </div>
                <div className="p-3">
                    {editable && (
                        <button
                            className="btn btn-primary w-full mb-3"
                            onClick={onAddNewWalletPress}>
                            Add New Wallet
                        </button>
                    )}
                </div>
            </Modal>
        </>
    );
});
