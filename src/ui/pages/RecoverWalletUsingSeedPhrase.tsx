import { wordlist } from '@metamask/scure-bip39/dist/wordlists/english';
import React, { useCallback, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import {
    ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE,
    ONBOARDING_IMPORT_WALLET_DONE_ROUTE,
} from '../../shared/constants/routes';
import { addNewWallet, importWallet, setCompletedOnboarding } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import Header from '../components/Header';
import Toast from '../components/Toast';

type Props = {
    password: string;
    onInitializeWalletSuccess?: () => Promise<void>;
};

export default React.memo<Props>((props: Props) => {
    const { password, onInitializeWalletSuccess } = props;
    const history = useHistory();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const [mode, setMode] = useState<'12' | '24'>('12');
    const [secretPhrases12, setSecretPhrases12] = useState(Array.from({ length: 12 }, () => ''));
    const [secretPhrases24, setSecretPhrases24] = useState(Array.from({ length: 24 }, () => ''));

    const phrases = useMemo(() => {
        return mode === '12' ? secretPhrases12 : secretPhrases24;
    }, [mode, secretPhrases12, secretPhrases24]);

    const isCompleted = useMemo(() => {
        return phrases.every(phrase => phrase && wordlist.some(word => word === phrase));
    }, [phrases]);

    const onContinuePress = useCallback(async () => {
        try {
            const _seedPhrase = phrases.join(' ');

            if (location.pathname.startsWith('/onboarding')) {
                await dispatch(importWallet(password, _seedPhrase));
                onInitializeWalletSuccess && (await onInitializeWalletSuccess());
                await dispatch(setCompletedOnboarding(false));
                history.push(ONBOARDING_IMPORT_WALLET_DONE_ROUTE);
            } else {
                await dispatch(addNewWallet(_seedPhrase));
                onInitializeWalletSuccess && (await onInitializeWalletSuccess());
                history.push(ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE);
            }
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }
    }, [dispatch, history, location.pathname, onInitializeWalletSuccess, password, phrases]);

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const pasteData = e.clipboardData.getData('Text');
        let words = pasteData.split(/\s+/);

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
            Toast.showError(
                `The seed phrase must contain either 12 or 24 words. You entered ${words.length} words.`,
            );
            isInvalid = true;
        }

        if (!isInvalid) {
            e.preventDefault();
        }
    };

    return (
        <div className="h-full min-h-0 flex flex-col">
            <Header title="Recover Wallet" />

            <div
                className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col max-h-[calc(100vh-3rem-40px)]"
                onPaste={handlePaste}
                style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className={`flex flex-col px-10 pt-5 pb-5`}>
                    <div className="text-center text-lg font-semibold mb-3">
                        Secret Recovery Phrase
                    </div>
                    <div className="text-center text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                        Import an existing wallet with your 12 or 24-word secret recovery phrase.
                    </div>

                    <div>
                        <div className="grid grid-cols-12 gap-x-3 gap-y-2 text-sm relative">
                            {mode === '12' &&
                                secretPhrases12.map((phrase, index) => {
                                    const text = phrase?.trim() ?? '';
                                    const correctWord = text
                                        ? wordlist.find(word => word === phrase)
                                        : true;
                                    return (
                                        <div
                                            className={
                                                'col-span-4 border rounded-md flex flex-row items-center px-2 py-1 ' +
                                                (!correctWord ? 'border-[#EB5E6C]' : '')
                                            }
                                            key={index}>
                                            <span className="text-right text-xs mr-1 text-slate-400">
                                                {index + 1}.
                                            </span>
                                            <input
                                                type="text"
                                                value={phrase}
                                                onChange={e => {
                                                    const newSecretPhrases12 = [...secretPhrases12];
                                                    const text = (
                                                        e.target.value?.trim() ?? ''
                                                    ).toLowerCase();
                                                    newSecretPhrases12[index] = text;
                                                    setSecretPhrases12(newSecretPhrases12);
                                                }}
                                                className="w-full bg-transparent border-none outline-none"
                                            />
                                        </div>
                                    );
                                })}

                            {mode === '24' &&
                                secretPhrases24.map((phrase, index) => {
                                    const text = phrase?.trim() ?? '';
                                    const correctWord = text
                                        ? wordlist.find(word => word === phrase)
                                        : true;
                                    return (
                                        <div
                                            className={
                                                'col-span-4 border rounded-md flex flex-row items-center px-2 py-1 ' +
                                                (!correctWord ? 'border-[#EB5E6C]' : '')
                                            }
                                            key={index}>
                                            <span className="text-right text-xs mr-1 text-slate-400">
                                                {index + 1}.
                                            </span>
                                            <input
                                                type="text"
                                                value={phrase}
                                                onChange={e => {
                                                    const newSecretPhrases24 = [...secretPhrases24];
                                                    const text = (
                                                        e.target.value?.trim() ?? ''
                                                    ).toLowerCase();
                                                    newSecretPhrases24[index] = text;
                                                    setSecretPhrases24(newSecretPhrases24);
                                                }}
                                                className="w-full bg-transparent border-none outline-none"
                                            />
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="pt-5">
                        {mode === '12' && (
                            <div
                                className="text-center hover:text-primary underline cursor-pointer mb-3"
                                onClick={e => {
                                    setMode('24');
                                }}>
                                I have a 24-word recovery phrase
                            </div>
                        )}

                        {mode === '24' && (
                            <div
                                className="text-center hover:text-primary underline cursor-pointer mb-3"
                                onClick={e => {
                                    setMode('12');
                                }}>
                                I have a 12-word recovery phrase
                            </div>
                        )}

                        <button
                            disabled={!isCompleted}
                            className={
                                'btn btn-primary w-full ' + (isCompleted ? '' : 'btn-disabled')
                            }
                            onClick={onContinuePress}>
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
