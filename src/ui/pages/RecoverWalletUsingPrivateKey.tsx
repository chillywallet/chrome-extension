import React, { useCallback, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import {
    ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE,
    ONBOARDING_IMPORT_WALLET_DONE_ROUTE,
} from '../../shared/constants/routes';
import { addNewWallet, importWallet, setCompletedOnboarding } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import Header from '../components/Header';
import TextInput from '../components/TextInput';
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

    const [privateKey, setPrivateKey] = useState('');

    const isValidPrivateKey = useMemo(() => {
        // Basic validation for private key (64 character hex string, optionally with 0x prefix)
        const cleanKey = privateKey.replace(/^0x/, '').toLowerCase();
        return cleanKey.length === 64 && /^[0-9a-f]{64}$/.test(cleanKey);
    }, [privateKey]);

    const onContinuePress = useCallback(async () => {
        try {
            const cleanPrivateKey = privateKey.replace(/^0x/, '');

            if (location.pathname.startsWith('/onboarding')) {
                await dispatch(importWallet(password, cleanPrivateKey, true));
                onInitializeWalletSuccess && (await onInitializeWalletSuccess());
                await dispatch(setCompletedOnboarding(false));
                history.push(ONBOARDING_IMPORT_WALLET_DONE_ROUTE);
            } else {
                await dispatch(addNewWallet(cleanPrivateKey, true));
                onInitializeWalletSuccess && (await onInitializeWalletSuccess());
                history.push(ADD_NEW_WALLET_IMPORT_WALLET_DONE_ROUTE);
            }
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }
    }, [dispatch, history, location.pathname, onInitializeWalletSuccess, password, privateKey]);

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        const pasteData = e.clipboardData.getData('Text').trim();
        setPrivateKey(pasteData);
        e.preventDefault();
    }, []);

    const onKeyUp = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' && isValidPrivateKey) {
                onContinuePress();
            }
        },
        [isValidPrivateKey, onContinuePress],
    );

    return (
        <div className="h-full min-h-0 flex flex-col">
            <Header title="Recover Wallet" />

            <div
                className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col max-h-[calc(100vh-3rem-40px)]"
                style={{ WebkitOverflowScrolling: 'touch' }}
                onPaste={handlePaste}>
                <div className="flex flex-col flex-1 px-10 pt-5 pb-5">
                <div className="text-center text-lg font-semibold mb-3">Private Key</div>
                <div className="text-center text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                    Import an existing wallet with your private key. Keep it secure and never share
                    it.
                </div>

                <div className="flex flex-col space-y-4 mb-5">
                    <div className="relative">
                        <TextInput
                            label="Private Key"
                            type="text"
                            value={privateKey}
                            onChange={e => setPrivateKey(e.target.value)}
                            placeholder="Enter your private key"
                            className={privateKey && !isValidPrivateKey ? 'border-[#EB5E6C]' : ''}
                            onKeyUp={onKeyUp}
                        />
                        {privateKey && !isValidPrivateKey && (
                            <div className="text-sm text-[#EB5E6C] mt-1">
                                Invalid key. Must be a 64-character hexadecimal string.
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-5">
                    <button
                        disabled={!isValidPrivateKey}
                        className={
                            'btn btn-primary w-full ' + (isValidPrivateKey ? '' : 'btn-disabled')
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
