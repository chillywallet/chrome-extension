import { getAddress } from 'ethers';
import React, { useCallback, useMemo } from 'react';

import { ChillyAccount, ChillyWallet } from '../../shared/types/Wallet';
import { addPermittedAccount } from '../../store/actions/uiActions';
import { useActiveTab, useSubjectMetadataByOrigin } from '../../store/selectors';
import { findWalletForAddress } from '../../store/selectorUtils';
import { useAppDispatch } from '../../store/store';
import EmojiView from './EmojiView';
import Modal from './Modal';
import SafeImage from './SafeImage';
import TextTruncate from './TextTruncate';

type Props = {
    visible: boolean;
    currentAccount: ChillyAccount | null;
    connectedAccounts: ChillyAccount[];
    onClose: () => void;
    onSwitchAccount: (account: ChillyAccount, wallet: ChillyWallet) => void;
};

const NotConnectedSiteModal: React.FC<Props> = ({
    visible,
    currentAccount,
    connectedAccounts,
    onClose,
    onSwitchAccount,
}) => {
    const dispatch = useAppDispatch();
    const activeTab = useActiveTab();
    const subjectMeta = useSubjectMetadataByOrigin(activeTab?.origin || '');

    const onConnectCurrent = useCallback(
        (account: ChillyAccount) => {
            onClose();

            if (activeTab?.origin) {
                dispatch(addPermittedAccount(activeTab.origin, account.address));
            }
        },
        [activeTab, dispatch, onClose],
    );

    const site = useMemo(() => {
        const origin = activeTab?.origin ?? '';
        let host = origin;

        try {
            const url = new URL(origin);
            host = url.hostname;
        } catch {
            // ignore parse errors and fall back to origin string
        }

        return {
            extensionId: subjectMeta?.extensionId ?? null,
            origin,
            host,
            name: subjectMeta?.name ?? null,
            iconUrl: subjectMeta?.iconUrl ?? null,
        };
    }, [activeTab, subjectMeta]);

    const renderAccountItem = useCallback(
        (
            account: ChillyAccount | null,
            actionLabel: string,
            onClick: (account: ChillyAccount, wallet: ChillyWallet) => void,
            isConnected: boolean = false,
        ) => {
            if (!account) {
                return null;
            }

            const address = account.address ?? '';
            let checksumAddress = '';

            try {
                checksumAddress = address ? getAddress(address) : '';
            } catch {
                checksumAddress = address;
            }

            const onClickCb = () => {
                const wallet = findWalletForAddress(address);

                if (wallet) {
                    onClick(account, wallet);
                }
            };

            return (
                <div className="flex flex-row items-center justify-between py-2 px-4">
                    <div className="flex flex-1 flex-row items-center text-sm text-left">
                        <div className="py-1 shrink-0 relative">
                            <EmojiView
                                emoji={account.metadata.avatar}
                                walletAddress={address}
                                width={36}
                                emojiSize={15}
                            />
                        </div>
                        <div className="ml-3 text-left flex-1">
                            <div className="flex items-center gap-2">
                                <TextTruncate
                                    text={account.metadata.name}
                                    className="whitespace-nowrap max-w-[140px] text-primary font-medium"
                                    position="end"
                                />
                                {isConnected && (
                                    <span className="text-[10px] px-2 py-[1px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full font-medium">
                                        Connected
                                    </span>
                                )}
                            </div>
                            <TextTruncate
                                text={checksumAddress}
                                className="text-gray-400 whitespace-nowrap max-w-[160px]"
                                position="middle"
                            />
                        </div>
                    </div>
                    <button
                        onClick={e => {
                            e.preventDefault();
                            onClickCb();
                        }}
                        className="w-[100px] h-[35px] border border-primary bg-transparent text-xs text-primary rounded-full hover:bg-primary hover:text-white">
                        {actionLabel}
                    </button>
                </div>
            );
        },
        [],
    );

    return (
        <Modal visible={visible} onClose={onClose}>
            <div className="flex flex-col max-h-[90vh]">
                <div className="flex-1 overflow-y-auto px-5 pt-5">
                    <div className="text-xs flex flex-col items-center">
                        <SafeImage
                            src={site.iconUrl ?? ''}
                            alt={site.name ?? site.host}
                            className="w-14 h-14 mb-5"
                        />

                        <div className="text-xl text-center mb-3">
                            <span className="text-slate-800 dark:text-slate-100">
                                {site.host || site.origin}
                            </span>{' '}
                            isn't connected to this account.
                        </div>
                    </div>

                    <div className="w-full mt-8 mb-6">
                        <div className="bg-white dark:bg-darker shadow-md rounded-lg overflow-hidden">
                            <div className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800/50 text-xs font-medium mb-2">
                                Current account
                            </div>
                            {renderAccountItem(currentAccount, 'Connect', onConnectCurrent)}
                        </div>
                    </div>

                    <div className="w-full mb-6">
                        <div className="bg-white dark:bg-darker shadow-md rounded-lg overflow-hidden">
                            <div className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800/50 text-xs font-medium mb-2">
                                Connected accounts
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {connectedAccounts.map((account, index) => (
                                    <div key={index}>
                                        {renderAccountItem(
                                            account,
                                            'Switch',
                                            onSwitchAccount,
                                            index === 0,
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 px-5 pb-5 pt-2">
                    <button
                        className="btn w-full"
                        onClick={e => {
                            e.preventDefault();
                            onClose();
                        }}>
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default React.memo(NotConnectedSiteModal);
