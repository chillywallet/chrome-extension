import React, { useCallback, useEffect, useState } from 'react';
import { ChillyWallet } from '../../shared/types/Wallet';
import { updateWallet } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import Header from './Header';
import Modal from './Modal';
import TextInput from './TextInput';
import Toast from './Toast';

type Props = {
    visible: boolean;
    wallet?: ChillyWallet;
    onClosePress: () => void;
};

export default React.memo<Props>((props: Props) => {
    const { visible, wallet, onClosePress } = props;
    const dispatch = useAppDispatch();

    const [walletName, setWalletName] = useState<string>('');

    const onUpdatePress = useCallback(async () => {
        if (!wallet) {
            return;
        }

        try {
            await dispatch(updateWallet(wallet.id, walletName));
            Toast.showSuccess('Update wallet succeeded.');
            onClosePress();
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }
    }, [dispatch, wallet, walletName, onClosePress]);

    useEffect(() => {
        if (visible && wallet) {
            setWalletName(wallet.name);
        }
    }, [visible, wallet]);

    return (
        <Modal
            visible={visible}
            onClose={() => {
                onClosePress();
            }}>
            <Header title="Edit Wallet" hasBackButton={false} onClosePress={onClosePress} />
            <div className="flex flex-col p-3">
                <TextInput
                    label="NAME"
                    className="mb-10"
                    type="text"
                    placeholder="Wallet name"
                    value={walletName}
                    onChange={e => setWalletName(e.target.value)}
                />

                <button
                    disabled={!walletName}
                    onClick={e => {
                        e.preventDefault();
                        onUpdatePress();
                    }}
                    className={'btn btn-primary w-full mb-3 ' + (walletName ? '' : 'btn-disabled')}>
                    Update
                </button>
            </div>
        </Modal>
    );
});
