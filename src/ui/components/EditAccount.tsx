import React, { useCallback, useEffect, useState } from 'react';
import EventType from '../../shared/types/EventType';
import { ChillyAccount } from '../../shared/types/Wallet';
import { getRandomAvatar } from '../../shared/utils/avatar';
import eventManager from '../../shared/utils/eventManager';
import { updateAccount } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import EmojiPicker from './EmojiPicker';
import Header from './Header';
import Modal from './Modal';
import TextInput from './TextInput';
import Toast from './Toast';

type Props = {
    visible: boolean;
    account?: ChillyAccount;
    isSmartWallet?: boolean;
    onClosePress: () => void;
    onBackPress: () => void;
};

export default React.memo<Props>((props: Props) => {
    const { visible, account, isSmartWallet, onBackPress, onClosePress } = props;
    const dispatch = useAppDispatch();

    const [emoji, setEmoji] = useState<string>('');
    const [accountName, setAccountName] = useState<string>('');

    const onUpdatePress = useCallback(async () => {
        if (!account) {
            return;
        }

        try {
            await dispatch(
                updateAccount(account.address, accountName, emoji, isSmartWallet ?? false),
            );
            eventManager.emit(EventType.ACCOUNTS_CHANGE);
            Toast.showSuccess('Update account succeeded.');
            onClosePress();
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }
    }, [account, dispatch, accountName, emoji, isSmartWallet, onClosePress]);

    useEffect(() => {
        if (visible && account) {
            let _emoji = isSmartWallet ? account.metadata.smartAvatar : account.metadata.avatar;

            if (!_emoji) {
                _emoji = getRandomAvatar(
                    isSmartWallet && account.smartAddress ? account.smartAddress : account.address,
                );
            }

            setEmoji(_emoji);
            setAccountName(account.metadata.name);
        }
    }, [visible, account, isSmartWallet]);

    return (
        <Modal
            visible={visible}
            onClose={() => {
                onClosePress();
            }}>
            <Header title="Edit Account" hasBackButton={false} onClosePress={onClosePress} />
            <div className="flex flex-col p-3">
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
                    label="NAME"
                    className="mb-10"
                    type="text"
                    placeholder="Account name"
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                />

                <button
                    disabled={!accountName}
                    onClick={e => {
                        e.preventDefault();
                        onUpdatePress();
                    }}
                    className={
                        'btn btn-primary w-full mb-3 ' + (accountName ? '' : 'btn-disabled')
                    }>
                    Update
                </button>
            </div>
        </Modal>
    );
});
