import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { IoCheckmarkCircle } from 'react-icons/io5';
import { MdContentCopy } from 'react-icons/md';
import { useLocation } from 'react-router-dom';

import { KeyringTypes } from '../../controller/KeyringController';
import { getUUIDFromAddress } from '../../lib/WalletUtils';
import {
    getLedgerHardwareAddressPage,
    getTrezorHardwareAddressPage,
    importLedgerHardwareAccounts,
    importTrezorHardwareAccounts,
} from '../../store/actions/uiActions';
import { getAllAccounts } from '../../store/selectorUtils';
import { useActualTheme, useKeyrings } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';

import { formatWalletAddress } from '../../shared/utils/format';
import Checkbox from './Checkbox';
import Modal from './Modal';
import Toast from './Toast';

const ONBOARDING_PIN_REQUIRED_MESSAGE =
    'Your PIN code is required to create your wallet. Go back and unlock, or complete creating your PIN first.';

export type HardwareSelectableRow = {
    address: string;
    index: number;
};

function normalizeSelectableAddress(addr: string): string {
    return addr.trim().toLowerCase();
}

type Props = {
    visible: boolean;
    onClose: () => void;
    /** Called after addresses are imported successfully. */
    onComplete: () => void;
    /** @default 'ledger' */
    hardware?: 'ledger' | 'trezor';
    /**
     * Onboarding first vault — PIN used to encrypt the vault when importing from a preview session.
     * Omit for “Add new wallet” (vault already exists/unlocked).
     */
    vaultPassword?: string;
    /**
     * Vault wallet id when adding addresses to an **existing** hardware wallet (e.g. Home → Add account).
     * Ensures paging/import uses the keyring in the vault instead of a preview session.
     */
    existingHardwareWalletId?: string;
};

