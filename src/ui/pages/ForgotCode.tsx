import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useHistory } from 'react-router-dom';
import { UNLOCK_ROUTE } from '../../shared/constants/routes';
import Header from '../components/Header';

type Props = {
    seedPhrase: string;
    onRecovered: (secretPhrases: string) => void;
};

export default React.memo<Props>((props: Props) => {
    const { onRecovered, seedPhrase } = props;
    const history = useHistory();

    const [mode, setMode] = useState<'12' | '24'>(
        seedPhrase.split(/\s+/).length === 24 ? '24' : '12',
    );
    const [secretPhrases12, setSecretPhrases12] = useState(Array.from({ length: 12 }, () => ''));
    const [secretPhrases24, setSecretPhrases24] = useState(Array.from({ length: 24 }, () => ''));
    const [showPassword12, setShowPassword12] = useState(Array.from({ length: 12 }, () => false));
    const [showPassword24, setShowPassword24] = useState(Array.from({ length: 24 }, () => false));

    const phrases = useMemo(() => {
        return mode === '12' ? secretPhrases12 : secretPhrases24;
    }, [mode, secretPhrases12, secretPhrases24]);

    const isCompleted = useMemo(() => {
        return phrases.every(phrase => phrase);
    }, [phrases]);

    const onContinuePress = useCallback(async () => {
        onRecovered(phrases.join(' '));
    }, [onRecovered, phrases]);

    const handlePaste = useCallback((text: string) => {
        let words = text.split(/\s+/);

        //filter empty words and lower case all words
        words = words.filter(word => word !== '').map(word => word.toLowerCase());

        let isInvalid = false;

        if (words.length === 12) {
            setSecretPhrases12(words);
            setMode('12');
        } else if (words.length === 24) {
            setSecretPhrases24(words);
            setMode('24');
        } else {
            isInvalid = true;
        }

        return isInvalid;
    }, []);

    useEffect(() => {
        const words = seedPhrase.split(/\s+/);

        if (words.length === 12 || words.length === 24) {
            handlePaste(seedPhrase);
        }
    }, [handlePaste, seedPhrase]);

    return (
        <div
            onPaste={e => {
                const pasteData = e.clipboardData.getData('Text');
                const isInvalid = handlePaste(pasteData);

                if (!isInvalid) {
                    e.preventDefault();
                }
            }}>
            <Header
                title="Back"
                onBackPress={() => {
                    history.replace(UNLOCK_ROUTE);
                }}
            />

            <div className="font-display text-3xl font-medium my-5">Reset Wallet</div>
            <div className="text-md mb-2">
                Chilly does not retain a copy of your Pin Code. Should you experience issues accessing
                your account or if you've forgotten your Pin Code, you can reset your wallet by
                entering your Secret Recovery Phrase.
            </div>
            <div className="text-md mb-5">
                Be aware that this procedure will delete your existing wallet and Secret Recovery
                Phrase from this device. Confirm that you have the correct Secret Recovery Phrase
                before continuing, as this action cannot be undone.
            </div>

            <div className="text-2xl font-semibold mb-5">Secret Recovery Phrase</div>

            <div className="grid grid-cols-12 gap-x-5 gap-y-4 text-sm relative mb-5">
                {mode === '12' &&
                    secretPhrases12.map((phrase, index) => {
                        return (
                            <div
                                className="col-span-6 md:col-span-4 border border-gray-600 rounded-md flex flex-row items-center px-2 py-1"
                                key={index}>
                                <span className="text-right text-xs mr-1 text-gray-700">
                                    {index + 1}.
                                </span>
                                <input
                                    type={showPassword12[index] ? 'text' : 'password'}
                                    value={phrase}
                                    onChange={e => {
                                        const newSecretPhrases12 = [...secretPhrases12];
                                        const text = (e.target.value?.trim() ?? '').toLowerCase();
                                        newSecretPhrases12[index] = text;
                                        setSecretPhrases12(newSecretPhrases12);
                                    }}
                                    className="w-full bg-transparent border-none outline-none"
                                />
                                <button
                                    onClick={() => {
                                        const newShowPassword12 = [...showPassword12];
                                        newShowPassword12[index] = !showPassword12[index];
                                        setShowPassword12(newShowPassword12);
                                    }}>
                                    {showPassword12[index] ? <FaEye /> : <FaEyeSlash />}
                                </button>
                            </div>
                        );
                    })}

                {mode === '24' &&
                    secretPhrases24.map((phrase, index) => {
                        return (
                            <div
                                className="col-span-6 md:col-span-4 border border-gray-600 rounded-md flex flex-row items-center px-2 py-1"
                                key={index}>
                                <span className="text-right text-xs mr-1 text-gray-700">
                                    {index + 1}.
                                </span>
                                <input
                                    type={showPassword24[index] ? 'text' : 'password'}
                                    value={phrase}
                                    onChange={e => {
                                        const newSecretPhrases24 = [...secretPhrases24];
                                        const text = (e.target.value?.trim() ?? '').toLowerCase();
                                        newSecretPhrases24[index] = text;
                                        setSecretPhrases24(newSecretPhrases24);
                                    }}
                                    className="w-full bg-transparent border-none outline-none"
                                />
                                <button
                                    onClick={() => {
                                        const newShowPassword24 = [...showPassword24];
                                        newShowPassword24[index] = !showPassword24[index];
                                        setShowPassword24(newShowPassword24);
                                    }}>
                                    {showPassword24[index] ? <FaEye /> : <FaEyeSlash />}
                                </button>
                            </div>
                        );
                    })}
            </div>

            {mode === '12' && (
                <div
                    className="hover:text-primary underline cursor-pointer mb-3"
                    onClick={e => {
                        setMode('24');
                    }}>
                    I have a 24-word recovery phrase
                </div>
            )}

            {mode === '24' && (
                <div
                    className="hover:text-primary underline cursor-pointer mb-3"
                    onClick={e => {
                        setMode('12');
                    }}>
                    I have a 12-word recovery phrase
                </div>
            )}

            <button
                disabled={!isCompleted}
                className={'btn btn-primary ' + (isCompleted ? '' : 'btn-disabled')}
                onClick={onContinuePress}>
                Continue
            </button>
        </div>
    );
});
