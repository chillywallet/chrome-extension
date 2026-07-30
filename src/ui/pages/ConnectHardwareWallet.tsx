import React, { useCallback, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { ensureLedgerWebHidPermission } from '../../lib/ledger/ensureLedgerWebHidPermission';
import {
    LEDGER_ERR_COULD_NOT_CONNECT,
    LEDGER_ERR_NO_LEDGER_SELECTED,
} from '../../lib/ledger/ledgerErrorMessages';
import {
    ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_DONE_ROUTE,
    ONBOARDING_CONNECT_HARDWARE_WALLET_DONE_ROUTE,
} from '../../shared/constants/routes';
import { Images } from '../../shared/utils/Images';
import {
    clearLedgerHardwarePreviewSession,
    clearTrezorHardwarePreviewSession,
    setCompletedOnboarding,
} from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';
import HardwareSelectAddressesModal from '../components/HardwareSelectAddressesModal';
import Header from '../components/Header';
import OptionListRow from '../components/OptionListRow';
import Toast from '../components/Toast';

const ONBOARDING_PIN_REQUIRED_MESSAGE =
    'Your PIN code is required to create your wallet. Go back and unlock, or complete creating your PIN first.';

const LEDGER_INSTRUCTIONS =
    'Connect your Ledger directly to your computer via USB. Then unlock your Ledger and open the Ethereum app.';

const TREZOR_SUITE_DOWNLOAD_URL = 'https://trezor.io/trezor-suite';

type HardwareKind = 'ledger' | 'trezor';

function HardwareInstructions({ kind }: { kind: HardwareKind }) {
    if (kind === 'ledger') {
        return <>{LEDGER_INSTRUCTIONS}</>;
    }

    return (
        <>
            Before continuing, make sure{' '}
            <a
                href={TREZOR_SUITE_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline hover:text-primarydark">
                Trezor Suite is installed
            </a>{' '}
            and open. Connect your Trezor directly to your computer using USB, then unlock it if
            required and approve any prompts on the device.
        </>
    );
}

type Props = {
    backRoute: string;
    /** On onboarding — PIN from Create Pin Code; used to create the encrypted vault on first import. */
    vaultPassword?: string;
    onInitializeWalletSuccess?: () => Promise<void>;
};

/** Hoisted static backdrop (rendering-hoist-jsx) */
const hardwareRadialBackdrop = (
    <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_65%_at_50%_0%,rgba(107,70,210,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_65%_at_50%_0%,rgba(107,70,210,0.18),transparent)]"
        aria-hidden
    />
);

export default React.memo<Props>(function ConnectHardwareWallet({
    backRoute,
    vaultPassword,
    onInitializeWalletSuccess,
}) {
    const history = useHistory();
    const dispatch = useAppDispatch();
    const location = useLocation();

    const [ledgerPrep, setLedgerPrep] = useState(false);
    const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
    const [trezorModalOpen, setTrezorModalOpen] = useState(false);
    const [selectedHardware, setSelectedHardware] = useState<HardwareKind | null>(null);

    const isOnboardingFlow = location.pathname.startsWith('/onboarding');

    const hasVaultPin = typeof vaultPassword === 'string' && vaultPassword.trim().length > 0;

    const onBackPress = useCallback(() => {
        history.push(backRoute);
    }, [history, backRoute]);

    const handleHardwareImportComplete = useCallback(async () => {
        setLedgerModalOpen(false);
        setTrezorModalOpen(false);

        if (location.pathname.startsWith('/onboarding')) {
            if (onInitializeWalletSuccess) {
                await onInitializeWalletSuccess();
            }

            await dispatch(setCompletedOnboarding(false));
            history.push(ONBOARDING_CONNECT_HARDWARE_WALLET_DONE_ROUTE);
        } else {
            history.push(ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_DONE_ROUTE);
        }
    }, [dispatch, history, location.pathname, onInitializeWalletSuccess]);

    const handleLedgerModalClose = useCallback(async () => {
        setLedgerModalOpen(false);
        try {
            await dispatch(clearLedgerHardwarePreviewSession());
        } catch {
            /* best-effort cleanup */
        }
    }, [dispatch]);

    const handleTrezorModalClose = useCallback(async () => {
        setTrezorModalOpen(false);
        try {
            await dispatch(clearTrezorHardwarePreviewSession());
        } catch {
            /* best-effort cleanup */
        }
    }, [dispatch]);

    const onLedgerPress = useCallback(async () => {
        if (isOnboardingFlow && !hasVaultPin) {
            Toast.showError(ONBOARDING_PIN_REQUIRED_MESSAGE);
            return;
        }

        setLedgerPrep(true);
        try {
            await ensureLedgerWebHidPermission();
            setLedgerModalOpen(true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : LEDGER_ERR_COULD_NOT_CONNECT;

            // Do nothing if user cancelled the WebHID permission prompt
            if (message === LEDGER_ERR_NO_LEDGER_SELECTED) {
                return;
            }

            Toast.showError(message);
        } finally {
            setLedgerPrep(false);
        }
    }, [hasVaultPin, isOnboardingFlow]);

    const onTrezorPress = useCallback(() => {
        if (isOnboardingFlow && !hasVaultPin) {
            Toast.showError(ONBOARDING_PIN_REQUIRED_MESSAGE);
            return;
        }

        setTrezorModalOpen(true);
    }, [hasVaultPin, isOnboardingFlow]);

    const onContinuePress = useCallback(async () => {
        if (!selectedHardware) {
            return;
        }

        if (selectedHardware === 'ledger') {
            await onLedgerPress();
        } else {
            onTrezorPress();
        }
    }, [onLedgerPress, onTrezorPress, selectedHardware]);

    return (
        <div className="h-full min-h-0 flex flex-col bg-white dark:bg-dark text-slate-900 dark:text-slate-100">
            <Header title="Hardware wallet" onBackPress={onBackPress} />
            <div className="relative flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col">
                {hardwareRadialBackdrop}
                <div className="relative flex flex-col flex-1 px-6 py-8 max-w-md mx-auto w-full">
                    <p className="text-base font-medium text-slate-900 dark:text-white text-center tracking-tight mb-2">
                        Choose Your Hardware Wallet
                    </p>
                    <p className="text-sm leading-relaxed text-center text-slate-600 dark:text-slate-300 mb-6">
                        Select the hardware wallet you want to connect. Make sure your device is
                        plugged in, unlocked, and ready before continuing.
                    </p>

                    <div
                        className="rounded-2xl border border-slate-200/90 dark:border-darkline overflow-hidden bg-white/70 dark:bg-darker/90 backdrop-blur-[2px] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] dark:shadow-none"
                        role="radiogroup"
                        aria-label="Hardware wallet type">
                        <OptionListRow
                            disabled={ledgerPrep}
                            mode="select"
                            selected={selectedHardware === 'ledger'}
                            onClick={() => setSelectedHardware('ledger')}
                            label="Ledger"
                            withBottomBorder
                            iconSurface="neutral"
                            icon={<img src={Images.ledgerLogoOfficial} alt="" draggable={false} />}
                        />
                        <OptionListRow
                            disabled={ledgerPrep}
                            mode="select"
                            selected={selectedHardware === 'trezor'}
                            onClick={() => setSelectedHardware('trezor')}
                            label="Trezor"
                            withBottomBorder={false}
                            iconSurface="neutral"
                            icon={
                                <img
                                    src={Images.trezorLogoOfficial}
                                    alt=""
                                    className="object-contain"
                                    draggable={false}
                                />
                            }
                        />
                    </div>
                </div>

                <div className="relative shrink-0 border-t border-slate-200/90 dark:border-darkline bg-white/90 dark:bg-dark px-6 py-5">
                    {selectedHardware ? (
                        <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            <HardwareInstructions kind={selectedHardware} />
                        </p>
                    ) : null}
                    <button
                        type="button"
                        disabled={ledgerPrep || !selectedHardware}
                        onClick={() => void onContinuePress()}
                        className="btn btn-primary w-full disabled:opacity-40">
                        {ledgerPrep && selectedHardware === 'ledger' ? 'Connecting…' : 'Continue'}
                    </button>
                </div>
            </div>

            <HardwareSelectAddressesModal
                visible={ledgerModalOpen}
                onClose={() => void handleLedgerModalClose()}
                onComplete={handleHardwareImportComplete}
                hardware="ledger"
                vaultPassword={vaultPassword}
            />
            <HardwareSelectAddressesModal
                visible={trezorModalOpen}
                onClose={() => void handleTrezorModalClose()}
                onComplete={handleHardwareImportComplete}
                hardware="trezor"
                vaultPassword={vaultPassword}
            />
        </div>
    );
});
