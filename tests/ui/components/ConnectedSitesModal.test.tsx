import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import type { ConnectedSite } from '../../../src/shared/types/Connection';
import eventManager from '../../../src/shared/utils/eventManager';
import { removePermittedAccount } from '../../../src/store/actions/uiActions';
import ConnectedSitesModal from '../../../src/ui/components/ConnectedSitesModal';
import Toast from '../../../src/ui/components/Toast';

const mockUseCurrentAccount = jest.fn();
const mockUseConnectedSubjectsForSelectedAddress = jest.fn();

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useCurrentAccount: () => mockUseCurrentAccount(),
    useConnectedSubjectsForSelectedAddress: (isSmartWallet?: boolean) =>
        mockUseConnectedSubjectsForSelectedAddress(isSmartWallet),
}));

const mockDispatch = jest.fn();

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({
        children,
        visible,
        onClose,
    }: {
        children: React.ReactNode;
        visible: boolean;
        onClose: () => void;
    }) =>
        visible ? (
            <div data-testid="connected-sites-modal">
                <button type="button" data-testid="modal-close" onClick={onClose}>
                    close-modal
                </button>
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({
        title,
        onClosePress,
        action,
    }: {
        title: string;
        onClosePress: () => void;
        action?: React.ReactNode;
    }) => (
        <div>
            <span data-testid="header-title">{title}</span>
            {action}
            <button type="button" data-testid="header-close" onClick={onClosePress}>
                header-close
            </button>
        </div>
    ),
}));

jest.mock('../../../src/ui/components/ContextMenu', () => ({
    __esModule: true,
    default: ({ placeholder, menus }: { placeholder: React.ReactNode; menus: React.ReactNode }) => (
        <div data-testid="context-menu-mock">
            <div>{placeholder}</div>
            <div data-testid="context-menu-items">{menus}</div>
        </div>
    ),
    ContextMenuItem: ({
        title,
        onClick,
    }: {
        title: string;
        onClick: (item: unknown) => void;
    }) => (
        <button type="button" data-testid={`context-item-${title.replace(/\s+/g, '-').toLowerCase()}`} onClick={() => onClick({})}>
            {title}
        </button>
    ),
}));

jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        showAlertModal: jest.fn(),
    },
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: jest.fn(),
        showError: jest.fn(),
    },
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    removePermittedAccount: jest.fn(),
}));

function siteFixture(overrides: Partial<ConnectedSite> = {}): ConnectedSite {
    return {
        extensionId: null,
        origin: 'https://example.com',
        name: 'Example',
        iconUrl: 'https://example.com/favicon.ico',
        ...overrides,
    };
}

const EOA = '0x1111111111111111111111111111111111111111';
const SMART = '0x2222222222222222222222222222222222222222';

