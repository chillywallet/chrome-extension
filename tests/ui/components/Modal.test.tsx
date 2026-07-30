import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../../../src/ui/components/Modal';

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, className, onClick, ...props }: any) => (
            <div className={className} onClick={onClick} data-testid="motion-div">
                {children}
            </div>
        ),
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0.3,
}));

describe('Modal', () => {
    const mockOnClose = jest.fn();

    beforeEach(() => {
        mockOnClose.mockClear();
    });

    it('renders children when visible is true', () => {
        render(
            <Modal visible={true} onClose={mockOnClose}>
                <div>Modal Content</div>
            </Modal>
        );

        expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('does not render when visible is false', () => {
        render(
            <Modal visible={false} onClose={mockOnClose}>
                <div>Modal Content</div>
            </Modal>
        );

        expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    });

    it('calls onClose when backdrop is clicked', () => {
        render(
            <Modal visible={true} onClose={mockOnClose}>
                <div>Modal Content</div>
            </Modal>
        );

        const backdrop = document.querySelector('.sheet-overlay');
        if (backdrop) {
            fireEvent.click(backdrop);
        }

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('renders with correct styling classes', () => {
        render(
            <Modal visible={true} onClose={mockOnClose}>
                <div>Modal Content</div>
            </Modal>
        );

        const modalContainer = document.querySelector('.sheet');
        expect(modalContainer).toBeInTheDocument();
        expect(modalContainer).toHaveClass('sm:rounded-2xl', 'shadow-xl', 'z-10');
    });
});
