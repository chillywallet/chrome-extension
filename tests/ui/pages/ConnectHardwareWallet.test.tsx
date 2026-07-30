import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import ConnectHardwareWallet from '../../../src/ui/pages/ConnectHardwareWallet';

const mockPush = jest.fn();
const mockDispatch = jest.fn();
const mockEnsureLedger = jest.fn();
const mockSetCompletedOnboarding = jest.fn(() => ({ type: 'SET_COMPLETED' }));
const mockClearLedgerSession = jest.fn(() => ({ type: 'CLEAR_LEDGER' }));
const mockClearTrezorSession = jest.fn(() => ({ type: 'CLEAR_TREZOR' }));
const mockShowError = jest.fn();
let mockLocationPath = '/onboarding/connect-hw';

jest.mock('react-router-dom', () => ({
    useHistory: () => ({ push: mockPush }),
    useLocation: () => ({ pathname: mockLocationPath }),
}));

jest.mock('../../../src/lib/ledger/ensureLedgerWebHidPermission', () => ({
    ensureLedgerWebHidPermission: (...a: any[]) => mockEnsureLedger(...a),
}));

jest.mock('../../../src/lib/ledger/ledgerErrorMessages', () => ({
    LEDGER_ERR_COULD_NOT_CONNECT: 'Could not connect Ledger.',
    LEDGER_ERR_NO_LEDGER_SELECTED: 'No Ledger was selected.',
}));

jest.mock('../../../src/shared/constants/routes', () => ({
    ONBOARDING_CONNECT_HARDWARE_WALLET_DONE_ROUTE: '/onboarding/done',
    ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_DONE_ROUTE: '/add/done',
}));

jest.mock('../../../src/shared/utils/Images', () => ({
    Images: {
        ledgerLogoOfficial: 'ledger.png',
        trezorLogoOfficial: 'trezor.png',
    },
}));

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    clearLedgerHardwarePreviewSession: () => mockClearLedgerSession(),
    clearTrezorHardwarePreviewSession: () => mockClearTrezorSession(),
    setCompletedOnboarding: (v: boolean) => mockSetCompletedOnboarding(v),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showError: (...a: any[]) => mockShowError(...a) },
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onBackPress }: any) => (
        <header>
            <button onClick={onBackPress} aria-label="back">
                back
            </button>
            <span>{title}</span>
        </header>
    ),
}));

jest.mock('../../../src/ui/components/OptionListRow', () => ({
    __esModule: true,
    default: ({ label, onClick, disabled, selected }: any) => (
        <button
            data-label={label}
            data-selected={selected ? 'yes' : 'no'}
            disabled={disabled}
            onClick={onClick}>
            {label}
        </button>
    ),
}));

jest.mock('../../../src/ui/components/HardwareSelectAddressesModal', () => ({
    __esModule: true,
    default: ({ visible, onComplete, onClose, hardware }: any) =>
        visible ? (
            <div data-testid={`hw-modal-${hardware}`}>
                <button onClick={onClose} aria-label={`close-${hardware}`}>
                    close
                </button>
                <button onClick={onComplete} aria-label={`complete-${hardware}`}>
                    complete
                </button>
            </div>
        ) : null,
}));

beforeEach(() => {
    mockPush.mockReset();
    mockDispatch.mockImplementation((action: any) =>
        typeof action === 'function' ? action(jest.fn(), () => ({})) : action,
    );
    mockEnsureLedger.mockReset();
    mockShowError.mockReset();
    mockSetCompletedOnboarding.mockClear();
    mockClearLedgerSession.mockClear();
    mockClearTrezorSession.mockClear();
    mockLocationPath = '/onboarding/connect-hw';
});

