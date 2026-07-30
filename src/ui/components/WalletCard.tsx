import { AnimatePresence, motion } from 'framer-motion';
import isEqual from 'lodash/isEqual';
import React, { useMemo } from 'react';
import { FaEye } from 'react-icons/fa';
import { MdAdd, MdDeleteOutline, MdDriveFileRenameOutline } from 'react-icons/md';
import { SlOptionsVertical } from 'react-icons/sl';
import { useSelector } from 'react-redux';
import { KeyringTypes } from '../../controller/KeyringController';
import { ANIM_DURATION } from '../../shared/constants/app';
import { ChillyAccount, ChillyWallet } from '../../shared/types/Wallet';
import { getAccountsByWalletId } from '../../store/selectorUtils';
import { useCurrentWallet } from '../../store/selectors';
import { ReduxState } from '../../store/store';
import AccountCard from './AccountCard';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import TextTruncate from './TextTruncate';

function pickWalletCardAccountSnapshot(acc: ChillyAccount) {
    const m = acc.metadata;
    return {
        id: acc.id,
        address: acc.address,
        importTime: m.importTime,
        status: m.status,
        verifying: Boolean(m.verifying),
        isDefault: m.isDefault,
        name: m.name,
        avatar: m.avatar ?? null,
        smartAvatar: m.smartAvatar ?? null,
        deleted: m.deleted,
        keyringType: m.keyring?.type,
    };
}

/** useSelector equality: compare display-relevant fields; refs alone can miss metadata updates. */
function walletCardAccountsEqual(prev: ChillyAccount[], next: ChillyAccount[]): boolean {
    if (prev === next) {
        return true;
    }
    return isEqual(
        prev.map(pickWalletCardAccountSnapshot),
        next.map(pickWalletCardAccountSnapshot),
    );
}

type Props = {
    data: ChillyWallet;
    selectedAccount: ChillyAccount | null;
    onPress: (data: ChillyWallet) => void;
    onAccountPress: (account: ChillyAccount, wallet: ChillyWallet) => void;
    onContextMenuClick: (wallet: ChillyWallet, action: string) => void;
    onAccountContextMenuClick: (account: ChillyAccount, action: string) => void;
    onAddNewAccountPress?: (wallet: ChillyWallet) => void;
    editable: boolean;
    deletable: boolean;
    isSmartWallet: boolean;
    expanded: boolean;
};

export default React.memo<Props>((props: Props) => {
    const {
        data,
        data: { id, name },
        editable,
        onPress,
        onAccountPress,
        deletable,
        onContextMenuClick,
        onAccountContextMenuClick,
        onAddNewAccountPress,
        isSmartWallet,
        selectedAccount,
        expanded,
    } = props;
    const selectedWallet = useCurrentWallet();
    const accounts = useSelector((state: ReduxState) => {
        return getAccountsByWalletId(data.id);
    }, walletCardAccountsEqual);

    //sort account by import time (copy first — do not mutate redux-derived array)
    const sortedAccounts = useMemo(() => {
        return [...accounts].sort((a, b) => a.metadata.importTime - b.metadata.importTime);
    }, [accounts]);

    const isSimpleKeyring = useMemo(() => {
        return accounts.length === 1 && accounts[0].metadata.keyring.type === KeyringTypes.simple;
    }, [accounts]);

    const isHDKeyring = useMemo(() => {
        return accounts.length >= 1 && accounts[0].metadata.keyring.type === KeyringTypes.hd;
    }, [accounts]);

    const selected = useMemo(() => {
        return id === selectedWallet?.id;
    }, [id, selectedWallet?.id]);

    const showAddNewAccountButton = useMemo(() => {
        return editable && !isSimpleKeyring;
    }, [editable, isSimpleKeyring]);

    const numberOfAccounts = useMemo(() => {
        return accounts.length;
    }, [accounts]);

    const menu = useMemo(() => {
        const _menu = [
            {
                id: 'rename',
                title: 'Rename',
                icon: <MdDriveFileRenameOutline />,
            },
        ];

        if (isHDKeyring) {
            _menu.push({
                id: 'reveal_seed_phrase',
                title: 'Reveal Seed Phrase',
                icon: <FaEye />,
            });
        }

        if (deletable) {
            _menu.push({
                id: 'delete',
                title: 'Delete Wallet',
                icon: <MdDeleteOutline size={18} />,
            });
        }

        return _menu;
    }, [deletable, isHDKeyring]);

    return (
        <div
            className={
                'border border-slate-200 dark:border-darkline/60 rounded-2xl bg-white dark:bg-dark mx-2 my-2 overflow-hidden ' +
                (expanded ? 'divide-y dark:divide-dark' : '')
            }>
            <div className="flex items-center px-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                <div
                    onClick={e => {
                        e.preventDefault();
                        onPress(data);
                    }}
                    className="flex flex-1 flex-row items-center text-sm hover:text-primary pr-5 py-3 cursor-pointer">
                    <div className={'flex-1 text-left'}>
                        <TextTruncate
                            text={name}
                            className={
                                'whitespace-nowrap w-[calc(100vw-200px)] sm:w-[200px] font-semibold'
                            }
                            position="end"
                        />
                        {isSimpleKeyring && (
                            <div className="mt-1 px-2 py-1 border border-slate-200 dark:border-darkline text-xs inline-block rounded-full">
                                Private Key
                            </div>
                        )}
                    </div>
                    <div className={'text-right'}>
                        <p className={'text-xs text-gray-400 whitespace-nowrap text-gray-400'}>
                            {numberOfAccounts === 1 ? '1 Account' : `${numberOfAccounts} Accounts`}
                        </p>
                        {selected && (
                            <div
                                className={
                                    'text-center items-center bg-primary rounded-full px-2 py-[1px] mt-[2px]'
                                }>
                                <p className={'text-xs text-gray-400 text-white'}>Selected</p>
                            </div>
                        )}
                    </div>
                </div>
                {editable && (
                    <ContextMenu
                        placeholder={
                            <div className="p-1 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-full transition-colors">
                                <SlOptionsVertical
                                    size={16}
                                    className="text-gray-500 wallet-context-menu"
                                />
                            </div>
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
            <AnimatePresence>
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: expanded ? 'auto' : 0 }}
                    transition={{ duration: ANIM_DURATION }}>
                    <div className="divide-y dark:divide-dark">
                        {sortedAccounts.map(account => {
                            return (
                                <AccountCard
                                    key={account.id}
                                    data={account}
                                    isSmartWallet={isSmartWallet}
                                    editable={editable}
                                    deletable={sortedAccounts.length > 1}
                                    onPress={() => onAccountPress(account, data)}
                                    onContextMenuClick={onAccountContextMenuClick}
                                    selected={selectedAccount?.address === account.address}
                                />
                            );
                        })}
                        {showAddNewAccountButton && (
                            <div className="flex items-center hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors px-3">
                                <button
                                    onClick={e => {
                                        e.preventDefault();
                                        onAddNewAccountPress && onAddNewAccountPress(data);
                                    }}
                                    className="flex flex-1 flex-row items-center text-sm hover:text-primary py-3">
                                    <div
                                        className={
                                            'flex flex-row text-left font-semibold text-primary items-center'
                                        }>
                                        <MdAdd size={20} />
                                        <p className={'ml-1 text-sm'}>Add New Account</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
});
