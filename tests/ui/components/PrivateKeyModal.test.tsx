import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PrivateKeyModal from '../../../src/ui/components/PrivateKeyModal';
import Toast from '../../../src/ui/components/Toast';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: any) =>
        visible ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: any) => (
        <div>
            <span>{title}</span>
            <button onClick={onClosePress}>hdr-close</button>
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
    default: { showSuccess: jest.fn() },
}));

const mockDispatch = jest.fn(() => Promise.resolve('pk-abc'));
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    getPrivateKey: (...args: any[]) => ({ type: 'GET_PK', args }),
}));

describe('PrivateKeyModal', () => {
    beforeEach(() => {
        mockDispatch.mockImplementation(() => Promise.resolve('pk-abc'));
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
    });

    it('renders confirm mode header and continue button disabled', () => {
        render(<PrivateKeyModal visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByText('Private Key')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });

    it('enables Continue after checkbox and password', () => {
        const { container } = render(
            <PrivateKeyModal visible={true} onClosePress={jest.fn()} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
    });

    it('does nothing on Continue when account is missing (early return)', async () => {
        const { container } = render(
            <PrivateKeyModal visible={true} onClosePress={jest.fn()} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await waitFor(() => {
            expect(mockDispatch).not.toHaveBeenCalled();
        });
        expect(screen.queryByText('Do not share your private key!')).not.toBeInTheDocument();
    });

    it('reveals the private key after continue', async () => {
        const account: any = { address: '0x1' };
        const { container } = render(
            <PrivateKeyModal visible={true} onClosePress={jest.fn()} account={account} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('pk-abc');
    });

    it('shows "Incorrect Pin Code" when password is wrong', async () => {
        mockDispatch.mockImplementationOnce(() =>
            Promise.reject(new Error('Incorrect password')),
        );
        const account: any = { address: '0x1' };
        const { container } = render(
            <PrivateKeyModal visible={true} onClosePress={jest.fn()} account={account} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Incorrect Pin Code');
    });

    it('shows raw error message for other failures', async () => {
        mockDispatch.mockImplementationOnce(() => Promise.reject(new Error('Boom')));
        const account: any = { address: '0x1' };
        const { container } = render(
            <PrivateKeyModal visible={true} onClosePress={jest.fn()} account={account} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Boom');
    });

    it('falls back to Unknown Error when rejection has no message', async () => {
        mockDispatch.mockImplementationOnce(() => Promise.reject({}));
        const account: any = { address: '0x1' };
        const { container } = render(
            <PrivateKeyModal visible={true} onClosePress={jest.fn()} account={account} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Unknown Error');
    });

    it('copies the private key and shows a toast', async () => {
        const account: any = { address: '0x1' };
        const { container } = render(
            <PrivateKeyModal visible={true} onClosePress={jest.fn()} account={account} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('pk-abc');

        fireEvent.click(screen.getByRole('button', { name: /copy key/i }));
        expect((navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith('pk-abc');
        expect((Toast as any).showSuccess).toHaveBeenCalledWith(
            'Private key copied to clipboard',
        );
    });

    it('Done button calls onClosePress in reveal mode', async () => {
        const onClose = jest.fn();
        const account: any = { address: '0x1' };
        const { container } = render(
            <PrivateKeyModal visible={true} onClosePress={onClose} account={account} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('pk-abc');

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('resets internal state when visible becomes false', async () => {
        const account: any = { address: '0x1' };
        const { container, rerender } = render(
            <PrivateKeyModal visible={true} onClosePress={jest.fn()} account={account} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('pk-abc');

        await act(async () => {
            rerender(<PrivateKeyModal visible={false} onClosePress={jest.fn()} account={account} />);
        });
        await act(async () => {
            rerender(<PrivateKeyModal visible={true} onClosePress={jest.fn()} account={account} />);
        });
        expect(screen.queryByText('Do not share your private key!')).not.toBeInTheDocument();
        expect(screen.getByText('Private Key')).toBeInTheDocument();
    });

    it('uses debug password default when BUILD_TYPE is Debug', async () => {
        const original = process.env.BUILD_TYPE;
        process.env.BUILD_TYPE = 'Debug';
        try {
            render(<PrivateKeyModal visible={false} onClosePress={jest.fn()} />);
        } finally {
            process.env.BUILD_TYPE = original;
        }
    });
});
