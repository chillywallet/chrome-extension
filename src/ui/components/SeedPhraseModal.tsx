import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaExclamationTriangle, FaEye } from 'react-icons/fa';
import { MdContentCopy } from 'react-icons/md';
import { ChillyWallet } from '../../shared/types/Wallet';
import {
    getSeedPhrase,
    hideLoadingIndicator,
    showLoadingIndicator,
} from '../../store/actions/uiActions';
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
    const { visible, onClosePress, wallet } = props;
    const dispatch = useAppDispatch();

    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'reveal' | 'confirm'>('confirm');
    const [isChecked, setChecked] = useState<boolean>(false);
    const [secretPhrases, setSecretPhrases] = useState<string[]>([]);

    const disabled = useMemo(() => {
        return !isChecked || !password;
    }, [password, isChecked]);

    const onContinuePress = useCallback(async () => {
        if (!wallet) {
            return;
        }

        try {
            dispatch(showLoadingIndicator());
            const seedPhrase = await getSeedPhrase(password, wallet.id);
            setSecretPhrases(seedPhrase.split(' '));
            setMode('reveal');
            setError('');
        } catch (error: any) {
            if (error?.message === 'Incorrect password') {
                setError('Incorrect Pin Code');
            } else {
                setError(error?.message ?? 'Unknown Error');
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    }, [wallet, dispatch, password]);

    const onCopyPhraseClick = useCallback(() => {
        navigator.clipboard.writeText(secretPhrases.join(' '));
        Toast.showSuccess('Seed phrase copied to clipboard');
    }, [secretPhrases]);

    useEffect(() => {
        if (!visible) {
            setPassword(process.env.BUILD_TYPE === 'Debug' ? '11111111' : '');
            setSecretPhrases([]);
            setChecked(false);
            setMode('confirm');
            setError('');
        }
    }, [visible]);

    return (
        <Modal visible={visible} onClose={onClosePress}>
            <Header title="Reveal Seed Phrase" hasBackButton={false} onClosePress={onClosePress} />

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
                            Your seed phrase is the only way to recover your wallet
                        </div>
                    </div>

                    <TextInput
                        label="Enter your Pin Code to reveal seed phrase"
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
                        I will not share my seed phrase with anyone, including Chilly.
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
                            Do not share your seed phrase!
                        </div>
                        <div className="text-xs sm:text-normal text-center">
                            If someone has your seed phrase they will have full control of your
                            wallet.
                        </div>
                    </div>

                    <div className="flex flex-row justify-center mb-3">
                        <button
                            className="rounded-full px-4 py-2 border dark:border-0 text-white bg-primary hover:bg-primarydark flex flex-row items-center text-sm"
                            onClick={onCopyPhraseClick}>
                            <MdContentCopy className="mr-2" />
                            Copy Phrase
                        </button>
                    </div>

                    <div className="grid grid-cols-12 gap-3 text-xs mb-5">
                        {secretPhrases.map((phrase, index) => {
                            return (
                                <div
                                    className="col-span-4 border rounded-md dark:border-darkline flex flex-row items-center px-2 py-1"
                                    key={index}>
                                    <span className="text-right mr-1 text-slate-400">
                                        {index + 1}.
                                    </span>
                                    <span className="flex-1 overflow-hidden">{phrase}</span>
                                </div>
                            );
                        })}
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
