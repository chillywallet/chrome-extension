import { getAddress } from 'ethers';
import React, { useMemo } from 'react';
import { IoEllipsisHorizontalCircle, IoQrCodeOutline } from 'react-icons/io5';
import { MdDeleteOutline, MdDriveFileRenameOutline, MdVpnKey } from 'react-icons/md';
import { KeyringTypes } from '../../controller/KeyringController';
import { ChillyAccount } from '../../shared/types/Wallet';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import EmojiView from './EmojiView';
import TextTruncate from './TextTruncate';

type Props = {
    data: ChillyAccount;
    onPress: (data: ChillyAccount) => void;
    onContextMenuClick: (wallet: ChillyAccount, action: string) => void;
    editable: boolean;
    deletable: boolean;
    isSmartWallet: boolean;
    selected: boolean;
};

export default React.memo<Props>((props: Props) => {
    const { data, editable, onPress, deletable, onContextMenuClick, isSmartWallet, selected } =
        props;

    const address = useMemo(() => {
        return isSmartWallet ? data.smartAddress : data.address;
    }, [data, isSmartWallet]);

    const avatar = useMemo(() => {
        return isSmartWallet ? data.metadata.smartAvatar : data.metadata.avatar;
    }, [data, isSmartWallet]);

    const canViewPrivateKey = useMemo(() => {
        const t = data.metadata.keyring.type;
        return t === KeyringTypes.hd || t === KeyringTypes.simple;
    }, [data.metadata.keyring.type]);

    const menu = useMemo(() => {
        const _menu = [
            {
                id: 'edit',
                title: 'Edit Account',
                icon: <MdDriveFileRenameOutline />,
            },
            {
                id: 'view_address',
                title: 'View Address',
                icon: <IoQrCodeOutline />,
            },
        ];

        if (canViewPrivateKey) {
            _menu.push({
                id: 'get_private_key',
                title: 'View Private Key',
                icon: <MdVpnKey />,
            });
        }

        if (deletable) {
            _menu.push({
                id: 'delete',
                title: 'Delete Account',
                icon: <MdDeleteOutline size={18} />,
            });
        }

        return _menu;
    }, [canViewPrivateKey, deletable]);

    const checksumAddress = useMemo(() => {
        try {
            return getAddress(address ?? '');
        } catch (error) {
            return '';
        }
    }, [address]);

    return (
        <div
            className={
                'flex flex-row items-center hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors pr-3 ' +
                (selected ? 'bg-primary/10' : '')
            }>
            <button
                onClick={e => {
                    e.preventDefault();
                    onPress(data);
                }}
                className="flex flex-1 flex-row items-center text-sm">
                <div className={'w-[2px] h-[60px] mr-3 ' + (selected ? 'bg-primary' : '')} />
                <div className="py-2 shrink-0 relative">
                    <EmojiView emoji={avatar} walletAddress={address} width={36} emojiSize={15} />
                </div>
                <div className={'ml-3 text-left'}>
                    <div className="flex items-center gap-2">
                        <TextTruncate
                            text={data.metadata.name}
                            className={'whitespace-nowrap max-w-[200px] text-primary font-medium'}
                            position="end"
                        />
                    </div>
                    <TextTruncate
                        text={checksumAddress}
                        className={'text-gray-400 whitespace-nowrap w-[200px]'}
                        position="middle"
                    />
                </div>
            </button>
            {editable && (
                <ContextMenu
                    placeholder={
                        <IoEllipsisHorizontalCircle
                            size={22}
                            className="text-gray-500 account-context-menu"
                        />
                    }
                    menus={menu.map((menu, index) => (
                        <ContextMenuItem
                            key={index}
                            title={menu.title}
                            icon={menu.icon}
                            type={menu.id === 'delete' ? 'delete' : undefined}
                            onClick={() => {
                                onContextMenuClick(data, menu.id);
                            }}
                        />
                    ))}
                />
            )}
        </div>
    );
});
