/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Wallet } from '@clustersxyz/sdk/types';
import { nanoid } from 'nanoid';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Contact } from '../../../api/graphQL/Types';
import { DEFAULT_ROUTE } from '../../../shared/constants/routes';
import EventType from '../../../shared/types/EventType';
import { AlertModalData } from '../../../shared/types/Global';
import { Receiver } from '../../../shared/types/Wallet';
import { getRandomAvatar } from '../../../shared/utils/avatar';
import eventManager from '../../../shared/utils/eventManager';
import logger from '../../../shared/utils/logger';
import { isEqualCaseInsensitive } from '../../../shared/utils/string';
import {
    hideLoadingIndicator,
    setContacts,
    showLoadingIndicator,
} from '../../../store/actions/uiActions';
import { getAllAccounts } from '../../../store/selectorUtils';
import {
    useContacts,
    usePreferences,
    useRecentContacts,
    useSelectedNetwork,
} from '../../../store/selectors';
import { useAppDispatch } from '../../../store/store';
import AddressView from '../../components/AddressView';
import ContactCard from '../../components/ContactCard';
import DomainInputText from '../../components/DomainInputText';
import Header from '../../components/Header';
import TextInput from '../../components/TextInput';
import Toast from '../../components/Toast';
import WalletTag from '../../components/WalletTag';

type Props = {
    isAAWallet: boolean;
    goToNextStep: (data: Receiver) => void;
};

