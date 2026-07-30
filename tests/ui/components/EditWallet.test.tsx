import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EditWallet from '../../../src/ui/components/EditWallet';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children, onClose }: any) =>
        visible ? (
            <div data-testid="modal">
                <button data-testid="modal-close" onClick={onClose}>
                    close-modal
                </button>
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock('../../../src/ui/components/TextInput', () => ({
    __esModule: true,
    default: ({ value, onChange, label }: any) => (
        <input data-testid="text-input" aria-label={label} value={value} onChange={onChange} />
    ),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn(), showError: jest.fn() },
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    updateWallet: (...args: any[]) => ({ type: 'UPDATE_WALLET', args }),
}));

const wallet: any = { id: 'w1', name: 'Main Wallet' };

describe('EditWallet', () => {
    beforeEach(() => {
        mockDispatch.mockImplementation(() => Promise.resolve());
    });

    it('renders Edit Wallet title and current name', () => {
        render(
            <EditWallet visible={true} wallet={wallet} onClosePress={jest.fn()} />,
        );
        expect(screen.getByText('Edit Wallet')).toBeInTheDocument();
        expect((screen.getByTestId('text-input') as HTMLInputElement).value).toBe('Main Wallet');
    });

    it('disables Update button when name is empty', () => {
        render(
            <EditWallet visible={true} wallet={wallet} onClosePress={jest.fn()} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: '' } });
        expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
    });

    it('dispatches update on click', () => {
        render(
            <EditWallet visible={true} wallet={wallet} onClosePress={jest.fn()} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('returns early when wallet is undefined', () => {
        render(<EditWallet visible={true} onClosePress={jest.fn()} />);
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'Anything' } });
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('shows success toast and closes after successful update', async () => {
        const Toast = require('../../../src/ui/components/Toast').default;
        Toast.showSuccess = jest.fn();
        Toast.showError = jest.fn();
        mockDispatch.mockImplementation(() => Promise.resolve());
        const onClosePress = jest.fn();
        render(<EditWallet visible={true} wallet={wallet} onClosePress={onClosePress} />);
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        await new Promise(r => setTimeout(r, 0));
        expect(Toast.showSuccess).toHaveBeenCalledWith('Update wallet succeeded.');
        expect(onClosePress).toHaveBeenCalled();
    });

    it('shows error toast when dispatch rejects with message', async () => {
        const Toast = require('../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        mockDispatch.mockImplementation(() => Promise.reject(new Error('nope')));
        render(<EditWallet visible={true} wallet={wallet} onClosePress={jest.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        await new Promise(r => setTimeout(r, 0));
        expect(Toast.showError).toHaveBeenCalledWith('nope');
    });

    it('does not call showError when error has no message', async () => {
        const Toast = require('../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        mockDispatch.mockImplementation(() => Promise.reject({}));
        render(<EditWallet visible={true} wallet={wallet} onClosePress={jest.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        await new Promise(r => setTimeout(r, 0));
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('invokes onClosePress when modal onClose fires', () => {
        const onClosePress = jest.fn();
        render(<EditWallet visible={true} wallet={wallet} onClosePress={onClosePress} />);
        fireEvent.click(screen.getByTestId('modal-close'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('does not render when not visible', () => {
        render(<EditWallet visible={false} wallet={wallet} onClosePress={jest.fn()} />);
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
});
