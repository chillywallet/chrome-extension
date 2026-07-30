import React, { useCallback, useEffect, useState } from 'react';
import { Images } from '../../shared/utils/Images';
import { verifyPassword } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import Header from './Header';
import Modal from './Modal';
import TextInput from './TextInput';

type Props = {
    visible: boolean;
    onClosePress: () => void;
    onVerifyCode: (password: string) => void;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClosePress, onVerifyCode } = props;
    const dispatch = useAppDispatch();

    const [pinCode, setPinCode] = useState('');
    const [error, setError] = useState('');

    const onVerifyPress = useCallback(() => {
        if (pinCode) {
            dispatch(verifyPassword(pinCode))
                .then(() => {
                    setError('');
                    onClosePress();
                    onVerifyCode(pinCode);
                })
                .catch((e: any) => {
                    setError(e?.message ?? 'Unknown Error');
                });
        } else {
            setError('Pin Code is required.');
        }
    }, [pinCode, dispatch, onClosePress, onVerifyCode]);

    useEffect(() => {
        if (!visible) {
            setPinCode('');
        }
    }, [visible]);

    return (
        <Modal
            visible={visible}
            onClose={() => {
                onClosePress();
            }}>
            <Header title="Verify Pin Code" hasBackButton={false} />
            <div className="flex flex-col justify-center items-center overflow-auto p-6">
                <img className="w-24 h-24 mb-6" src={Images.logo128} alt="" loading="lazy" />
                <div className="flex flex-col w-full">
                    <TextInput
                        label="Enter your Pin Code"
                        className="mb-3"
                        autoFocus
                        type="password"
                        placeholder="Pin Code"
                        value={pinCode}
                        onChange={e => setPinCode(e.target.value)}
                        onKeyUp={e => {
                            //detect enter key
                            if (e.key === 'Enter') {
                                onVerifyPress();
                            }
                        }}
                    />

                    {error ? <p className="text-sm text-red-500 mt-1">{error}</p> : null}

                    <button
                        onClick={e => {
                            onVerifyPress();
                            e.preventDefault();
                        }}
                        className="btn btn-primary w-full">
                        Verify
                    </button>
                </div>
            </div>
        </Modal>
    );
});
