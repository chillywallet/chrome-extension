import React, { useCallback, useEffect, useState } from 'react';
import EventType from '../../shared/types/EventType';
import { ChillyWallet } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import { addNewAccount, getNextAvailableAccountName } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import Header from './Header';
import Modal from './Modal';
import TextInput from './TextInput';
import Toast from './Toast';

type Props = {
    wallet?: ChillyWallet;
    visible: boolean;
    onClosePress: () => void;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClosePress, wallet: currentWallet } = props;
    const dispatch = useAppDispatch();

    const [emoji, setEmoji] = useState<string>('');
    const [accountName, setAccountName] = useState<string>('');

    const onCreatePress = useCallback(async () => {
        if (!currentWallet) {
            return;
        }

        try {
            await dispatch(addNewAccount(currentWallet.id, accountName, emoji));
            eventManager.emit(EventType.ACCOUNTS_CHANGE);
            onClosePress();
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }
    }, [currentWallet, dispatch, emoji, onClosePress, accountName]);

    useEffect(() => {
        if (visible) {
            setEmoji('');
            getNextAvailableAccountName().then(defaultName => {
                if (defaultName) {
                    setAccountName(defaultName);
                }
            });
        }
    }, [visible]);

    return (
        <Modal
            visible={visible}
            onClose={() => {
                onClosePress();
            }}>
            <Header title="Add New Account" hasBackButton={false} onClosePress={onClosePress} />
            <div className="flex flex-col p-3">
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
                        onCreatePress();
                    }}
                    className={
                        'btn btn-primary w-full mb-3 ' + (accountName ? '' : 'btn-disabled')
                    }>
                    Create
                </button>
            </div>
        </Modal>
    );
});
