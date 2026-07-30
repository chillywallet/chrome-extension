import React from 'react';
import { FaDownload, FaPlug, FaPlusCircle } from 'react-icons/fa';
import OptionListRow from './OptionListRow';

export type WelcomeWalletChoiceLayoutProps = {
    title: string;
    subtitleLine1: string;
    subtitleLine2: string;
    onCreateWallet: () => void;
    onImportWallet: () => void;
    onConnectHardwareWallet: () => void;
    /** Renders below the action list (e.g. terms checkbox). */
    afterActionsSlot?: React.ReactNode;
    /** When true, all actions are disabled. */
    actionsDisabled?: boolean;
    createWalletLabel?: string;
    importWalletLabel?: string;
    connectHardwareWalletLabel?: string;
};

const defaultCreateLabel = 'Create a New Wallet';
const defaultImportLabel = 'Import an Existing Wallet';
const defaultHardwareLabel = 'Connect a Hardware Wallet';

/** Hoisted static backdrop (rendering-hoist-jsx) — no props, stable across renders */
const welcomeRadialBackdrop = (
    <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_85%_70%_at_50%_-10%,rgba(107,70,210,0.14),transparent)] dark:bg-[radial-gradient(ellipse_85%_70%_at_50%_-10%,rgba(107,70,210,0.22),transparent)]"
        aria-hidden
    />
);

const createWalletRowIcon = <FaPlusCircle className="h-5 w-5" aria-hidden />;
const importWalletRowIcon = <FaDownload className="h-5 w-5" aria-hidden />;
const hardwareWalletRowIcon = <FaPlug className="h-5 w-5" aria-hidden />;

export default React.memo<WelcomeWalletChoiceLayoutProps>(
    function WelcomeWalletChoiceLayout(props) {
        const {
            title,
            subtitleLine1,
            subtitleLine2,
            onCreateWallet,
            onImportWallet,
            onConnectHardwareWallet,
            afterActionsSlot,
            actionsDisabled = false,
            createWalletLabel = defaultCreateLabel,
            importWalletLabel = defaultImportLabel,
            connectHardwareWalletLabel = defaultHardwareLabel,
        } = props;

        return (
            <div className="h-full min-h-0 flex flex-col bg-white dark:bg-dark text-slate-900 dark:text-slate-100">
                <div
                    className="relative flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col max-h-[calc(100vh-40px)]"
                    style={{ WebkitOverflowScrolling: 'touch' }}>
                    {welcomeRadialBackdrop}

                    <div className="relative flex flex-col flex-1 h-full px-8 pt-10 pb-10 sm:px-10">
                        <header className="text-center mb-2">
                            <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight text-balance text-slate-900 dark:text-white">
                                {title}
                            </h1>
                        </header>

                        <p className="text-sm leading-relaxed text-center text-slate-600 dark:text-slate-300 max-w-[22rem] mx-auto">
                            {subtitleLine1}
                        </p>
                        <p className="text-sm leading-relaxed text-center text-slate-600 dark:text-slate-300 max-w-[22rem] mx-auto mb-6">
                            {subtitleLine2}
                        </p>

                        <div className="w-full mt-6 rounded-2xl border border-slate-200/90 dark:border-darkline overflow-hidden bg-white/70 dark:bg-darker/90 backdrop-blur-[2px] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] dark:shadow-none">
                            <OptionListRow
                                disabled={actionsDisabled}
                                onClick={onCreateWallet}
                                label={createWalletLabel}
                                withBottomBorder
                                icon={createWalletRowIcon}
                            />
                            <OptionListRow
                                disabled={actionsDisabled}
                                onClick={onImportWallet}
                                label={importWalletLabel}
                                withBottomBorder
                                icon={importWalletRowIcon}
                            />
                            <OptionListRow
                                disabled={actionsDisabled}
                                onClick={onConnectHardwareWallet}
                                label={connectHardwareWalletLabel}
                                withBottomBorder={false}
                                icon={hardwareWalletRowIcon}
                            />
                        </div>

                        {afterActionsSlot != null ? (
                            <div className="w-full mt-6">{afterActionsSlot}</div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    },
);