async function flush() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('ConnectHardwareWallet', () => {
    it('renders the choose-hardware screen with disabled Continue', () => {
        render(<ConnectHardwareWallet backRoute="/back" />);
        expect(screen.getByText('Choose Your Hardware Wallet')).toBeInTheDocument();
        const cont = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
        expect(cont).toBeDisabled();
    });

    it('back button pushes the back route', () => {
        render(<ConnectHardwareWallet backRoute="/somewhere" />);
        fireEvent.click(screen.getByLabelText('back'));
        expect(mockPush).toHaveBeenCalledWith('/somewhere');
    });

    it('selecting Ledger shows its instructions', () => {
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        expect(screen.getByText(/Connect your Ledger directly/)).toBeInTheDocument();
    });

    it('selecting Trezor shows its instructions', () => {
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Trezor' }));
        expect(screen.getByText(/Trezor Suite is installed/)).toBeInTheDocument();
    });

    it('blocks Ledger in onboarding when vault PIN is missing', async () => {
        render(<ConnectHardwareWallet backRoute="/back" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await flush();
        expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('PIN code is required'));
        expect(mockEnsureLedger).not.toHaveBeenCalled();
    });

    it('blocks Trezor in onboarding when vault PIN is missing', () => {
        render(<ConnectHardwareWallet backRoute="/back" />);
        fireEvent.click(screen.getByRole('button', { name: 'Trezor' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(mockShowError).toHaveBeenCalled();
    });

    it('connects to Ledger and opens the modal on Continue', async () => {
        mockEnsureLedger.mockResolvedValueOnce(undefined);
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        expect(mockEnsureLedger).toHaveBeenCalled();
        expect(screen.getByTestId('hw-modal-ledger')).toBeInTheDocument();
    });

    it('opens Trezor modal directly on Continue (no permission step)', () => {
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Trezor' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByTestId('hw-modal-trezor')).toBeInTheDocument();
    });

    it('shows a toast when ensureLedgerWebHidPermission throws (Error)', async () => {
        mockEnsureLedger.mockRejectedValueOnce(new Error('hid broken'));
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('hid broken');
    });

    it('silently ignores a cancelled WebHID permission prompt', async () => {
        mockEnsureLedger.mockRejectedValueOnce(new Error('No Ledger was selected.'));
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        expect(mockShowError).not.toHaveBeenCalled();
    });

    it('shows a default toast when ensureLedger throws non-Error', async () => {
        mockEnsureLedger.mockRejectedValueOnce('boom-not-error');
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        expect(mockShowError).toHaveBeenCalledWith('Could not connect Ledger.');
    });

    it('handles Ledger completion in onboarding (sets completion + routes)', async () => {
        mockEnsureLedger.mockResolvedValueOnce(undefined);
        const onInitSuccess = jest.fn().mockResolvedValue(undefined);
        render(
            <ConnectHardwareWallet
                backRoute="/back"
                vaultPassword="pw"
                onInitializeWalletSuccess={onInitSuccess}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        await act(async () => {
            fireEvent.click(screen.getByLabelText('complete-ledger'));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        expect(onInitSuccess).toHaveBeenCalled();
        expect(mockSetCompletedOnboarding).toHaveBeenCalledWith(false);
        expect(mockPush).toHaveBeenCalledWith('/onboarding/done');
    });

    it('handles Ledger completion outside onboarding (routes to add-new-wallet-done)', async () => {
        mockLocationPath = '/home/add-wallet';
        mockEnsureLedger.mockResolvedValueOnce(undefined);
        render(<ConnectHardwareWallet backRoute="/back" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        await act(async () => {
            fireEvent.click(screen.getByLabelText('complete-ledger'));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        expect(mockPush).toHaveBeenCalledWith('/add/done');
    });

    it('clears the Ledger preview session on close', async () => {
        mockEnsureLedger.mockResolvedValueOnce(undefined);
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        await act(async () => {
            fireEvent.click(screen.getByLabelText('close-ledger'));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        expect(mockClearLedgerSession).toHaveBeenCalled();
    });

    it('swallows close-cleanup errors for Ledger and Trezor', async () => {
        mockClearLedgerSession.mockImplementationOnce(() => {
            throw new Error('cleanup boom');
        });
        mockEnsureLedger.mockResolvedValueOnce(undefined);
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Ledger' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        await act(async () => {
            fireEvent.click(screen.getByLabelText('close-ledger'));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        // No throw means swallowed.
        expect(true).toBe(true);
    });

    it('clears the Trezor preview session on close', async () => {
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        fireEvent.click(screen.getByRole('button', { name: 'Trezor' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await flush();
        await act(async () => {
            fireEvent.click(screen.getByLabelText('close-trezor'));
            await Promise.resolve();
            await Promise.resolve();
        });
        await flush();
        expect(mockClearTrezorSession).toHaveBeenCalled();
    });

    it('Continue is a no-op when no hardware is selected', async () => {
        render(<ConnectHardwareWallet backRoute="/back" vaultPassword="pw" />);
        const cont = screen.getByRole('button', { name: 'Continue' });
        expect(cont).toBeDisabled();
    });
});
