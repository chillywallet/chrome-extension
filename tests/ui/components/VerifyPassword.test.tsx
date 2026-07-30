import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VerifyPassword from '../../../src/ui/components/VerifyPassword';

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
    default: ({ value, onChange, label, onKeyUp }: any) => (
        <input
            data-testid="text-input"
            aria-label={label}
            value={value}
            onChange={onChange}
            onKeyUp={onKeyUp}
        />
    ),
}));

jest.mock('../../../src/shared/utils/Images', () => ({
    Images: { logo128: 'logo.png' },
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    verifyPassword: (pw: string) => ({ type: 'VERIFY', pw }),
}));

const mockDispatch = jest.fn(() => Promise.resolve());
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

describe('VerifyPassword', () => {
    beforeEach(() => {
        mockDispatch.mockImplementation(() => Promise.resolve());
    });

    it('renders Verify Pin Code title and Verify button', () => {
        render(
            <VerifyPassword
                visible={true}
                onClosePress={jest.fn()}
                onVerifyCode={jest.fn()}
            />,
        );
        expect(screen.getByText('Verify Pin Code')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    });

    it('shows Pin Code is required when verifying empty pin', () => {
        render(
            <VerifyPassword
                visible={true}
                onClosePress={jest.fn()}
                onVerifyCode={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
        expect(screen.getByText('Pin Code is required.')).toBeInTheDocument();
    });

    it('calls onVerifyCode on successful verification', async () => {
        const onVerifyCode = jest.fn();
        const onClosePress = jest.fn();
        render(
            <VerifyPassword
                visible={true}
                onClosePress={onClosePress}
                onVerifyCode={onVerifyCode}
            />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'abc' } });
        fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
        await waitFor(() => expect(onVerifyCode).toHaveBeenCalledWith('abc'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('shows error message when verification rejects with message', async () => {
        mockDispatch.mockImplementation(() => Promise.reject(new Error('Bad pin')));
        render(
            <VerifyPassword
                visible={true}
                onClosePress={jest.fn()}
                onVerifyCode={jest.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'abc' } });
        fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
        await screen.findByText('Bad pin');
    });

    it('shows Unknown Error when reject has no message', async () => {
        mockDispatch.mockImplementation(() => Promise.reject({}));
        render(
            <VerifyPassword
                visible={true}
                onClosePress={jest.fn()}
                onVerifyCode={jest.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'abc' } });
        fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
        await screen.findByText('Unknown Error');
    });

    it('clears pin when visibility changes to false', () => {
        const { rerender } = render(
            <VerifyPassword
                visible={true}
                onClosePress={jest.fn()}
                onVerifyCode={jest.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'abc' } });
        expect((screen.getByTestId('text-input') as HTMLInputElement).value).toBe('abc');
        rerender(
            <VerifyPassword
                visible={false}
                onClosePress={jest.fn()}
                onVerifyCode={jest.fn()}
            />,
        );
        rerender(
            <VerifyPassword
                visible={true}
                onClosePress={jest.fn()}
                onVerifyCode={jest.fn()}
            />,
        );
        expect((screen.getByTestId('text-input') as HTMLInputElement).value).toBe('');
    });

    it('invokes onClosePress when modal onClose fires', () => {
        const onClosePress = jest.fn();
        render(
            <VerifyPassword
                visible={true}
                onClosePress={onClosePress}
                onVerifyCode={jest.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId('modal-close'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('triggers verify when Enter key is pressed', async () => {
        const onVerifyCode = jest.fn();
        render(
            <VerifyPassword
                visible={true}
                onClosePress={jest.fn()}
                onVerifyCode={onVerifyCode}
            />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pin1' } });
        fireEvent.keyUp(screen.getByTestId('text-input'), { key: 'Enter' });
        await waitFor(() => expect(onVerifyCode).toHaveBeenCalledWith('pin1'));
    });

    it('non-Enter key does not trigger verify', async () => {
        const onVerifyCode = jest.fn();
        render(
            <VerifyPassword
                visible={true}
                onClosePress={jest.fn()}
                onVerifyCode={onVerifyCode}
            />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pin1' } });
        fireEvent.keyUp(screen.getByTestId('text-input'), { key: 'a' });
        expect(onVerifyCode).not.toHaveBeenCalled();
    });

    it('does not render when not visible', () => {
        render(
            <VerifyPassword
                visible={false}
                onClosePress={jest.fn()}
                onVerifyCode={jest.fn()}
            />,
        );
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
});
