import React from 'react';
import { KeyringTypes } from '../../controller/KeyringController';
import { Images } from '../../shared/utils/Images';
import Modal from './Modal';

export type HardwareWalletSignVariant = 'ledger' | 'trezor';

export function getHardwareWalletSignVariant(
    keyringType: string | undefined | null,
): HardwareWalletSignVariant | null {
    if (keyringType === KeyringTypes.ledger) {
        return 'ledger';
    }
    if (keyringType === KeyringTypes.trezor) {
        return 'trezor';
    }
    return null;
}

type Props = {
    visible: boolean;
    onClose: () => void;
    variant: HardwareWalletSignVariant;
    signingContext?: 'transaction' | 'message';
};

/**
 * Shown after the user confirms Send / Sign / Swap when the account uses Ledger or Trezor.
 */
const HardwareWalletSignModal = React.memo<Props>(function HardwareWalletSignModal({
    visible,
    onClose,
    variant,
    signingContext = 'transaction',
}) {
    const isLedger = variant === 'ledger';
    const isMessage = signingContext === 'message';

    const title = isLedger ? 'Approve on Ledger' : 'Approve on Trezor';
    const subtitle = isMessage
        ? isLedger
            ? 'Your signature request was submitted. Unlock your hardware wallet, open the Ethereum app, and confirm the message on the device.'
            : 'Your signature request was submitted. Complete the prompts on your Trezor (or in Trezor Suite) to finish signing.'
        : isLedger
          ? 'Your transaction was submitted. Unlock your hardware wallet, open the Ethereum app, and confirm all fields on the device.'
          : 'Your transaction was submitted. Complete the prompts on your Trezor (or in Trezor Suite) to finish signing.';

    return (
        <Modal visible={visible} onClose={onClose} closeOnBackdropClick={false}>
            <div className="px-5 pt-6 pb-5 text-left text-slate-900 dark:text-slate-100">
                <div className="mb-4 flex items-start gap-3">
                    <span
                        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/90 dark:bg-slate-100 dark:shadow-none dark:ring-slate-500/30"
                        aria-hidden>
                        <img
                            src={isLedger ? Images.ledgerLogoOfficial : Images.trezorLogoOfficial}
                            alt=""
                            draggable={false}
                            className="max-h-4 w-auto max-w-[2.6rem] object-contain"
                        />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200">
                                <span
                                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary dark:bg-accent"
                                    aria-hidden
                                />
                                Waiting for device
                            </span>
                        </div>
                        <h2
                            id="hw-sign-modal-title"
                            className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                            {title}
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <ul className="space-y-2 border-t border-slate-200 pt-4 text-xs leading-snug text-slate-600 dark:border-slate-600/60 dark:text-slate-300">
                    {isLedger ? (
                        <>
                            <li className="flex gap-2">
                                <span className="shrink-0 font-medium text-primary dark:text-accent">
                                    1.
                                </span>
                                <span>
                                    Review {isMessage ? 'the message' : 'the transaction'} on your
                                    Ledger device, then follow the on-device instructions to
                                    approve.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="shrink-0 font-medium text-primary dark:text-accent">
                                    2.
                                </span>
                                <span>
                                    If your Ledger does not respond, reconnect it, close other
                                    wallet apps, and make sure the Ethereum app is open on the
                                    device.
                                </span>
                            </li>
                        </>
                    ) : (
                        <>
                            <li className="flex gap-2">
                                <span className="shrink-0 font-medium text-primary dark:text-accent">
                                    1.
                                </span>
                                <span>
                                    When the Trezor window appears, carefully review all details
                                    before confirming.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="shrink-0 font-medium text-primary dark:text-accent">
                                    2.
                                </span>
                                <span>
                                    Review {isMessage ? 'the message' : 'the transaction'} on your
                                    Trezor device, then follow the on-device instructions to
                                    confirm.
                                </span>
                            </li>
                        </>
                    )}
                </ul>

                <button type="button" className="btn btn-primary w-full mt-5" onClick={onClose}>
                    Close
                </button>
            </div>
        </Modal>
    );
});

export default HardwareWalletSignModal;
