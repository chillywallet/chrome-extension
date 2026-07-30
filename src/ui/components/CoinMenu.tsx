import React, { useCallback, useMemo } from 'react';
import { FiCopy, FiEye, FiEyeOff } from 'react-icons/fi';
import { SlOptionsVertical } from 'react-icons/sl';
import { buildHiddenTokensPreference } from '../../lib/customTokens';
import { isNativeCoinByPlatformIdAndTokenAddress } from '../../lib/WalletUtils';
import EventType from '../../shared/types/EventType';
import eventManager from '../../shared/utils/eventManager';
import {
    hideLoadingIndicator,
    setPreferences,
    showLoadingIndicator,
} from '../../store/actions/uiActions';
import { useActualTheme } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import Toast from './Toast';

type Props = {
    className?: string;
    platformId: number;
    tokenAddress: string;
    walletAddress: string;
    isHidden: boolean;
};

type MenuItem = {
    key: string;
    title: string;
    icon?: React.ReactNode;
};

export default React.memo<Props>((props: Props) => {
    const { className, platformId, tokenAddress, walletAddress, isHidden } = props;
    const dispatch = useAppDispatch();
    const actualTheme = useActualTheme();

    const isNativeCoin = useMemo(() => {
        return isNativeCoinByPlatformIdAndTokenAddress(platformId, tokenAddress);
    }, [platformId, tokenAddress]);

    const iconColor = useMemo(() => {
        return actualTheme === 'dark' ? '#FFFFFF' : '#4AA8DC';
    }, [actualTheme]);

    const menu = useMemo(() => {
        const _menu: MenuItem[] = [];

        if (!isNativeCoin) {
            if (isHidden) {
                _menu.push({
                    key: 'show_token',
                    title: 'Show Coin',
                    icon: <FiEye size={14} color={iconColor} />,
                });
            } else {
                _menu.push({
                    key: 'hide_token',
                    title: 'Hide Coin',
                    icon: <FiEyeOff size={14} color={iconColor} />,
                });
            }

            if (tokenAddress) {
                _menu.push({
                    key: 'copy_token_Address',
                    title: 'Copy Token Address',
                    icon: <FiCopy size={14} color={iconColor} />,
                });
            }
        }
        return _menu;
    }, [isNativeCoin, tokenAddress, isHidden, iconColor]);

    const setTokenHidden = useCallback(
        (hidden: boolean) => {
            dispatch(showLoadingIndicator());
            const hiddenTokens = buildHiddenTokensPreference(platformId, tokenAddress, hidden);
            (dispatch(setPreferences({ hiddenTokens })) as unknown as Promise<void>)
                .then(() => {
                    eventManager.emit(EventType.REFRESH_WALLET);
                })
                .finally(() => {
                    dispatch(hideLoadingIndicator());
                });
        },
        [dispatch, platformId, tokenAddress],
    );

    const showToken = useCallback(() => setTokenHidden(false), [setTokenHidden]);
    const hideToken = useCallback(() => setTokenHidden(true), [setTokenHidden]);

    const onMenuItemPress = useCallback(
        (item: MenuItem) => {
            switch (item.key) {
                case 'hide_token':
                    hideToken();
                    break;

                case 'show_token':
                    showToken();
                    break;

                case 'copy_token_Address':
                    navigator.clipboard.writeText(tokenAddress);
                    Toast.showSuccess('Address copied to clipboard');
                    break;
            }
        },
        [hideToken, showToken, tokenAddress],
    );

    return (
        <div className={menu.length === 0 ? 'opacity-0' : ''}>
            <ContextMenu
                className={className}
                placeholder={
                    <div className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded">
                        <SlOptionsVertical
                            size={16}
                            className="text-gray-500 wallet-context-menu"
                        />
                    </div>
                }
                menus={menu.map((_item, index) => {
                    return (
                        <ContextMenuItem
                            key={index}
                            title={_item.title}
                            icon={_item.icon}
                            onClick={e => {
                                e.preventDefault();
                                onMenuItemPress(_item);
                            }}
                        />
                    );
                })}
            />
        </div>
    );
});
