import React, { useCallback, useMemo } from 'react';
import { MdOutlineLinkOff } from 'react-icons/md';
import { SlOptionsVertical } from 'react-icons/sl';
import { ConnectedSite } from '../../shared/types/Connection';
import eventManager from '../../shared/utils/eventManager';
import { removePermittedAccount } from '../../store/actions/uiActions';
import { useConnectedSubjectsForSelectedAddress, useCurrentAccount } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import Header from './Header';
import Modal from './Modal';
import SafeImage from './SafeImage';
import Toast from './Toast';

type Props = {
    visible: boolean;
    isSmartWallet?: boolean;
    onClosePress: () => void;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClosePress, isSmartWallet = false } = props;
    const dispatch = useAppDispatch();
    const currentAccount = useCurrentAccount();
    const connectedSites = useConnectedSubjectsForSelectedAddress(isSmartWallet);

    const accountName = useMemo(() => {
        return currentAccount?.metadata.name ?? 'Your account';
    }, [currentAccount?.metadata.name]);

    const activeWallet = useMemo(() => {
        return isSmartWallet
            ? (currentAccount?.smartAddress ?? '')
            : (currentAccount?.address ?? '');
    }, [currentAccount, isSmartWallet]);

    const onDisconnectPress = useCallback(
        async (connectedSite: ConnectedSite) => {
            if (!activeWallet) {
                return;
            }

            try {
                await dispatch(removePermittedAccount(connectedSite.origin, activeWallet));
                Toast.showSuccess('Disconnect the site succeeded');
            } catch (error: any) {
                const message = error?.message;

                if (message) {
                    Toast.showError(message);
                }
            }
        },
        [activeWallet, dispatch],
    );

    const performDisconnectAll = useCallback(async () => {
        if (!activeWallet || connectedSites.length === 0) {
            return;
        }

        try {
            // Disconnect all sites sequentially
            for (const site of connectedSites) {
                await dispatch(removePermittedAccount(site.origin, activeWallet));
            }
            Toast.showSuccess('Disconnected all sites');
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }
    }, [activeWallet, connectedSites, dispatch]);

    const onDisconnectAllPress = useCallback(() => {
        if (!activeWallet || connectedSites.length === 0) {
            return;
        }

        const data = connectedSites;
        eventManager.showAlertModal({
            title: 'Disconnect All Sites/Dapps',
            message: `Are you sure you want to disconnect from all ${data.length} site${
                data.length === 1 ? '' : 's'
            }/dapp${data.length === 1 ? '' : 's'}?`,
            buttons: [
                {
                    name: 'Disconnect All',
                    type: 'primary',
                    onPress: performDisconnectAll,
                },
                {
                    name: 'Cancel',
                    type: 'cancel',
                },
            ],
        });
    }, [activeWallet, connectedSites, performDisconnectAll]);

    return (
        <Modal visible={visible} onClose={onClosePress}>
            <Header
                title="Connected Sites"
                hasBackButton={false}
                onClosePress={onClosePress}
                action={
                    connectedSites.length > 0 ? (
                        <ContextMenu
                            placeholder={
                                <div className="p-2 hover:bg-gray-300 dark:hover:bg-gray-700 rounded">
                                    <SlOptionsVertical
                                        size={16}
                                        className="text-black dark:text-white wallet-context-menu"
                                    />
                                </div>
                            }
                            menus={[
                                <ContextMenuItem
                                    key="disconnect-all"
                                    title="Disconnect All"
                                    icon={<MdOutlineLinkOff />}
                                    type="delete"
                                    onClick={onDisconnectAllPress}
                                />,
                            ]}
                        />
                    ) : null
                }
            />

            <div className="max-h-[280px] overflow-auto p-5 text-xs">
                {connectedSites.length === 0 ? (
                    <div className="text-center mb-2">
                        {accountName} is not connected to any sites.
                    </div>
                ) : (
                    <div className="text-center mb-2">
                        {accountName} is connected to these sites.
                        <br />
                        They can view your account address.
                    </div>
                )}

                {connectedSites.map((site, index) => {
                    const url = new URL(site.origin);
                    return (
                        <div
                            key={index}
                            className="flex flex-row items-center bg-slate-100 dark:bg-darker border border-primary p-3 rounded-md mt-3">
                            <SafeImage
                                src={site.iconUrl ?? ''}
                                alt={'Site logo'}
                                className="w-8 h-8 rounded-md mr-2"
                            />

                            <div className="text-sm flex-1 truncate">{url.hostname}</div>

                            <button
                                onClick={e => {
                                    e.preventDefault();
                                    onDisconnectPress(site);
                                }}
                                className="text-primary text-xs ml-2">
                                Disconnect
                            </button>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
});
