import { useCallback, useRef, useState } from 'react';
import { getErrorMessage } from '../../api/graphQL/BaseRequest';
import { ensureLedgerWebHidPermission } from '../../lib/ledger/ensureLedgerWebHidPermission';
import { hideLoadingIndicator, showLoadingIndicator } from '../../store/actions/uiActions';
import { getReduxStore, useAppDispatch } from '../../store/store';
import HardwareWalletSignModal, {
    getHardwareWalletSignVariant,
} from '../components/HardwareWalletSignModal';
import Toast from '../components/Toast';

type Options = {
    signingContext?: 'transaction' | 'message';
};

type WrapSubmitOptions = {
    /** Use when the signing account differs from the hook's default keyring type. */
    keyringType?: string | null;
};

function flushPaint(): Promise<void> {
    return new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

/**
 * For Ledger/Trezor accounts: opens an instructional modal right after the user submits,
 * then runs `submit`. Closes the modal when `submit` settles (or the user closes it earlier).
 *
 * If the global loading indicator turns on once the submit handler starts (e.g. Swap), it is
 * hidden while the modal stays open. If the user closes the modal early, loading is shown again
 * when the submit handler is still running.
 */
export function useHardwareWalletSignModal(
    keyringType: string | undefined | null,
    options?: Options,
) {
    const dispatch = useAppDispatch();
    const defaultVariant = getHardwareWalletSignVariant(keyringType);
    const [open, setOpen] = useState(false);
    const [activeVariant, setActiveVariant] =
        useState<ReturnType<typeof getHardwareWalletSignVariant>>(null);
    const signingContext = options?.signingContext ?? 'transaction';

    const submitRunningRef = useRef(false);
    const loadingHiddenForModalRef = useRef(false);

    const modalVariant = activeVariant ?? defaultVariant;

    const handleModalClose = useCallback(() => {
        if (loadingHiddenForModalRef.current && submitRunningRef.current) {
            dispatch(showLoadingIndicator());
        }
        loadingHiddenForModalRef.current = false;
        setActiveVariant(null);
        setOpen(false);
    }, [dispatch]);

    const wrapSubmit = useCallback(
        async (submit: () => void | Promise<void>, submitOptions?: WrapSubmitOptions) => {
            const variant = getHardwareWalletSignVariant(submitOptions?.keyringType ?? keyringType);
            if (variant) {
                try {
                    if (variant === 'ledger') {
                        await ensureLedgerWebHidPermission();
                    }
                } catch (error) {
                    const message = getErrorMessage(error);
                    Toast.showError(message);
                    return;
                }

                setActiveVariant(variant);
                setOpen(true);
                await flushPaint();
            }
            submitRunningRef.current = true;
            try {
                const pending = submit();
                if (variant) {
                    await Promise.resolve();
                    const redux = getReduxStore();
                    if (redux?.getState().uiState.isShowLoading) {
                        dispatch(hideLoadingIndicator());
                        loadingHiddenForModalRef.current = true;
                    }
                }
                await pending;
            } finally {
                submitRunningRef.current = false;
                loadingHiddenForModalRef.current = false;
                setActiveVariant(null);
                setOpen(false);
            }
        },
        [keyringType, dispatch],
    );

    const hardwareModal =
        modalVariant !== null ? (
            <HardwareWalletSignModal
                visible={open}
                onClose={handleModalClose}
                variant={modalVariant}
                signingContext={signingContext}
            />
        ) : null;

    return { wrapSubmit, hardwareModal };
}