export default React.memo<Props>((props: Props) => {
    const { goToNextStep, isAAWallet } = props;

    const history = useHistory();
    const dispatch = useAppDispatch();
    const contacts = useContacts();
    const accounts = useMemo(() => getAllAccounts(), []);
    const recentContacts = useRecentContacts();
    const selectedNetwork = useSelectedNetwork();

    const [address, setAddress] = useState('');
    const [handledAddress, setHandledAddress] = useState('');
    const [saveToContact, setSaveToContact] = useState(false);
    const [contactName, setContactName] = useState<string>('');
    const [{ isShowAddressView, showAddressViewWalletAddress }, setShowAddressData] = useState<{
        isShowAddressView: boolean;
        showAddressViewWalletAddress?: string;
    }>({ isShowAddressView: false });

    const savedContactName = useMemo(() => {
        if (handledAddress) {
            const contact = contacts.find(_contact =>
                isEqualCaseInsensitive(_contact.walletAddress, handledAddress),
            );
            return contact?.name;
        }
        return null;
    }, [contacts, handledAddress]);

    const accountsData = useMemo(() => {
        let _accounts: {
            id: string;
            address: string;
            name: string;
            avatar?: string | null;
            isSmartWallet?: boolean;
        }[] = [];
        accounts
            .sort((a, b) => {
                return a.metadata.importTime - b.metadata.importTime;
            })
            .forEach(account => {
                _accounts.push({
                    id: account.id + '-legacy-wallet',
                    address: account.address,
                    name: account.metadata.name,
                    avatar: account.metadata.avatar,
                });

            });

        _accounts = _accounts.filter(
            c =>
                c.name.toLowerCase().includes(address.toLowerCase()) ||
                c.address.toLowerCase().includes(address.toLowerCase()),
        );

        return _accounts;
    }, [accounts, selectedNetwork, address]);

    const contactsData = useMemo(() => {
        return contacts.filter(
            c =>
                address === '' ||
                c.name.toLowerCase().includes(address.toLowerCase()) ||
                c.walletAddress.toLowerCase().includes(address.toLowerCase()),
        );
    }, [contacts, address]);

    const findAvatarAndName = useCallback(
        (address: string) => {
            const contact = contactsData.find(
                c => c.walletAddress.toLowerCase() === address.toLowerCase(),
            );

            if (contact) {
                return { name: contact.name, avatar: contact.avatar };
            }

            const account = accountsData.find(
                a => a.address.toLowerCase() === address.toLowerCase(),
            );

            if (account) {
                return { name: account.name, avatar: account.avatar };
            }

            const recent = recentContacts.find(
                c => c.walletAddress.toLowerCase() === address.toLowerCase(),
            );

            if (recent) {
                return { name: recent.name, avatar: recent.avatar };
            }

            return { name: 'Unknown', avatar: null };
        },
        [accountsData, contactsData, recentContacts],
    );

    const saveContacts = useCallback(
        async (updated: Contact[]) => {
            try {
                const sorted = [...updated].sort((a, b) => a.name?.localeCompare(b.name));
                await dispatch(setContacts(sorted, false));
            } catch (error) {
                logger.log('setContacts error', error);
            }
        },
        [dispatch],
    );

    const onNextPress = useCallback(async () => {
        if (!handledAddress) {
            return;
        }

        const trimedAddress = address?.trim() ?? '';
        let _contact: Contact | null = null;

        if (saveToContact && !savedContactName) {
            const ens = !isEqualCaseInsensitive(handledAddress, trimedAddress)
                ? trimedAddress
                : undefined;
            _contact = {
                id: nanoid(),
                name: contactName ? contactName : ens ? ens : `Contact ${contacts.length + 1}`,
                ens,
                walletAddress: handledAddress,
                avatar: getRandomAvatar(trimedAddress),
            };

            //validate duplicate name
            if (contacts.find(contact => contact.name === _contact?.name)) {
                Toast.showError('The contact name already exists.');
                return;
            }

            saveContacts([...contacts, _contact]);
        }

        const { name, avatar } = _contact ? _contact : findAvatarAndName(handledAddress);

        goToNextStep({
            walletAddress: handledAddress,
            name: name,
            avatar: avatar,
        });
    }, [
        handledAddress,
        address,
        saveToContact,
        savedContactName,
        findAvatarAndName,
        goToNextStep,
        contactName,
        contacts,
        saveContacts,
    ]);

    const onResolvedAddress = useCallback(
        (__address: string, name?: string) => {
            setHandledAddress(__address);

            if (__address && __address !== '0x0000000000000000000000000000000000000000') {
                const contact = contacts.find(_contact =>
                    isEqualCaseInsensitive(_contact.walletAddress, __address),
                );

                if (!contact) {
                    setSaveToContact(true);
                    setContactName(name ?? '');
                }
            }
        },
        [contacts],
    );

    const onResolvedClusterWallet = useCallback(
        (wallet: Wallet, name?: string) => {
            setHandledAddress(wallet.address);

            const contact = contacts.find(_contact =>
                isEqualCaseInsensitive(_contact.walletAddress, wallet.address),
            );

            if (!contact) {
                setSaveToContact(true);
                setContactName(name ?? wallet.name);
            }
        },
        [contacts],
    );

    const handleDeleteContact = useCallback(
        (contactId: string) => {
            const alertModalData: AlertModalData = {
                title: 'Delete Contact',
                message: 'Are you sure you want to delete this contact?',
                buttons: [
                    {
                        name: 'Delete',
                        onPress: async () => {
                            await saveContacts(
                                contacts.filter(contact => contact.id !== contactId),
                            );
                            Toast.showSuccess('Contact deleted successfully');
                        },
                    },
                    {
                        name: 'Cancel',
                        type: 'cancel',
                    },
                ],
            };
            eventManager.showAlertModal(alertModalData);
        },
        [contacts, saveContacts],
    );

    const handleMenuItemClick = useCallback(
        (action: string, walletAddress: string, contactId?: string) => {
            switch (action) {
                case 'view_address':
                    eventManager.showWalletAddressModal({
                        walletAddress,
                    });
                    break;
                case 'delete':
                    if (contactId) {
                        handleDeleteContact(contactId);
                    }
                    break;
                default:
                    break;
            }
        },
        [handleDeleteContact],
    );

    useEffect(() => {
        const showWalletAddressCb = (params: {
            account?: any;
            isSmartWallet?: boolean;
            walletAddress?: string;
        }) => {
            const { walletAddress } = params;
            if (walletAddress) {
                setShowAddressData({
                    isShowAddressView: true,
                    showAddressViewWalletAddress: walletAddress,
                });
            }
        };

        eventManager.on(EventType.SHOW_WALLET_ADDRESS_MODAL, showWalletAddressCb);

        return () => {
            eventManager.off(EventType.SHOW_WALLET_ADDRESS_MODAL, showWalletAddressCb);
        };
    }, []);

    return (
        <div className="flex flex-col h-full">
            <Header title="Send To" action={<WalletTag isAAWallet={isAAWallet} />} />

            <DomainInputText
                showError={contactsData.length === 0}
                className="px-3 pt-3"
                type="text"
                maxLength={200}
                value={address}
                onChange={e => {
                    setAddress(e.target.value);
                }}
                onResolvedAddress={onResolvedAddress}
                onResolvedClusterWallet={onResolvedClusterWallet}
            />

            <div className="flex flex-col mx-3 mt-2">
                <div className="flex flex-wrap">
                    {handledAddress ? (
                        savedContactName ? (
                            <div className="px-2 py-1 text-xs text-white rounded-md bg-[#17B569]">
                                Contact: {savedContactName}
                            </div>
                        ) : (
                            <label className="flex flex-row items-center text-sm">
                                <input
                                    type="checkbox"
                                    className="mr-2 bg-primary w-4 h-4 rounded-sm border border-primary"
                                    checked={saveToContact}
                                    onChange={e => setSaveToContact(e.target.checked)}
                                />
                                Save to contacts
                            </label>
                        )
                    ) : null}
                </div>

                {handledAddress && !savedContactName && saveToContact ? (
                    <TextInput
                        label="Contact name"
                        className="mt-3"
                        type="text"
                        placeholder="Enter name"
                        value={contactName}
                        onChange={e => setContactName(e.target.value)}
                    />
                ) : null}
            </div>

            <div className="overflow-y-auto overflow-x-hidden flex-1 mt-2">
                {recentContacts.length > 0 && (
                    <>
                        <h1 className="text-md px-3 mb-2">Recents</h1>

                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {recentContacts.map(contact => {
                                return (
                                    <ContactCard
                                        key={`recent-${contact.id}`}
                                        walletAddress={contact.walletAddress}
                                        name={contact.name}
                                        avatar={contact.avatar}
                                        onPress={() => {
                                            goToNextStep({
                                                walletAddress: contact.walletAddress,
                                                name: contact.name,
                                                avatar: contact.avatar,
                                            });
                                        }}
                                        onMenuItemClick={handleMenuItemClick}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}

                <h1 className="text-md px-3 mb-2">My accounts</h1>

                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {accountsData.length > 0 ? (
                        accountsData.map(account => {
                            return (
                                <ContactCard
                                    key={`accounts-${account.id}`}
                                    walletAddress={account.address}
                                    name={account.name}
                                    avatar={account.avatar}
                                    isSmartWallet={account.isSmartWallet}
                                    onPress={() => {
                                        goToNextStep({
                                            walletAddress: account.address,
                                            name: account.name,
                                            avatar: account.avatar,
                                        });
                                    }}
                                    onMenuItemClick={handleMenuItemClick}
                                />
                            );
                        })
                    ) : (
                        <p className="text-sm text-gray-400 text-center pt-3">
                            No accounts available
                        </p>
                    )}
                </div>

                <h1 className="text-md mt-3 mb-2 px-3">Contacts</h1>

                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {contactsData.length > 0 ? (
                        contactsData.map(contact => {
                            return (
                                <ContactCard
                                    key={`contacts-${contact.id}`}
                                    walletAddress={contact.walletAddress}
                                    name={contact.name}
                                    avatar={contact.avatar}
                                    isContact={true}
                                    contactId={contact.id}
                                    onPress={() => {
                                        goToNextStep({
                                            walletAddress: contact.walletAddress,
                                            name: contact.name,
                                            avatar: contact.avatar,
                                        });
                                    }}
                                    onMenuItemClick={handleMenuItemClick}
                                />
                            );
                        })
                    ) : (
                        <p className="text-sm text-gray-400 text-center pt-3">
                            No contacts available
                        </p>
                    )}
                </div>
            </div>

            <div className="p-3 grid grid-cols-2 gap-3">
                <button
                    className="btn btn-secondary w-full"
                    onClick={e => {
                        e.preventDefault();

                        history.replace(DEFAULT_ROUTE);
                    }}>
                    Cancel
                </button>

                <button
                    disabled={!handledAddress}
                    className={'btn btn-primary w-full ' + (!handledAddress ? 'btn-disabled' : '')}
                    onClick={async e => {
                        e.preventDefault();

                        onNextPress();
                    }}>
                    Next
                </button>
            </div>

            <AddressView
                walletAddress={showAddressViewWalletAddress}
                visible={isShowAddressView}
                onClosePress={() => setShowAddressData({ isShowAddressView: false })}
            />
        </div>
    );
});
