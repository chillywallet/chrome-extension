import { generateMnemonic } from 'bip39';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MdContentCopy } from 'react-icons/md';
import { useHistory, useLocation } from 'react-router-dom';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import {
    ADD_NEW_WALLET_CREATE_WALLET_DONE_ROUTE,
    ONBOARDING_CREATE_WALLET_DONE_ROUTE,
} from '../../shared/constants/routes';
import { addNewWallet, importWallet, setCompletedOnboarding } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import Header from '../components/Header';
import Toast from '../components/Toast';

type Props = {
    password?: string;
    onInitializeWalletSuccess?: () => Promise<void>;
};

export default React.memo<Props>((props: Props) => {
    const { onInitializeWalletSuccess, password } = props;
    const history = useHistory();
    const dispatch = useAppDispatch();
    const location = useLocation();

    const [isChecked, setChecked] = useState(false);
    const [visible, setVisible] = useState(false);
    const [seedPhrase12, setSeedPhrase12] = useState<string>('');
    const [seedPhrase24, setSeedPhrase24] = useState<string>('');
    const [characters, setCharacters] = useState<string[]>([]);
    const [seedStrength, setSeedStrength] = useState<12 | 24>(12);

    const recoverSeedPhrase = useMemo(() => {
        return seedStrength === 12 ? seedPhrase12 : seedPhrase24;
    }, [seedPhrase12, seedPhrase24, seedStrength]);

    const goToNextPage = useCallback(async () => {
        try {
            if (location.pathname.startsWith('/onboarding')) {
                if (password) {
                    await dispatch(importWallet(password, recoverSeedPhrase));
                    onInitializeWalletSuccess &&
                        (await onInitializeWalletSuccess());
                    await dispatch(setCompletedOnboarding(false));
                    history.push(ONBOARDING_CREATE_WALLET_DONE_ROUTE);
                }
            } else {
                await dispatch(addNewWallet(recoverSeedPhrase));
                onInitializeWalletSuccess && (await onInitializeWalletSuccess());
                history.push(ADD_NEW_WALLET_CREATE_WALLET_DONE_ROUTE);
            }
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }
    }, [
        dispatch,
        history,
        location.pathname,
        onInitializeWalletSuccess,
        password,
        recoverSeedPhrase,
    ]);

    const onCopyPhraseClick = useCallback(() => {
        navigator.clipboard.writeText(recoverSeedPhrase);
        Toast.showSuccess('Seed phrase copied to clipboard');
    }, [recoverSeedPhrase]);

    const onTabPress = useCallback((index: number) => {
        switch (index) {
            case 0:
                setSeedStrength(12);
                break;

            default:
                setSeedStrength(24);
                break;
        }
    }, []);

    useEffect(() => {
        if (seedStrength === 12) {
            if (!seedPhrase12) {
                const _value = generateMnemonic(128);
                setSeedPhrase12(_value);
            } else {
                setCharacters(seedPhrase12.split(' '));
            }
        } else {
            if (!seedPhrase24) {
                const _value = generateMnemonic(256);
                setSeedPhrase24(_value);
            } else {
                setCharacters(seedPhrase24.split(' '));
            }
        }
    }, [seedPhrase12, seedPhrase24, seedStrength]);

    return (
        <div className="h-full min-h-0 flex flex-col">
            <Header title="Create Wallet" />

            <div
                className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col max-h-[calc(100vh-3rem-40px)]"
                style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex flex-col p-10 pt-6 pb-6">
                    <div className="text-center text-lg font-semibold mb-3">
                        Secret Recovery Phrase
                    </div>
                    <div className="text-center text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                        This phrase is the ONLY way to restore your wallet. Do NOT disclose it to
                        anyone!
                    </div>

                    <div className="flex flex-row justify-center mb-5">
                        <button
                            className="rounded-full px-4 py-2 border dark:border-0 bg-primary hover:bg-primarydark text-white flex flex-row items-center text-sm"
                            onClick={onCopyPhraseClick}>
                            <MdContentCopy className="mr-2" />
                            Copy Phrase
                        </button>
                    </div>

                    <Tabs
                        onSelect={onTabPress}
                        defaultIndex={0}
                        selectedTabClassName="tab-selected-tab-class-name"
                        selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                        className="tab-class-name">
                        <TabList className="tab-tablist">
                            <Tab className="tab-tablist-tab">12 Words</Tab>
                            <Tab className="tab-tablist-tab">24 Words</Tab>
                        </TabList>

                        <TabPanel>
                            <div className="grid grid-cols-12 gap-3 text-sm relative mt-5 mb-5">
                                {characters.map((phrase, index) => {
                                    return (
                                        <div
                                            className="col-span-4 border rounded-md flex flex-row items-center px-2 py-1"
                                            key={index}>
                                            <span className="text-right mr-1 text-slate-400">
                                                {index + 1}.
                                            </span>
                                            <span>{visible ? phrase : 'password'}</span>
                                        </div>
                                    );
                                })}

                                <div
                                    onMouseEnter={() => setVisible(true)}
                                    onMouseLeave={() => setVisible(false)}
                                    className="absolute top-0 right-0 flex items-center justify-center w-full h-full backdrop-blur-sm hover:backdrop-blur-none hover:opacity-0 transition-all"></div>
                            </div>
                        </TabPanel>
                        <TabPanel>
                            <div className="grid grid-cols-12 gap-3 text-sm relative mt-5 mb-5">
                                {characters.map((phrase, index) => {
                                    return (
                                        <div
                                            className="col-span-4 border rounded-md flex flex-row items-center px-2 py-1"
                                            key={index}>
                                            <span className="text-right mr-1 text-slate-400">
                                                {index + 1}.
                                            </span>
                                            <span>{visible ? phrase : 'password'}</span>
                                        </div>
                                    );
                                })}

                                <div
                                    onMouseEnter={() => setVisible(true)}
                                    onMouseLeave={() => setVisible(false)}
                                    className="absolute top-0 right-0 flex items-center justify-center w-full h-full backdrop-blur-sm hover:backdrop-blur-none hover:opacity-0 transition-all"></div>
                            </div>
                        </TabPanel>
                    </Tabs>

                    <label className="flex flex-row items-center mt-3 mb-3 px-1">
                        <input
                            type="checkbox"
                            className="mr-2 bg-primary w-4 h-4 rounded-sm border border-primary"
                            checked={isChecked}
                            onChange={e => setChecked(e.target.checked)}
                        />
                        I saved my Secret Recovery Phrase
                    </label>

                    <button
                        disabled={!isChecked}
                        className={'btn btn-primary w-full ' + (isChecked ? '' : 'btn-disabled')}
                        onClick={goToNextPage}>
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
});
