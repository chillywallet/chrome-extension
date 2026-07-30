import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AlertModal from '../../../src/ui/components/AlertModal';
import EventType from '../../../src/shared/types/EventType';
import eventManager from '../../../src/shared/utils/eventManager';

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, className, onClick }: any) => (
            <div className={className} onClick={onClick} data-testid="motion-div">
                {children}
            </div>
        ),
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0.3,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <div data-testid="alert-modal-header">{title}</div>,
}));

describe('AlertModal', () => {
    beforeEach(() => {
        eventManager.list.clear();
    });

    it('shows title and plain message after showAlertModal', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({ title: 'Warning', message: 'Something happened' });

        await waitFor(() => {
            expect(screen.getByTestId('alert-modal-header')).toHaveTextContent('Warning');
            expect(screen.getByText('Something happened')).toBeInTheDocument();
        });
    });

    it('renders HTML message when isHtml is true', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({
            title: 'Note',
            message: '<strong>Rich text</strong>',
            isHtml: true,
        });

        await screen.findByText('Rich text');
        expect(document.querySelector('strong')).toHaveTextContent('Rich text');
    });

    it('does not render a message paragraph when message is omitted', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({ title: 'Title only' });

        await waitFor(() => expect(screen.getByTestId('alert-modal-header')).toHaveTextContent('Title only'));
        expect(document.querySelectorAll('p.break-words')).toHaveLength(0);
    });

    it('renders default Close button when buttons are absent', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({ title: 'T', message: 'M' });

        await screen.findByRole('button', { name: 'Close' });
    });

    it('closes when default Close is clicked', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({ title: 'T', message: 'M' });

        const closeBtn = await screen.findByRole('button', { name: 'Close' });
        fireEvent.click(closeBtn);

        await waitFor(() => expect(screen.queryByText('M')).not.toBeInTheDocument());
    });

    it('closes on backdrop click when closable defaults to true', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({ title: 'T', message: 'Body' });

        await screen.findByText('Body');

        const backdrop = document.querySelector('.sheet-overlay');
        expect(backdrop).not.toBeNull();
        fireEvent.click(backdrop!);

        await waitFor(() => expect(screen.queryByText('Body')).not.toBeInTheDocument());
    });

    it('does not close on backdrop click when closable is false', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({
            title: 'T',
            message: 'Locked',
            closable: false,
        });

        await screen.findByText('Locked');

        const backdrop = document.querySelector('.sheet-overlay');
        fireEvent.click(backdrop!);

        expect(screen.getByText('Locked')).toBeInTheDocument();
    });

    it('renders custom buttons with cancel and primary styling', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({
            title: 'Pick',
            message: '?',
            buttons: [
                { name: 'Back', type: 'cancel' },
                { name: 'Confirm', type: 'primary', onPress: jest.fn() },
            ],
        });

        const cancel = await screen.findByRole('button', { name: 'Back' });
        const confirm = screen.getByRole('button', { name: 'Confirm' });

        expect(cancel).toHaveClass('btn', 'w-full', 'mt-3');
        expect(cancel.className.includes('btn-primary')).toBe(false);

        expect(confirm).toHaveClass('btn', 'btn-primary', 'w-full', 'mt-3');
    });

    it('treats button without explicit type as primary', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({
            title: 'T',
            message: 'M',
            buttons: [{ name: 'OK' }],
        });

        const ok = await screen.findByRole('button', { name: 'OK' });
        expect(ok).toHaveClass('btn-primary');
    });

    it('invokes button onPress and closes the modal', async () => {
        const onPress = jest.fn();
        render(<AlertModal />);
        eventManager.showAlertModal({
            title: 'T',
            message: 'M',
            buttons: [{ name: 'Done', type: 'primary', onPress }],
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Done' }));

        expect(onPress).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByText('M')).not.toBeInTheDocument());
    });

    it('closes when a button has no onPress handler', async () => {
        render(<AlertModal />);
        eventManager.showAlertModal({
            title: 'T',
            message: 'Msg',
            buttons: [{ name: 'Dismiss', type: 'cancel' }],
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

        await waitFor(() => expect(screen.queryByText('Msg')).not.toBeInTheDocument());
    });

    it('unmount removes the SHOW_ALERT_MODAL subscription', () => {
        const offSpy = jest.spyOn(eventManager, 'off');
        const { unmount } = render(<AlertModal />);

        unmount();

        expect(offSpy).toHaveBeenCalledWith(EventType.SHOW_ALERT_MODAL, expect.any(Function));
        offSpy.mockRestore();
    });
});
