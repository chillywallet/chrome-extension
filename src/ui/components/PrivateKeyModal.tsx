import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaExclamationTriangle, FaEye } from 'react-icons/fa';
import { ChillyAccount } from '../../shared/types/Wallet';
import { getPrivateKey } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import Header from './Header';
import Modal from './Modal';
import TextInput from './TextInput';
import Toast from './Toast';

type Props = {
    account?: ChillyAccount;
    visible: boolean;
    onClosePress: () => void;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClosePress, account } = props;
    const dispatch = useAppDispatch();

    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'reveal' | 'confirm'>('confirm');
    const [isChecked, setChecked] = useState<boolean>(false);
    const [privateKey, setPrivateKey] = useState<string>('');

    const disabled = useMemo(() => {
        return !isChecked || !password;
    }, [password, isChecked]);

    const onContinuePress = useCallback(async () => {
        if (!account) {
            return;
        }

        try {
            const _privateKey = await dispatch(getPrivateKey(password, account.address));
            setPrivateKey(_privateKey);
            setMode('reveal');
            setError('');
        } catch (error: any) {
            if (error?.message === 'Incorrect password') {
                setError('Incorrect Pin Code');
            } else {
                setError(error?.message ?? 'Unknown Error');
            }
        }
    }, [account, dispatch, password]);

    const onCopyKeyClick = useCallback(() => {
        navigator.clipboard.writeText(privateKey);
        Toast.showSuccess('Private key copied to clipboard');
    }, [privateKey]);

    useEffect(() => {
        if (!visible) {
            setPassword(process.env.BUILD_TYPE === 'Debug' ? '11111111' : '');
            setPrivateKey('');
            setChecked(false);
            setMode('confirm');
            setError('');
        }
    }, [visible]);

    return (
        <Modal visible={visible} onClose={onClosePress}>
            <Header title="Private Key" hasBackButton={false} onClosePress={onClosePress} />

            {mode === 'confirm' && (
                <div className="p-5">
                    <div className="flex flex-col items-center mb-3">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                            <FaExclamationTriangle size={32} className="text-red-700" />
                        </div>
                    </div>

                    <div className="flex flex-row items-center bg-slate-100 dark:bg-darker border-red-200 p-3 rounded-md mb-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0 mr-2">
                            <FaEye size={20} className="text-red-700" />
                        </div>

                        <div className="text-sm text-red-700">
                            Without your seed phrase, your private key is the only way to recover
                            access to your account. Keep it secure.
                        </div>
                    </div>

                    <TextInput
                        label="Enter your Pin Code to view private key"
                        className="mb-3"
                        type="password"
                        placeholder="Your Pin Code"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />

                    {error ? <p className="text-sm text-red-500 mt-1">{error}</p> : null}

                    <label className="flex flex-row items-center text-sm mb-5 mt-3">
                        <input
                            type="checkbox"
                            className="mr-2 bg-primary w-4 h-4 rounded-sm border border-primary"
                            checked={isChecked}
                            onChange={e => setChecked(e.target.checked)}
                        />
                        I will not share my private key with anyone, including Chilly.
                    </label>

                    <button
                        disabled={disabled}
                        className={'btn btn-primary w-full ' + (disabled ? 'btn-disabled' : '')}
                        onClick={e => {
                            e.preventDefault();
                            onContinuePress();
                        }}>
                        Continue
                    </button>
                </div>
            )}

            {mode === 'reveal' && (
                <div className="p-5">
                    <div className="flex flex-col items-center bg-slate-100 dark:bg-darker border border-red-200 dark:border-red-700 p-3 rounded-md text-red-700 mb-3">
                        <div className="font-semibold text-sm sm:text-lg text-center">
                            Do not share your private key!
                        </div>
                        <div className="text-xs sm:text-normal text-center">
                            If someone has your private key they will have full control of your
                            account.
                        </div>
                    </div>

                    <div className="flex flex-row w-full border dark:border-darkline shadow-md rounded-lg overflow-hidden bg-ice dark:bg-header my-5 p-3 items-center">
                        <p className="text-xs text-gray-400 flex-1 break-all mr-2">{privateKey}</p>
                        <button
                            className="w-20 h-7 bg-primary text-xs text-white rounded-full hover:bg-primarydark"
                            onClick={onCopyKeyClick}>
                            Copy Key
                        </button>
                    </div>

                    <button
                        disabled={!isChecked}
                        className={'btn w-full'}
                        onClick={() => {
                            onClosePress();
                        }}>
                        Done
                    </button>
                </div>
            )}
        </Modal>
    );
});
