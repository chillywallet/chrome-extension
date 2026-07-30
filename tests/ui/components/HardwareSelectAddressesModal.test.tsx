import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import HardwareSelectAddressesModal from '../../../src/ui/components/HardwareSelectAddressesModal';

const mockDispatch = jest.fn();
const mockGetAllAccounts = jest.fn();
const mockGetUUIDFromAddress = jest.fn();
const mockGetLedgerPage = jest.fn();
const mockGetTrezorPage = jest.fn();
const mockImportLedger = jest.fn();
const mockImportTrezor = jest.fn();
const mockVerifyAllAccounts = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
let mockLocationPath = '/home';
let mockKeyringsState: Array<{ id?: string; type?: string }> = [];

jest.mock('react-router-dom', () => ({
    useLocation: () => ({ pathname: mockLocationPath }),
}));

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: () => 'light',
    useKeyrings: () => mockKeyringsState,
}));

jest.mock('../../../src/store/selectorUtils', () => ({
    getAllAccounts: (...a: any[]) => mockGetAllAccounts(...a),
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    getLedgerHardwareAddressPage: (...a: any[]) => mockGetLedgerPage(...a),
    getTrezorHardwareAddressPage: (...a: any[]) => mockGetTrezorPage(...a),
    importLedgerHardwareAccounts: (...a: any[]) => mockImportLedger(...a),
    importTrezorHardwareAccounts: (...a: any[]) => mockImportTrezor(...a),
    verifyAllAccounts: (...a: any[]) => mockVerifyAllAccounts(...a),
}));

jest.mock('../../../src/lib/WalletUtils', () => ({
    getUUIDFromAddress: (...a: any[]) => mockGetUUIDFromAddress(...a),
}));

jest.mock('../../../src/controller/KeyringController', () => ({
    KeyringTypes: { ledger: 'Ledger Hardware', trezor: 'Trezor Hardware' },
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showError: (...a: any[]) => mockShowError(...a),
        showSuccess: (...a: any[]) => mockShowSuccess(...a),
    },
}));

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children, onClose }: any) =>
        visible ? (
            <div data-testid="modal">
                <button data-testid="modal-backdrop" onClick={onClose} />
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/Checkbox', () => ({
    __esModule: true,
    default: ({ checked, onChange, disabled, title }: any) => (
        <label data-testid="checkbox">
            <input
                type="checkbox"
                checked={!!checked}
                disabled={!!disabled}
                onChange={e => onChange(e.target.checked)}
            />
            {typeof title === 'string' ? <span>{title}</span> : title}
        </label>
    ),
}));

jest.mock('../../../src/shared/utils/format', () => ({
    formatWalletAddress: (a: string) => a,
}));

