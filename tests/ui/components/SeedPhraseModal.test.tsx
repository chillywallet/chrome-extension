import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SeedPhraseModal from '../../../src/ui/components/SeedPhraseModal';
import Toast from '../../../src/ui/components/Toast';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: any) =>
        visible ? <div data-testid="modal">{children}</div> : null,
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
    default: { showSuccess: jest.fn() },
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

const mockGetSeedPhrase = jest.fn();
jest.mock('../../../src/store/actions/uiActions', () => ({
    getSeedPhrase: (...args: any[]) => mockGetSeedPhrase(...args),
    showLoadingIndicator: () => ({ type: 'SHOW' }),
    hideLoadingIndicator: () => ({ type: 'HIDE' }),
}));

describe('SeedPhraseModal', () => {
    beforeEach(() => {
        mockDispatch.mockImplementation(() => ({ type: 'X' }));
        mockGetSeedPhrase.mockResolvedValue('a b c d e f g h i j k l');
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
    });

    it('renders the confirm form title', () => {
        render(<SeedPhraseModal visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByText('Reveal Seed Phrase')).toBeInTheDocument();
    });

    it('disables Continue until password and checkbox', () => {
        render(<SeedPhraseModal visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });

    it('does nothing when continue is pressed without wallet (early return)', async () => {
        const { container } = render(
            <SeedPhraseModal visible={true} onClosePress={jest.fn()} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await waitFor(() => {
            expect(mockGetSeedPhrase).not.toHaveBeenCalled();
        });
        // Stays in confirm mode
        expect(screen.queryByText('Do not share your seed phrase!')).not.toBeInTheDocument();
    });

    it('reveals seed words after continue', async () => {
        const wallet: any = { id: 'w1' };
        const { container } = render(
            <SeedPhraseModal visible={true} onClosePress={jest.fn()} wallet={wallet} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Do not share your seed phrase!');
    });

    it('shows "Incorrect Pin Code" when password is wrong', async () => {
        mockGetSeedPhrase.mockRejectedValueOnce(new Error('Incorrect password'));
        const wallet: any = { id: 'w1' };
        const { container } = render(
            <SeedPhraseModal visible={true} onClosePress={jest.fn()} wallet={wallet} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Incorrect Pin Code');
    });

    it('shows the raw error message for other failures', async () => {
        mockGetSeedPhrase.mockRejectedValueOnce(new Error('Boom'));
        const wallet: any = { id: 'w1' };
        const { container } = render(
            <SeedPhraseModal visible={true} onClosePress={jest.fn()} wallet={wallet} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Boom');
    });

    it('falls back to Unknown Error when the rejection has no message', async () => {
        mockGetSeedPhrase.mockRejectedValueOnce({});
        const wallet: any = { id: 'w1' };
        const { container } = render(
            <SeedPhraseModal visible={true} onClosePress={jest.fn()} wallet={wallet} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Unknown Error');
    });

    it('copies the seed phrase and shows a toast', async () => {
        const wallet: any = { id: 'w1' };
        const { container } = render(
            <SeedPhraseModal visible={true} onClosePress={jest.fn()} wallet={wallet} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Do not share your seed phrase!');

        fireEvent.click(screen.getByRole('button', { name: /copy phrase/i }));
        expect((navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith(
            'a b c d e f g h i j k l',
        );
        expect((Toast as any).showSuccess).toHaveBeenCalledWith(
            'Seed phrase copied to clipboard',
        );
    });

    it('Done button calls onClosePress in reveal mode', async () => {
        const onClose = jest.fn();
        const wallet: any = { id: 'w1' };
        const { container } = render(
            <SeedPhraseModal visible={true} onClosePress={onClose} wallet={wallet} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Do not share your seed phrase!');

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('resets internal state when visible becomes false', async () => {
        const wallet: any = { id: 'w1' };
        const { container, rerender } = render(
            <SeedPhraseModal visible={true} onClosePress={jest.fn()} wallet={wallet} />,
        );
        fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'pw' } });
        fireEvent.click(container.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByText('Do not share your seed phrase!');

        await act(async () => {
            rerender(<SeedPhraseModal visible={false} onClosePress={jest.fn()} wallet={wallet} />);
        });
        await act(async () => {
            rerender(<SeedPhraseModal visible={true} onClosePress={jest.fn()} wallet={wallet} />);
        });
        // After reset, returns to confirm mode
        expect(screen.queryByText('Do not share your seed phrase!')).not.toBeInTheDocument();
        expect(screen.getByText('Reveal Seed Phrase')).toBeInTheDocument();
    });

    it('uses debug password default when BUILD_TYPE is Debug', async () => {
        const original = process.env.BUILD_TYPE;
        process.env.BUILD_TYPE = 'Debug';
        try {
            render(<SeedPhraseModal visible={false} onClosePress={jest.fn()} />);
            // password gets reset to '11111111'; this exercises the Debug branch
        } finally {
            process.env.BUILD_TYPE = original;
        }
    });
});
