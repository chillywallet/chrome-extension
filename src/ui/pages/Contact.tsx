import { nanoid } from 'nanoid';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Contact } from '../../api/graphQL/Types';
import EventType from '../../shared/types/EventType';
import { getRandomAvatar } from '../../shared/utils/avatar';
import eventManager from '../../shared/utils/eventManager';
import logger from '../../shared/utils/logger';
import { checkValidWalletAddress } from '../../shared/utils/utils';
import { setContacts } from '../../store/actions/uiActions';
import { useContacts } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import AddressView from '../components/AddressView';
import ContactCard from '../components/ContactCard';
import EmojiPicker from '../components/EmojiPicker';
import EmojiView from '../components/EmojiView';
import Header from '../components/Header';
import Modal from '../components/Modal';
import TextInput from '../components/TextInput';
import Toast from '../components/Toast';

type Props = {};

export default React.memo<Props>(() => {
    const dispatch = useAppDispatch();
    const contacts = useContacts();

    const [searchText, setSearchText] = useState<string>('');
    const [isShowModal, setShowModal] = useState<boolean>(false);

    const [emoji, setEmoji] = useState<string | null>(null);
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [contactName, setContactName] = useState<string>('');

    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [{ isShowAddressView, showAddressViewWalletAddress }, setShowAddressData] = useState<{
        isShowAddressView: boolean;
        showAddressViewWalletAddress?: string;
    }>({ isShowAddressView: false });

    const filteredContacts = useMemo(() => {
        if (contacts) {
            return contacts.filter(contact => {
                return (
                    contact.name.toLowerCase().includes(searchText.toLowerCase()) ||
                    contact.walletAddress.toLowerCase().includes(searchText.toLowerCase())
                );
            });
        }
        return [];
    }, [contacts, searchText]);

    const saveContacts = useCallback(
        (updated: Contact[]) => {
            const sorted = [...updated].sort((a, b) => a.name?.localeCompare(b.name));
            return dispatch(setContacts(sorted)).catch((e: unknown) => {
                logger.log('setContacts error', e);
            });
        },
        [dispatch],
    );

    const createContact = useCallback(() => {
        const _contact: Contact = {
            id: nanoid(),
            name: contactName,
            walletAddress: walletAddress,
            avatar: emoji ?? '🦊',
        };

        //validate duplicate name
        if (contacts.find(contact => contact.name === _contact.name)) {
            Toast.showError('The contact name already exists.');
            return;
        }

        saveContacts([...contacts, _contact]).then(() => {
            Toast.showSuccess('Contact created successfully');
            setShowModal(false);
        });
    }, [contactName, contacts, emoji, saveContacts, walletAddress]);

    const updateContact = useCallback(() => {
        const updated = contacts.map(contact =>
            contact.id === selectedContact?.id
                ? {
                      ...contact,
                      name: contactName,
                      walletAddress: walletAddress,
                      avatar: emoji ?? '🦊',
                  }
                : contact,
        );

        saveContacts(updated).then(() => {
            Toast.showSuccess('Contact updated successfully');
            setShowModal(false);
        });
    }, [contactName, contacts, emoji, saveContacts, selectedContact?.id, walletAddress]);

    const deleteContact = useCallback(
        (contactId: string) => {
            const cb = () => {
                saveContacts(contacts.filter(contact => contact.id !== contactId)).then(() => {
                    Toast.showSuccess('Contact deleted successfully');
                    setShowModal(false);
                });
            };

            let message = 'Are you sure you want to delete this contact?';

            eventManager.showAlertModal({
                title: 'Delete Contact',
                message,
                buttons: [
                    {
                        name: 'Delete',
                        onPress: cb,
                    },
                    {
                        name: 'Cancel',
                        type: 'cancel',
                    },
                ],
            });
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
                        deleteContact(contactId);
                    }
                    break;
                default:
                    break;
            }
        },
        [deleteContact],
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

    const isValidAddress = useMemo(() => {
        return checkValidWalletAddress(walletAddress);
    }, [walletAddress]);

    useEffect(() => {
        if (!emoji && checkValidWalletAddress(walletAddress)) {
            setEmoji(getRandomAvatar(walletAddress));
        }
    }, [walletAddress, emoji]);

    const isAddressError = useMemo(() => {
        if (!walletAddress) {
            return false;
        }
        return !isValidAddress;
    }, [isValidAddress, walletAddress]);

    return (
        <div className="flex flex-col h-full min-h-[400px] relative">
            <Header title="My Contacts" />

            <input
                value={searchText}
                type={'search'}
                className="text-sm h-11 px-4 text-black-500 placeholder-gray-400 form-input bg-transparent block w-full focus:outline-none border-b border-gray-200 dark:border-darkline shrink-0"
                placeholder="Search..."
                onChange={e => {
                    setSearchText(e.target.value);
                }}
            />

            <div className="flex flex-col flex-1 h-[calc(100vh-40px-10rem)] overflow-y-auto overflow-x-hidden">
                {filteredContacts.length === 0 && (
                    <div className="flex flex-col items-center justify-center flex-1">
                        <EmojiView emoji={'🤔'} width={64} emojiSize={24} />
                        <p className="text-gray-400 mt-3">No contacts found</p>
                    </div>
                )}
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredContacts.map((contact, index) => {
                        return (
                            <ContactCard
                                key={contact.id || index}
                                walletAddress={contact.walletAddress}
                                name={contact.name}
                                avatar={contact.avatar}
                                isContact={true}
                                contactId={contact.id}
                                onPress={() => {
                                    setSelectedContact(contact);
                                    setShowModal(true);

                                    setWalletAddress(contact.walletAddress);
                                    setContactName(contact.name);
                                    setEmoji(contact.avatar ?? '🦊');
                                }}
                                onMenuItemClick={handleMenuItemClick}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="p-3">
                <button
                    onClick={e => {
                        e.preventDefault();
                        setShowModal(true);
                        setSelectedContact(null);
                        setWalletAddress('');
                        setContactName('');
                        setEmoji(null);
                    }}
                    className="btn btn-primary w-full">
                    Add Contact
                </button>
            </div>

            <Modal visible={isShowModal} onClose={() => setShowModal(false)}>
                <Header
                    title={selectedContact ? 'Update Contact' : 'Add Contact'}
                    hasBackButton={false}
                />
                <div className="p-3" id="contact-modal">
                    <div className="flex flex-col items-center mb-5">
                        <EmojiPicker
                            emoji={emoji}
                            width={50}
                            emojiSize={22}
                            onSelect={emoji => {
                                setEmoji(emoji);
                            }}
                        />
                    </div>

                    <TextInput
                        label="WALLET ADDRESS"
                        className={isAddressError ? 'mb-3 border-red-500' : 'mb-3'}
                        type="text"
                        placeholder="Type your wallet address"
                        value={walletAddress}
                        onChange={e => setWalletAddress(e.target.value)}
                    />

                    {isAddressError && (
                        <p className="text-red-500 text-xs mb-3">Wallet address is invalid</p>
                    )}

                    <TextInput
                        label="NAME"
                        className="mb-3"
                        type="text"
                        placeholder="Contact name"
                        value={contactName}
                        onChange={e => setContactName(e.target.value)}
                    />

                    <button
                        onClick={e => {
                            e.preventDefault();

                            if (selectedContact) {
                                updateContact();
                            } else {
                                createContact();
                            }
                        }}
                        disabled={!isValidAddress}
                        className={
                            isValidAddress
                                ? 'btn btn-primary w-full mb-3'
                                : 'btn btn-primary btn-disabled w-full mb-3'
                        }>
                        {selectedContact ? 'Update' : 'Add'}
                    </button>

                    {selectedContact ? (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={e => {
                                    e.preventDefault();

                                    if (selectedContact?.id) {
                                        deleteContact(selectedContact.id);
                                    }
                                }}
                                className="btn btn-danger w-full">
                                Delete
                            </button>
                            <button
                                className="btn btn-secondary w-full"
                                onClick={e => {
                                    e.preventDefault();
                                    setShowModal(false);
                                }}>
                                Close
                            </button>
                        </div>
                    ) : (
                        <button
                            className="btn btn-secondary w-full"
                            onClick={e => {
                                e.preventDefault();
                                setShowModal(false);
                            }}>
                            Close
                        </button>
                    )}
                </div>
            </Modal>

            <AddressView
                walletAddress={showAddressViewWalletAddress}
                visible={isShowAddressView}
                onClosePress={() => setShowAddressData({ isShowAddressView: false })}
            />
        </div>
    );
});