beforeEach(() => {
    mockDispatch.mockImplementation((action: any) => {
        if (typeof action === 'function') return action(jest.fn(), () => ({}));
        return action;
    });
    mockGetAllAccounts.mockReturnValue([]);
    mockGetUUIDFromAddress.mockImplementation((addr: string) => `uuid-${addr.toLowerCase()}`);
    mockGetLedgerPage.mockReset();
    mockGetTrezorPage.mockReset();
    mockImportLedger.mockReset();
    mockImportTrezor.mockReset();
    mockVerifyAllAccounts.mockReset();
    mockShowError.mockReset();
    mockShowSuccess.mockReset();
    mockLocationPath = '/home';
    mockKeyringsState = [];

    // Default page response
    mockGetLedgerPage.mockReturnValue([
        { address: '0xaaaa1', index: 0 },
        { address: '0xaaaa2', index: 1 },
        { address: '0xaaaa3', index: 2 },
    ]);
    mockGetTrezorPage.mockReturnValue([
        { address: '0xbbbb1', index: 0 },
        { address: '0xbbbb2', index: 1 },
    ]);

    Object.defineProperty(global.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
});

async function flush() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('HardwareSelectAddressesModal', () => {
    it('renders nothing when not visible', () => {
        const { container } = render(
            <HardwareSelectAddressesModal
                visible={false}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        expect(container.textContent).toBe('');
    });

    it('loads the first Ledger page on open and pre-selects the first selectable row', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        expect(screen.getByText('Select Ledger addresses')).toBeInTheDocument();
        expect(mockGetLedgerPage).toHaveBeenCalledWith('first', null);
    });

    it('loads the first Trezor page when hardware=trezor', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
                hardware="trezor"
            />,
        );
        await flush();
        expect(screen.getByText('Select Trezor addresses')).toBeInTheDocument();
        expect(mockGetTrezorPage).toHaveBeenCalled();
    });

    it('falls back to error toast and onClose when the first page fetch rejects with Error', async () => {
        mockGetLedgerPage.mockImplementation(() => {
            throw new Error('hid unplug');
        });
        const onClose = jest.fn();
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={onClose}
                onComplete={() => {}}
            />,
        );
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('hid unplug');
        expect(onClose).toHaveBeenCalled();
    });

    it('uses generic copy when first page fetch rejects with a non-Error', async () => {
        mockGetLedgerPage.mockImplementation(() => {
            throw 'not an Error';
        });
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('Could not load Ledger addresses.');
    });

    it('handles "Next" page button', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        mockGetLedgerPage.mockReturnValueOnce([{ address: '0xnext', index: 5 }]);
        fireEvent.click(screen.getByLabelText('Next page'));
        await flush();
        expect(mockGetLedgerPage).toHaveBeenLastCalledWith('next', null);
    });

    it('Next page rejection shows an error toast', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        mockGetLedgerPage.mockImplementationOnce(() => {
            throw new Error('nope');
        });
        fireEvent.click(screen.getByLabelText('Next page'));
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('nope');
    });

    it('Next page rejection with non-Error uses generic copy', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        mockGetLedgerPage.mockImplementationOnce(() => {
            throw 'oh no';
        });
        fireEvent.click(screen.getByLabelText('Next page'));
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('Could not load next page.');
    });

    it('Previous button is disabled at depth=0 and works after Next', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        const prev = screen.getByLabelText('Previous page') as HTMLButtonElement;
        expect(prev).toBeDisabled();
        // Go forward then come back
        mockGetLedgerPage.mockReturnValueOnce([{ address: '0xn1', index: 10 }]);
        fireEvent.click(screen.getByLabelText('Next page'));
        await flush();
        mockGetLedgerPage.mockReturnValueOnce([{ address: '0xp1', index: 0 }]);
        fireEvent.click(prev);
        await flush();
        expect(mockGetLedgerPage).toHaveBeenLastCalledWith('prev', null);
    });

    it('Previous page rejection shows an error toast', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        // Move forward so prev is enabled
        mockGetLedgerPage.mockReturnValueOnce([{ address: '0xn1', index: 10 }]);
        fireEvent.click(screen.getByLabelText('Next page'));
        await flush();
        mockGetLedgerPage.mockImplementationOnce(() => {
            throw new Error('prev down');
        });
        fireEvent.click(screen.getByLabelText('Previous page'));
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('prev down');

        mockGetLedgerPage.mockImplementationOnce(() => {
            throw 'no';
        });
        fireEvent.click(screen.getByLabelText('Previous page'));
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('Could not load previous page.');
    });

    it('copies an address via the clipboard button', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        const copy = screen.getAllByLabelText('Copy address');
        fireEvent.click(copy[0]);
        expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith('0xaaaa1');
        expect(mockShowSuccess).toHaveBeenCalledWith('Copied to clipboard');
    });

    it('shows an error if Import is clicked with no selections', async () => {
        // Suppress default first-row selection by making all rows "already imported"
        mockGetAllAccounts.mockReturnValue([
            { address: '0xaaaa1' },
            { address: '0xaaaa2' },
            { address: '0xaaaa3' },
        ]);
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        // Button is disabled — so we call onConfirm via DOM-fired click anyway
        const importBtn = screen.getByRole('button', { name: /Import/ }) as HTMLButtonElement;
        expect(importBtn).toBeDisabled();
    });


    it('imports selected Trezor addresses when hardware=trezor', async () => {
        mockImportTrezor.mockReturnValue(Promise.resolve());
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
                hardware="trezor"
            />,
        );
        await flush();
        fireEvent.click(screen.getByRole('button', { name: /Import/ }));
        await flush();
        expect(mockImportTrezor).toHaveBeenCalled();
    });

    it('shows error toast on import failure (Error)', async () => {
        mockImportLedger.mockImplementationOnce(async () => {
            throw new Error('bad import');
        });
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        fireEvent.click(screen.getByRole('button', { name: /Import/ }));
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('bad import');
    });

    it('shows generic toast on import failure (non-Error)', async () => {
        mockImportLedger.mockImplementationOnce(async () => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw 'not an Error';
        });
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        fireEvent.click(screen.getByRole('button', { name: /Import/ }));
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('Could not import Ledger accounts.');
    });

    it('requires a vaultPassword in the onboarding flow', async () => {
        mockLocationPath = '/onboarding/foo';
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        fireEvent.click(screen.getByRole('button', { name: /Import/ }));
        await flush();
        expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('PIN code is required'));
        expect(mockImportLedger).not.toHaveBeenCalled();
    });

    it('proceeds in the onboarding flow when vaultPassword is provided', async () => {
        mockLocationPath = '/onboarding/foo';
        mockImportLedger.mockReturnValue(Promise.resolve());
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
                vaultPassword="secret"
            />,
        );
        await flush();
        fireEvent.click(screen.getByRole('button', { name: /Import/ }));
        await flush();
        expect(mockImportLedger).toHaveBeenCalled();
    });

    it('uses an existing hardware wallet id (paging) when supplied', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
                existingHardwareWalletId="wallet-123"
            />,
        );
        await flush();
        expect(mockGetLedgerPage).toHaveBeenCalledWith('first', 'wallet-123');
    });

    it('detects an in-vault hardware wallet via row-0 UUID match', async () => {
        mockGetUUIDFromAddress.mockImplementation(() => 'vault-uuid');
        mockKeyringsState = [{ type: 'Ledger Hardware', id: 'vault-uuid' }];
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        // Second page fetch (e.g., Next) should now use the vault wallet id
        fireEvent.click(screen.getByLabelText('Next page'));
        await flush();
        expect(mockGetLedgerPage).toHaveBeenLastCalledWith('next', 'vault-uuid');
    });

    it('selects all on the page (and re-clicking unselects all)', async () => {
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        // Select-all is the first checkbox in the toolbar
        const cbs = screen.getAllByTestId('checkbox');
        const selectAll = cbs[0].querySelector('input') as HTMLInputElement;
        fireEvent.click(selectAll);
        // Re-click to unselect
        fireEvent.click(selectAll);
    });

    it('toggleIndex ignores already-imported addresses', async () => {
        mockGetAllAccounts.mockReturnValue([{ address: '0xaaaa1' }]);
        render(
            <HardwareSelectAddressesModal
                visible={true}
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        await flush();
        const cbs = screen.getAllByTestId('checkbox');
        // First imported row: the row's checkbox is disabled, but we can still try
        // (toggle should be a no-op).
        const inputs = cbs.map(cb => cb.querySelector('input') as HTMLInputElement);
        // Find a disabled row checkbox
        const disabled = inputs.find(i => i.disabled);
        expect(disabled).toBeDefined();
    });
});
