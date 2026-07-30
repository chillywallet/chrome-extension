import React, { useCallback, useMemo } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { MdDeleteOutline, MdOutlineCancel, MdSpeed } from 'react-icons/md';
import { SlOptionsVertical } from 'react-icons/sl';
import { PendingTransaction } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import { removePendingTransactions } from '../../store/actions/uiActions';
import { useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import ContextMenu, { ContextMenuItem } from './ContextMenu';

type MenuItem = {
    key: string;
    title: string;
    icon?: React.ReactNode;
    type?: 'delete';
};

type MenuProps = {
    className?: string;
    deletable?: boolean;
    onMenuPress: (item: PendingTransaction, type: 'cancel' | 'speedup') => void;
    data: PendingTransaction;
};

export default React.memo<MenuProps>((props: MenuProps) => {
    const { onMenuPress, data, deletable = true } = props;
    const { status, txHash } = data;
    const dispatch = useAppDispatch();
    const selectedNetwork = useSelectedNetwork();

    const explorerTitle = useMemo(() => {
        if (selectedNetwork) {
            return `View on ${selectedNetwork.explorer_name}`;
        }
        return '';
    }, [selectedNetwork]);

    const menus = useMemo(() => {
        const _menu: MenuItem[] =
            !status || status === 'sending'
                ? [
                      {
                          key: 'speed_up',
                          title: 'Speed Up',
                          icon: <MdSpeed size={18} />,
                      },
                      {
                          key: 'cancel',
                          title: 'Cancel',
                          icon: <MdOutlineCancel size={18} />,
                      },
                  ]
                : [];

        if (deletable) {
            _menu.push({
                key: 'delete',
                title: 'Delete',
                type: 'delete',
                icon: <MdDeleteOutline size={18} />,
            });
        }
        if (selectedNetwork?.explorer_url) {
            _menu.unshift({
                key: 'view',
                title: explorerTitle,
                icon: <FaExternalLinkAlt size={14} />,
            });
        }

        return _menu;
    }, [selectedNetwork?.explorer_url, explorerTitle, status, deletable]);

    const onMenuSelect = useCallback(
        (menuItem: MenuItem) => {
            switch (menuItem.key) {
                case 'view':
                    if (selectedNetwork) {
                        const _url = selectedNetwork.explorer_url;

                        global.platform.openLink(`${_url}/tx/${txHash}`, '_blank');
                    }

                    break;

                case 'speed_up':
                    onMenuPress(data, 'speedup');
                    break;

                case 'cancel':
                    onMenuPress(data, 'cancel');
                    break;

                case 'delete':
                    eventManager.showAlertModal({
                        title: 'Delete Transaction',
                        message: 'Are you sure you want to delete this transaction?',
                        buttons: [
                            {
                                name: 'Delete',
                                onPress: () =>
                                    dispatch(
                                        removePendingTransactions(
                                            data.sender,
                                            selectedNetwork.platform_id,
                                            [data.id],
                                        ),
                                    ),
                            },
                            { name: 'Cancel', type: 'cancel' },
                        ],
                    });
                    break;
            }
        },
        [selectedNetwork, onMenuPress, data, txHash, dispatch],
    );

    return (
        <ContextMenu
            placeholder={
                <div className="p-2 hover:bg-gray-300 dark:hover:bg-gray-700 rounded">
                    <SlOptionsVertical
                        size={16}
                        className="text-black dark:text-white wallet-context-menu"
                    />
                </div>
            }
            menus={menus.map((menu, index) => {
                return (
                    <ContextMenuItem
                        key={index}
                        title={menu.title}
                        type={menu.type}
                        icon={menu.icon}
                        onClick={e => {
                            e.preventDefault();
                            onMenuSelect(menu);
                        }}
                    />
                );
            })}
        />
    );
});
