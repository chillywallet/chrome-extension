import React, { useCallback } from 'react';
import { FaKey, FaListOl } from 'react-icons/fa';
import { useHistory, useLocation } from 'react-router-dom';
import {
    ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE,
    ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ONBOARDING_IMPORT_WALLET_SEED_PHRASE_ROUTE,
} from '../../shared/constants/routes';
import Header from '../components/Header';
import OptionListRow from '../components/OptionListRow';

const privateKeyRowIcon = <FaKey className="h-4 w-4" aria-hidden />;
const seedPhraseRowIcon = <FaListOl className="h-4 w-4" aria-hidden />;

type Props = {};

export default React.memo<Props>((props: Props) => {
    const history = useHistory();
    const location = useLocation();

    const importWithSeedPhrase = useCallback(() => {
        if (location.pathname.startsWith('/onboarding')) {
            history.push(ONBOARDING_IMPORT_WALLET_SEED_PHRASE_ROUTE);
        } else {
            history.push(ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE);
        }
    }, [history, location.pathname]);

    const importWithPrivateKey = useCallback(() => {
        if (location.pathname.startsWith('/onboarding')) {
            history.push(ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
        } else {
            history.push(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
        }
    }, [history, location.pathname]);

    return (
        <div className="h-full min-h-0 flex flex-col bg-white dark:bg-dark text-slate-900 dark:text-slate-100">
            <Header title="Recover Wallet" />

            <div
                className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col max-h-[calc(100vh-3rem-40px)]"
                style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="relative flex flex-col flex-1 px-6 py-8 max-w-md mx-auto w-full">
                    <p className="text-base font-medium text-slate-900 dark:text-white text-center tracking-tight mb-2">
                        Choose Import Method
                    </p>
                    <p className="text-sm leading-relaxed text-center text-slate-600 dark:text-slate-300 mb-6">
                        Choose how you&apos;d like to import your existing wallet.
                    </p>

                    <div className="w-full rounded-2xl border border-slate-200/90 dark:border-darkline overflow-hidden bg-white/70 dark:bg-darker/90 backdrop-blur-[2px] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] dark:shadow-none">
                        <OptionListRow
                            onClick={importWithPrivateKey}
                            label="Private Key"
                            withBottomBorder
                            iconSurface="neutral"
                            icon={privateKeyRowIcon}
                        />
                        <OptionListRow
                            onClick={importWithSeedPhrase}
                            label="Seed Phrase"
                            withBottomBorder={false}
                            iconSurface="neutral"
                            icon={seedPhraseRowIcon}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});
