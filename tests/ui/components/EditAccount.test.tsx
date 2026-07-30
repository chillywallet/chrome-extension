import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EditAccount from '../../../src/ui/components/EditAccount';

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

jest.mock('../../../src/ui/components/EmojiPicker', () => ({
    __esModule: true,
    default: ({ emoji, onSelect }: any) => (
        <div data-testid="emoji-picker">
            <span data-testid="emoji-value">{emoji}</span>
            <button data-testid="emoji-select" onClick={() => onSelect('😺')}>
                select-emoji
            </button>
        </div>
    ),
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

jest.mock('../../../src/shared/utils/avatar', () => ({
    getRandomAvatar: () => '🦊',
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    updateAccount: (...args: any[]) => ({ type: 'UPDATE_ACCOUNT', args }),
}));

const account: any = {
    address: '0x1',
    metadata: { name: 'Original', avatar: '🐱' },
};

describe('EditAccount', () => {
    beforeEach(() => {
        mockDispatch.mockImplementation(() => Promise.resolve());
    });

    it('renders edit form for the account', () => {
        render(
            <EditAccount
                visible={true}
                account={account}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        expect(screen.getByText('Edit Account')).toBeInTheDocument();
        expect((screen.getByTestId('text-input') as HTMLInputElement).value).toBe('Original');
    });

    it('disables Update when name is empty', () => {
        render(
            <EditAccount
                visible={true}
                account={account}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: '' } });
        expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
    });

    it('dispatches update on click', () => {
        render(
            <EditAccount
                visible={true}
                account={account}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('does nothing on update click when account is undefined', () => {
        render(
            <EditAccount visible={true} onClosePress={jest.fn()} onBackPress={jest.fn()} />,
        );
        // The button is disabled because accountName is empty. Force-click via the
        // disabled-toggle requires a name; instead set a value first.
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'Hello' } });
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('shows error toast when dispatch rejects', async () => {
        const Toast = require('../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        mockDispatch.mockImplementation(() => Promise.reject(new Error('boom')));
        const onClosePress = jest.fn();
        render(
            <EditAccount
                visible={true}
                account={account}
                onClosePress={onClosePress}
                onBackPress={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        await new Promise(r => setTimeout(r, 0));
        expect(Toast.showError).toHaveBeenCalledWith('boom');
        expect(onClosePress).not.toHaveBeenCalled();
    });

    it('does not show error toast when error has no message', async () => {
        const Toast = require('../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        mockDispatch.mockImplementation(() => Promise.reject({}));
        render(
            <EditAccount
                visible={true}
                account={account}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        await new Promise(r => setTimeout(r, 0));
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('shows success toast and closes on successful dispatch', async () => {
        const Toast = require('../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        mockDispatch.mockImplementation(() => Promise.resolve());
        const onClosePress = jest.fn();
        render(
            <EditAccount
                visible={true}
                account={account}
                onClosePress={onClosePress}
                onBackPress={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        await new Promise(r => setTimeout(r, 0));
        expect(Toast.showSuccess).toHaveBeenCalledWith('Update account succeeded.');
        expect(onClosePress).toHaveBeenCalled();
    });

    it('falls back to random avatar when account has no avatar', () => {
        const accountNoAvatar: any = {
            address: '0xabc',
            metadata: { name: 'X', avatar: '' },
        };
        render(
            <EditAccount
                visible={true}
                account={accountNoAvatar}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        expect(screen.getByTestId('emoji-value').textContent).toBe('🦊');
    });

    it('uses smart wallet avatar branch with smartAddress when isSmartWallet=true', () => {
        const smartAccount: any = {
            address: '0xdef',
            smartAddress: '0xsmart',
            metadata: { name: 'Smart', smartAvatar: '🤖' },
        };
        render(
            <EditAccount
                visible={true}
                account={smartAccount}
                isSmartWallet={true}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        expect(screen.getByTestId('emoji-value').textContent).toBe('🤖');
    });

    it('uses random avatar via smartAddress branch when isSmartWallet and no smartAvatar', () => {
        const smartAccount: any = {
            address: '0xdef',
            smartAddress: '0xsmart',
            metadata: { name: 'Smart', smartAvatar: '' },
        };
        render(
            <EditAccount
                visible={true}
                account={smartAccount}
                isSmartWallet={true}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        expect(screen.getByTestId('emoji-value').textContent).toBe('🦊');
    });

    it('uses random avatar via address branch when isSmartWallet and no smartAddress', () => {
        const smartAccount: any = {
            address: '0xdef',
            metadata: { name: 'Smart', smartAvatar: '' },
        };
        render(
            <EditAccount
                visible={true}
                account={smartAccount}
                isSmartWallet={true}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        expect(screen.getByTestId('emoji-value').textContent).toBe('🦊');
    });

    it('does nothing when visible is false', () => {
        render(
            <EditAccount
                visible={false}
                account={account}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('invokes onClosePress when modal onClose fires', () => {
        const onClosePress = jest.fn();
        render(
            <EditAccount
                visible={true}
                account={account}
                onClosePress={onClosePress}
                onBackPress={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId('modal-close'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('updates emoji state when EmojiPicker selects a new emoji', () => {
        render(
            <EditAccount
                visible={true}
                account={account}
                onClosePress={jest.fn()}
                onBackPress={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId('emoji-select'));
        expect(screen.getByTestId('emoji-value').textContent).toBe('😺');
    });
});