describe('ConnectedSitesModal', () => {
    const defaultProps = {
        visible: true,
        onClosePress: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([]);
        mockUseCurrentAccount.mockReturnValue({
            address: EOA,
            smartAddress: SMART,
            metadata: { name: 'Main' },
        });
        jest.mocked(removePermittedAccount).mockImplementation(() => async () => {
            await Promise.resolve();
        });
        mockDispatch.mockImplementation(async (action: unknown) => {
            if (typeof action === 'function') {
                return await (action as (d: typeof mockDispatch, getState: () => unknown) => Promise<unknown>)(
                    mockDispatch,
                    () => ({}),
                );
            }
            return action;
        });
    });

    it('renders nothing when not visible', () => {
        render(<ConnectedSitesModal {...defaultProps} visible={false} />);
        expect(screen.queryByTestId('connected-sites-modal')).not.toBeInTheDocument();
    });

    it('shows empty state with default account label when metadata name is missing', () => {
        mockUseCurrentAccount.mockReturnValue({
            address: EOA,
            metadata: {},
        });
        render(<ConnectedSitesModal {...defaultProps} />);

        expect(screen.getByText(/Your account is not connected to any sites/)).toBeInTheDocument();
        expect(screen.queryByTestId('context-menu-mock')).not.toBeInTheDocument();
    });

    it('shows empty state with account display name', () => {
        render(<ConnectedSitesModal {...defaultProps} />);

        expect(screen.getByText(/Main is not connected to any sites/)).toBeInTheDocument();
    });

    it('lists hostnames and disconnect actions when sites exist', () => {
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([
            siteFixture({ origin: 'https://app.uniswap.org' }),
            siteFixture({ origin: 'https://compound.finance/path' }),
        ]);

        render(<ConnectedSitesModal {...defaultProps} />);

        expect(screen.getByText(/Main is connected to these sites/)).toBeInTheDocument();
        expect(screen.getByText('app.uniswap.org')).toBeInTheDocument();
        expect(screen.getByText('compound.finance')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Disconnect' })).toHaveLength(2);
        expect(screen.getByTestId('context-menu-mock')).toBeInTheDocument();
    });

    it('disconnects one site with EOA address and shows success toast', async () => {
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture()]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

        await waitFor(() => {
            expect(removePermittedAccount).toHaveBeenCalledWith('https://example.com', EOA);
        });
        expect(Toast.showSuccess).toHaveBeenCalledWith('Disconnect the site succeeded');
    });

    it('uses smart address when isSmartWallet is true', async () => {
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture()]);
        render(<ConnectedSitesModal {...defaultProps} isSmartWallet />);

        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

        await waitFor(() => {
            expect(removePermittedAccount).toHaveBeenCalledWith('https://example.com', SMART);
        });
    });

    it('does not dispatch when active wallet address is missing', async () => {
        mockUseCurrentAccount.mockReturnValue({
            address: '',
            smartAddress: '',
            metadata: { name: 'X' },
        });
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture()]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

        await act(async () => {
            await Promise.resolve();
        });

        expect(removePermittedAccount).not.toHaveBeenCalled();
        expect(Toast.showSuccess).not.toHaveBeenCalled();
    });

    it('shows error toast when single disconnect fails with a message', async () => {
        jest.mocked(removePermittedAccount).mockImplementation(
            () => async () => {
                throw new Error('network down');
            },
        );
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture()]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('network down');
        });
    });

    it('does not show error toast when disconnect fails without a message', async () => {
        jest.mocked(removePermittedAccount).mockImplementation(
            () => async () => {
                throw { message: '' };
            },
        );
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture()]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

        await act(async () => {
            await Promise.resolve();
        });

        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('opens confirm alert for disconnect all with singular copy for one site', () => {
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture()]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByTestId('context-item-disconnect-all'));

        expect(eventManager.showAlertModal).toHaveBeenCalledTimes(1);
        const payload = jest.mocked(eventManager.showAlertModal).mock.calls[0][0];
        expect(payload.title).toBe('Disconnect All Sites/Dapps');
        expect(payload.message).toBe('Are you sure you want to disconnect from all 1 site/dapp?');
        expect(payload.buttons).toHaveLength(2);
        expect(payload.buttons[0].name).toBe('Disconnect All');
        expect(payload.buttons[1].name).toBe('Cancel');
    });

    it('uses plural copy in disconnect-all confirm when multiple sites', () => {
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture(), siteFixture({ origin: 'https://other.test' })]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByTestId('context-item-disconnect-all'));

        const payload = jest.mocked(eventManager.showAlertModal).mock.calls[0][0];
        expect(payload.message).toBe('Are you sure you want to disconnect from all 2 sites/dapps?');
    });

    it('disconnects all sites sequentially when confirm primary is pressed', async () => {
        const sites = [siteFixture({ origin: 'https://a.com' }), siteFixture({ origin: 'https://b.com' })];
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue(sites);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByTestId('context-item-disconnect-all'));
        const onPress = jest.mocked(eventManager.showAlertModal).mock.calls[0][0].buttons[0].onPress;
        await act(async () => {
            await onPress?.();
        });

        expect(removePermittedAccount).toHaveBeenNthCalledWith(1, 'https://a.com', EOA);
        expect(removePermittedAccount).toHaveBeenNthCalledWith(2, 'https://b.com', EOA);
        expect(Toast.showSuccess).toHaveBeenCalledWith('Disconnected all sites');
    });

    it('does not run disconnect-all when wallet or list is empty', () => {
        mockUseCurrentAccount.mockReturnValue({
            address: '',
            metadata: { name: 'X' },
        });
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture()]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByTestId('context-item-disconnect-all'));

        expect(eventManager.showAlertModal).not.toHaveBeenCalled();
    });

    it('shows error toast when disconnect-all fails mid-loop', async () => {
        jest.mocked(removePermittedAccount).mockImplementation(
            () => async () => {
                throw new Error('boom');
            },
        );
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture(), siteFixture({ origin: 'https://x.com' })]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByTestId('context-item-disconnect-all'));
        const onPress = jest.mocked(eventManager.showAlertModal).mock.calls[0][0].buttons[0].onPress;
        await act(async () => {
            await onPress?.();
        });

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('boom');
        });
    });

    it('does not show error toast when disconnect-all fails without a message', async () => {
        jest.mocked(removePermittedAccount).mockImplementation(
            () => async () => {
                throw {};
            },
        );
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([siteFixture()]);
        render(<ConnectedSitesModal {...defaultProps} />);

        fireEvent.click(screen.getByTestId('context-item-disconnect-all'));
        const onPress = jest.mocked(eventManager.showAlertModal).mock.calls[0][0].buttons[0].onPress;
        await act(async () => {
            await onPress?.();
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('passes isSmartWallet into connected-subjects selector', () => {
        mockUseConnectedSubjectsForSelectedAddress.mockReturnValue([]);
        const { rerender } = render(<ConnectedSitesModal {...defaultProps} isSmartWallet={false} />);
        expect(mockUseConnectedSubjectsForSelectedAddress).toHaveBeenLastCalledWith(false);

        rerender(<ConnectedSitesModal {...defaultProps} isSmartWallet />);
        expect(mockUseConnectedSubjectsForSelectedAddress).toHaveBeenLastCalledWith(true);
    });

    it('calls onClosePress from header close', () => {
        const onClosePress = jest.fn();
        render(<ConnectedSitesModal {...defaultProps} onClosePress={onClosePress} />);

        fireEvent.click(screen.getByTestId('header-close'));

        expect(onClosePress).toHaveBeenCalledTimes(1);
    });
});