export default React.memo<Props>(function HardwareSelectAddressesModal({
    visible,
    onClose,
    onComplete,
    hardware = 'ledger',
    vaultPassword,
    existingHardwareWalletId,
}) {
    const location = useLocation();
    const keyringType = hardware === 'trezor' ? KeyringTypes.trezor : KeyringTypes.ledger;
    const brand = hardware === 'trezor' ? 'Trezor' : 'Ledger';
    const dispatch = useAppDispatch();
    const keyrings = useKeyrings();
    const actualTheme = useActualTheme();
    const tooltipVariant = useMemo(
        () => (actualTheme === 'dark' ? 'light' : 'dark'),
        [actualTheme],
    );

    const [rows, setRows] = useState<HardwareSelectableRow[]>([]);
    const [pageLoading, setPageLoading] = useState(false);
    const [pageDepth, setPageDepth] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [hardwareDiscoveryId, setHardwareDiscoveryId] = useState<string | undefined>(undefined);
    const [existingWalletAddresses, setExistingWalletAddresses] = useState<Set<string>>(new Set());

    const visibleRef = useRef(visible);

    useEffect(() => {
        visibleRef.current = visible;
    }, [visible]);

    useEffect(() => {
        const row0 = rows.find(r => r.index === 0);

        if (!row0?.address) {
            return;
        }

        const id = getUUIDFromAddress(row0.address);

        if (id) {
            setHardwareDiscoveryId(id);
        }
    }, [rows]);

    const vaultHardwareWalletId = useMemo(() => {
        if (!hardwareDiscoveryId) {
            return undefined;
        }

        const alreadyInVault = keyrings.some(
            k => k.type === keyringType && k.id === hardwareDiscoveryId && k.id.length > 0,
        );

        return alreadyInVault ? hardwareDiscoveryId : undefined;
    }, [hardwareDiscoveryId, keyrings, keyringType]);

    const pagingWalletId = useMemo(() => {
        const hint = existingHardwareWalletId?.trim();
        if (hint) {
            return hint;
        }
        return vaultHardwareWalletId;
    }, [existingHardwareWalletId, vaultHardwareWalletId]);

    const fetchHardwarePage = useCallback(
        async (direction: 'first' | 'next' | 'prev') => {
            const raw =
                hardware === 'trezor'
                    ? await dispatch(
                          getTrezorHardwareAddressPage(direction, pagingWalletId ?? null),
                      )
                    : await dispatch(
                          getLedgerHardwareAddressPage(direction, pagingWalletId ?? null),
                      );
            return raw as HardwareSelectableRow[];
        },
        [dispatch, pagingWalletId, hardware],
    );

    const selectableRows = useMemo(
        () => rows.filter(r => !existingWalletAddresses.has(normalizeSelectableAddress(r.address))),
        [rows, existingWalletAddresses],
    );

    const pageAllSelected =
        selectableRows.length > 0 && selectableRows.every(r => selected.has(r.index));

    const loadFirst = useCallback(
        async (_existingWalletAddresses: Set<string>) => {
            setPageLoading(true);
            setPageDepth(0);
            try {
                const next = await fetchHardwarePage('first');
                setRows(next);

                const firstSelectable = next.find(
                    row => !_existingWalletAddresses.has(normalizeSelectableAddress(row.address)),
                );
                setSelected(firstSelectable ? new Set([firstSelectable.index]) : new Set());
            } catch (e: unknown) {
                if (visibleRef.current) {
                    Toast.showError(
                        e instanceof Error ? e.message : `Could not load ${brand} addresses.`,
                    );
                    onClose();
                }
            } finally {
                setPageLoading(false);
            }
        },
        [fetchHardwarePage, onClose, brand],
    );

    useEffect(() => {
        if (!visible) {
            setRows([]);
            setPageDepth(0);
            setHardwareDiscoveryId(undefined);
            return;
        }

        const accounts = getAllAccounts();
        const next = new Set<string>();

        for (const account of accounts) {
            if (typeof account.address === 'string' && account.address) {
                next.add(account.address.trim().toLowerCase());
            }
        }

        setExistingWalletAddresses(next);
        setSelected(new Set());
        void loadFirst(next);
    }, [visible, loadFirst]);

    const goNext = useCallback(async () => {
        setPageLoading(true);
        try {
            const next = await fetchHardwarePage('next');
            setRows(next);
            setPageDepth(d => d + 1);
        } catch (e: unknown) {
            Toast.showError(e instanceof Error ? e.message : 'Could not load next page.');
        } finally {
            setPageLoading(false);
        }
    }, [fetchHardwarePage]);

    const goPrev = useCallback(async () => {
        if (pageDepth === 0) {
            return;
        }
        setPageLoading(true);
        try {
            const next = await fetchHardwarePage('prev');
            setRows(next);
            setPageDepth(d => Math.max(0, d - 1));
        } catch (e: unknown) {
            Toast.showError(e instanceof Error ? e.message : 'Could not load previous page.');
        } finally {
            setPageLoading(false);
        }
    }, [fetchHardwarePage, pageDepth]);

    const toggleIndex = useCallback(
        (idx: number, checked: boolean) => {
            const row = rows.find(r => r.index === idx);
            if (!row || existingWalletAddresses.has(normalizeSelectableAddress(row.address))) {
                return;
            }
            setSelected(prev => {
                const next = new Set(prev);
                if (checked) {
                    next.add(idx);
                } else {
                    next.delete(idx);
                }
                return next;
            });
        },
        [rows, existingWalletAddresses],
    );

    const selectAllOnPage = useCallback(
        (checked: boolean) => {
            setSelected(prev => {
                const next = new Set(prev);
                for (const r of rows) {
                    if (existingWalletAddresses.has(normalizeSelectableAddress(r.address))) {
                        continue;
                    }
                    if (checked) {
                        next.add(r.index);
                    } else {
                        next.delete(r.index);
                    }
                }
                return next;
            });
        },
        [rows, existingWalletAddresses],
    );

    const copyAddressToClipboard = useCallback((e: React.MouseEvent, address: string) => {
        e.preventDefault();
        e.stopPropagation();
        void navigator.clipboard.writeText(address);
        Toast.showSuccess('Copied to clipboard');
    }, []);

    const onConfirm = useCallback(async () => {
        if (selected.size === 0) {
            Toast.showError('Select at least one address.');
            return;
        }

        const isOnboardingFlow = location.pathname.startsWith('/onboarding');

        if (isOnboardingFlow && (!vaultPassword || !vaultPassword.trim())) {
            Toast.showError(ONBOARDING_PIN_REQUIRED_MESSAGE);
            return;
        }

        setSubmitting(true);
        try {
            const vaultPwArg = pagingWalletId ? null : (vaultPassword ?? null);

            const sortedIndices = [...selected].sort((a, b) => a - b);
            const addressesKnownFromUi = sortedIndices
                .map(idx => rows.find(r => r.index === idx)?.address)
                .filter(
                    (addr): addr is string =>
                        typeof addr === 'string' && addr.trim().startsWith('0x'),
                )
                .map(addr => addr.trim());

            await dispatch(
                hardware === 'trezor'
                    ? importTrezorHardwareAccounts(
                          sortedIndices,
                          pagingWalletId ?? null,
                          vaultPwArg,
                          addressesKnownFromUi,
                      )
                    : importLedgerHardwareAccounts(
                          sortedIndices,
                          pagingWalletId ?? null,
                          vaultPwArg,
                          addressesKnownFromUi,
                      ),
            );
            onComplete();
        } catch (e: unknown) {
            Toast.showError(e instanceof Error ? e.message : `Could not import ${brand} accounts.`);
        } finally {
            setSubmitting(false);
        }
    }, [
        dispatch,
        location.pathname,
        onComplete,
        pagingWalletId,
        rows,
        selected,
        vaultPassword,
        hardware,
        brand,
    ]);

    return (
        <Modal visible={visible} onClose={onClose} closeOnBackdropClick={false}>
            <div className="flex flex-col min-h-[min(520px,85vh)] max-h-[min(520px,85vh)] bg-white dark:bg-dark text-slate-900 dark:text-slate-100">
                <div className="px-5 pt-5 pb-2 border-b border-slate-200/80 dark:border-darkline">
                    <h2 className="text-lg font-semibold tracking-tight">
                        Select {brand} addresses
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        Choose which addresses to add. Use the arrows to page through more derived
                        paths. Approve browser or device prompts if asked.
                    </p>
                </div>

                <div className="flex items-center justify-between gap-2 px-5 py-2 border-b border-slate-200/60 dark:border-darkline">
                    <Checkbox
                        className="gap-2"
                        checked={pageAllSelected}
                        disabled={selectableRows.length === 0 || pageLoading}
                        onChange={next => selectAllOnPage(next)}
                        title="Select all"
                    />
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={pageLoading || pageDepth === 0}
                            aria-label="Previous page"
                            onClick={() => void goPrev()}
                            className="inline-flex items-center justify-center size-9 rounded-lg border border-slate-200 dark:border-darkline text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-darkline/80 disabled:opacity-40 disabled:hover:bg-transparent">
                            <FaChevronLeft className="w-3.5 h-3.5" aria-hidden />
                        </button>
                        <button
                            type="button"
                            disabled={pageLoading}
                            aria-label="Next page"
                            onClick={() => void goNext()}
                            className="inline-flex items-center justify-center size-9 rounded-lg border border-slate-200 dark:border-darkline text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-darkline/80 disabled:opacity-40 disabled:hover:bg-transparent">
                            <FaChevronRight className="w-3.5 h-3.5" aria-hidden />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0 flex-col px-3 py-2">
                    <div className="flex flex-1 min-h-[268px] max-h-[min(280px,calc(85vh-220px))] flex-col overflow-hidden">
                        {pageLoading ? (
                            <div className="flex flex-1 flex-col justify-center px-2 py-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                                    Loading addresses…
                                </p>
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-1 flex-col justify-center px-2 py-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                                    No addresses on this page. Use the arrows to browse pages, or
                                    reopen the Ethereum app on your device.
                                </p>
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto pb-1">
                                {rows.map(row => {
                                    const imported = existingWalletAddresses.has(
                                        normalizeSelectableAddress(row.address),
                                    );

                                    return (
                                        <li
                                            key={`${row.index}-${row.address}`}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 ${imported ? 'cursor-default hover:bg-transparent opacity-85' : 'hover:bg-slate-50 dark:hover:bg-darkline/80'}`}>
                                            <Checkbox
                                                className="min-w-0 flex-1 gap-3"
                                                disabled={imported}
                                                checked={!imported && selected.has(row.index)}
                                                onChange={next => toggleIndex(row.index, next)}
                                                title={
                                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                                        <span className="shrink-0 text-xs tabular-nums uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                            #{row.index}
                                                        </span>
                                                        <p className="min-w-0 text-sm font-mono text-slate-900 dark:text-white">
                                                            {formatWalletAddress(row.address, 6)}
                                                        </p>
                                                        {imported ? (
                                                            <span
                                                                className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-ice dark:bg-header/70"
                                                                data-tooltip-id="chilly-tooltip"
                                                                data-tooltip-variant={
                                                                    tooltipVariant
                                                                }
                                                                data-tooltip-content="Already imported"
                                                                data-tooltip-place="top"
                                                                aria-label="Already imported">
                                                                <IoCheckmarkCircle
                                                                    className="text-sky-900 dark:text-ice"
                                                                    size={16}
                                                                    aria-hidden
                                                                />
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                }
                                            />
                                            <button
                                                type="button"
                                                onClick={e =>
                                                    copyAddressToClipboard(e, row.address)
                                                }
                                                className="shrink-0 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-darkline/80 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                aria-label="Copy address">
                                                <MdContentCopy size={14} aria-hidden />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 justify-end px-5 py-4 border-t border-slate-200/80 dark:border-darkline bg-slate-50/90 dark:bg-darker">
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-darkline disabled:opacity-40">
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={submitting || selected.size === 0}
                        onClick={() => void onConfirm()}
                        className="px-4 py-2.5 text-sm rounded-xl bg-primary hover:bg-primarydark text-white disabled:opacity-40 disabled:hover:bg-primary">
                        {submitting
                            ? 'Importing…'
                            : selected.size === 0
                              ? 'Import'
                              : `Import (${selected.size})`}
                    </button>
                </div>
            </div>
        </Modal>
    );
});
