import { getAddress } from 'ethers';
import React, { useCallback, useMemo } from 'react';
import { IoEllipsisHorizontalCircle, IoQrCodeOutline } from 'react-icons/io5';
import { MdDeleteOutline } from 'react-icons/md';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import EmojiView from './EmojiView';
import TextTruncate from './TextTruncate';

type ContactCardProps = {
    walletAddress: string;
    name: string;
    avatar: string | null | undefined;
    onPress: () => void;
    isContact?: boolean;
    contactId?: string;
    isSmartWallet?: boolean;
    onMenuItemClick: (action: string, walletAddress: string, contactId?: string) => void;
};

const ContactCard = React.memo<ContactCardProps>(
    ({
        walletAddress,
        name,
        avatar,
        onPress,
        isContact = false,
        contactId,
        isSmartWallet = false,
        onMenuItemClick,
    }) => {
        const checksumAddress = useMemo(() => {
            try {
                return getAddress(walletAddress ?? '');
            } catch (error) {
                return '';
            }
        }, [walletAddress]);

        const handleMenuClick = useCallback(
            (action: string) => {
                onMenuItemClick(action, walletAddress, contactId);
            },
            [onMenuItemClick, walletAddress, contactId],
        );

        const menu = useMemo(() => {
            const _menu = [
                {
                    id: 'view_address',
                    title: 'View Address',
                    icon: <IoQrCodeOutline />,
                },
            ];

            if (isContact && contactId) {
                _menu.push({
                    id: 'delete',
                    title: 'Delete Contact',
                    icon: <MdDeleteOutline size={18} />,
                });
            }

            return _menu;
        }, [isContact, contactId]);

        return (
            <div className="flex flex-row items-center w-full hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                <button
                    onClick={e => {
                        e.preventDefault();
                        onPress();
                    }}
                    className="flex flex-1 flex-row items-center text-sm hover:text-primary px-5 py-3">
                    <div className="shrink-0">
                        <EmojiView
                            emoji={avatar}
                            walletAddress={walletAddress}
                            width={32}
                            emojiSize={12}
                        />
                    </div>
                    <div className={'ml-3 text-left'}>
                        <div className="flex items-center gap-2">
                            <TextTruncate
                                className="whitespace-nowrap max-w-[200px]"
                                text={name}
                                position="end"
                            />
                            {isSmartWallet && (
                                <span className="inline-flex items-center gap-1 px-2 py-[1px] rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                                    Smart Wallet
                                </span>
                            )}
                        </div>
                        <TextTruncate
                            className="text-gray-400 whitespace-nowrap w-[200px]"
                            text={checksumAddress}
                            position="middle"
                        />
                    </div>
                </button>
                {menu.length > 0 && (
                    <ContextMenu
                        placeholder={
                            <IoEllipsisHorizontalCircle size={22} className="text-gray-500 mr-5" />
                        }
                        menus={menu.map((menuItem, index) => (
                            <ContextMenuItem
                                key={index}
                                title={menuItem.title}
                                icon={menuItem.icon}
                                type={menuItem.id === 'delete' ? 'delete' : undefined}
                                onClick={() => {
                                    handleMenuClick(menuItem.id);
                                }}
                            />
                        ))}
                    />
                )}
            </div>
        );
    },
);

ContactCard.displayName = 'ContactCard';

export default ContactCard;
