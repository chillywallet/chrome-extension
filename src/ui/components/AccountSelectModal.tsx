import { getAddress } from 'ethers';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChillyAccount, ChillyWallet } from '../../shared/types/Wallet';
import { getAllAccounts } from '../../store/selectorUtils';
import { useKeyrings, useWallets } from '../../store/selectors';
import Checkbox from './Checkbox';
import EmojiView from './EmojiView';
import Modal from './Modal';
import TextTruncate from './TextTruncate';

type Props = {
    visible: boolean;
    isSmartWallet: boolean;
    selectedAccounts: ChillyAccount[];
    onClose: () => void;
    onConfirm: (selectedAccounts: ChillyAccount[]) => void;
};

const AccountSelectModal: React.FC<Props> = ({
    visible,
    isSmartWallet,
    selectedAccounts: initialSelectedAccounts,
    onClose,
    onConfirm,
}) => {
    const wallets = useWallets();
    const allAccounts = useMemo(() => getAllAccounts(), []);
    const keyrings = useKeyrings();
    const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
        new Set(initialSelectedAccounts.map(acc => acc.id)),
    );

    // Get all accounts grouped by wallet
    const allAccountsByWallet = useMemo(() => {
        const accountsMap = new Map<string, ChillyAccount[]>();
        wallets.forEach(wallet => {
            // Find the keyring for this wallet
            const findKeyring = keyrings.find(keyring => keyring.id === wallet.id);
            if (findKeyring) {
                // Get accounts that belong to this keyring
                const walletAccounts = findKeyring.accounts
                    .map(accountAddress => {
                        return allAccounts.find(acc => acc.address === accountAddress);
                    })
                    .filter((acc): acc is ChillyAccount => acc !== undefined);
                accountsMap.set(wallet.id, walletAccounts);
            }
        });
        return accountsMap;
    }, [wallets, allAccounts, keyrings]);

    // Sort wallets by import time
    const sortedWallets = useMemo(() => {
        return wallets.sort((a, b) => a.importTime - b.importTime);
    }, [wallets]);

    // Update selected accounts when initialSelectedAccounts changes
    useEffect(() => {
        if (visible) {
            setSelectedAccountIds(new Set(initialSelectedAccounts.map(acc => acc.id)));
        }
    }, [visible, initialSelectedAccounts]);

    const handleWalletCheckboxChange = useCallback(
        (wallet: ChillyWallet, checked: boolean) => {
            const walletAccounts = allAccountsByWallet.get(wallet.id) || [];
            setSelectedAccountIds(prev => {
                const newSet = new Set(prev);
                if (checked) {
                    walletAccounts.forEach(account => newSet.add(account.id));
                } else {
                    walletAccounts.forEach(account => newSet.delete(account.id));
                }
                return newSet;
            });
        },
        [allAccountsByWallet],
    );

    const handleAccountCheckboxChange = useCallback((accountId: string, checked: boolean) => {
        setSelectedAccountIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(accountId);
            } else {
                newSet.delete(accountId);
            }
            return newSet;
        });
    }, []);

    const isWalletAllSelected = useCallback(
        (wallet: ChillyWallet) => {
            const walletAccounts = allAccountsByWallet.get(wallet.id) || [];
            return (
                walletAccounts.length > 0 &&
                walletAccounts.every(account => selectedAccountIds.has(account.id))
            );
        },
        [allAccountsByWallet, selectedAccountIds],
    );

    const renderAccountItem = useCallback(
        (account: ChillyAccount) => {
            const address = isSmartWallet ? account.smartAddress : account.address;
            let checksumAddress = '';

            try {
                checksumAddress = address ? getAddress(address) : '';
            } catch {
                checksumAddress = address ?? '';
            }

            const avatar = isSmartWallet ? account.metadata.smartAvatar : account.metadata.avatar;
            const isChecked = selectedAccountIds.has(account.id);

            return (
                <div
                    className="flex flex-row items-center justify-between py-2 px-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50"
                    onClick={() => handleAccountCheckboxChange(account.id, !isChecked)}>
                    <div className="flex flex-1 flex-row items-center text-sm text-left">
                        <div className="py-1 shrink-0 relative">
                            <EmojiView
                                emoji={avatar}
                                walletAddress={address ?? ''}
                                width={36}
                                emojiSize={15}
                            />
                        </div>
                        <div className="ml-3 text-left flex-1">
                            <TextTruncate
                                text={account.metadata.name}
                                className="whitespace-nowrap max-w-[140px] text-primary font-medium"
                                position="end"
                            />
                            <TextTruncate
                                text={checksumAddress}
                                className="text-gray-400 whitespace-nowrap max-w-[160px]"
                                position="middle"
                            />
                        </div>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                        <Checkbox
                            checked={isChecked}
                            onChange={checked => handleAccountCheckboxChange(account.id, checked)}
                        />
                    </div>
                </div>
            );
        },
        [isSmartWallet, selectedAccountIds, handleAccountCheckboxChange],
    );

    const renderWallet = useCallback(
        (wallet: ChillyWallet) => {
            const walletAccounts = allAccountsByWallet.get(wallet.id) || [];
            const sortedAccounts = walletAccounts.sort(
                (a, b) => a.metadata.importTime - b.metadata.importTime,
            );
            const isAllSelected = isWalletAllSelected(wallet);

            return (
                <div key={wallet.id} className="w-full mb-6">
                    <div className="bg-white dark:bg-darker shadow-md rounded-lg overflow-hidden">
                        <div className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800/50 flex items-center justify-between">
                            <div className="text-xs font-medium">{wallet.name}</div>
                            <Checkbox
                                checked={isAllSelected}
                                onChange={checked => handleWalletCheckboxChange(wallet, checked)}
                            />
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {sortedAccounts.map(account => (
                                <div key={account.id}>{renderAccountItem(account)}</div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        },
        [allAccountsByWallet, isWalletAllSelected, handleWalletCheckboxChange, renderAccountItem],
    );

    const handleConfirm = useCallback(() => {
        const allAccountsList = Array.from(allAccountsByWallet.values()).flat();
        const selectedAccounts = allAccountsList.filter(account =>
            selectedAccountIds.has(account.id),
        );
        onConfirm(selectedAccounts);
        onClose();
    }, [allAccountsByWallet, selectedAccountIds, onConfirm, onClose]);

    return (
        <Modal visible={visible} onClose={onClose}>
            <div className="flex flex-col max-h-[90vh]">
                <div className="px-5 pt-5 pb-3">
                    <div className="text-lg font-semibold">Select Accounts</div>
                </div>
                <div className="flex-1 overflow-y-auto px-5">
                    {sortedWallets.map(wallet => renderWallet(wallet))}
                </div>

                <div className="flex-shrink-0 px-5 pb-5 pt-2">
                    <div className="flex flex-row gap-3">
                        <button
                            className="btn flex-1"
                            onClick={e => {
                                e.preventDefault();
                                onClose();
                            }}>
                            Close
                        </button>
                        <button
                            className="btn btn-primary flex-1"
                            disabled={selectedAccountIds.size === 0}
                            onClick={e => {
                                e.preventDefault();
                                handleConfirm();
                            }}>
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default React.memo(AccountSelectModal);
