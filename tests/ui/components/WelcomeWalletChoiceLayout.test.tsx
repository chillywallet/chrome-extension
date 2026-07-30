import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WelcomeWalletChoiceLayout from '../../../src/ui/components/WelcomeWalletChoiceLayout';

describe('WelcomeWalletChoiceLayout', () => {
    const defaultProps = {
        title: 'Test Title',
        subtitleLine1: 'Subtitle 1',
        subtitleLine2: 'Subtitle 2',
        onCreateWallet: jest.fn(),
        onImportWallet: jest.fn(),
        onConnectHardwareWallet: jest.fn(),
    };

    it('renders title and subtitles', () => {
        render(<WelcomeWalletChoiceLayout {...defaultProps} />);
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Subtitle 1')).toBeInTheDocument();
        expect(screen.getByText('Subtitle 2')).toBeInTheDocument();
    });

    it('calls onCreateWallet when create row is clicked', () => {
        render(<WelcomeWalletChoiceLayout {...defaultProps} />);
        fireEvent.click(screen.getByText('Create a New Wallet'));
        expect(defaultProps.onCreateWallet).toHaveBeenCalled();
    });

    it('calls onImportWallet when import row is clicked', () => {
        render(<WelcomeWalletChoiceLayout {...defaultProps} />);
        fireEvent.click(screen.getByText('Import an Existing Wallet'));
        expect(defaultProps.onImportWallet).toHaveBeenCalled();
    });

    it('calls onConnectHardwareWallet when hardware row is clicked', () => {
        render(<WelcomeWalletChoiceLayout {...defaultProps} />);
        fireEvent.click(screen.getByText('Connect a Hardware Wallet'));
        expect(defaultProps.onConnectHardwareWallet).toHaveBeenCalled();
    });

    it('disables all actions when actionsDisabled is true', () => {
        const onCreate = jest.fn();
        render(
            <WelcomeWalletChoiceLayout
                {...defaultProps}
                onCreateWallet={onCreate}
                actionsDisabled
            />,
        );
        fireEvent.click(screen.getByText('Create a New Wallet'));
        expect(onCreate).not.toHaveBeenCalled();
    });

    it('renders afterActionsSlot when provided', () => {
        render(
            <WelcomeWalletChoiceLayout
                {...defaultProps}
                afterActionsSlot={<div data-testid="after-slot">After Actions</div>}
            />,
        );
        expect(screen.getByTestId('after-slot')).toBeInTheDocument();
    });

    it('uses custom labels when provided', () => {
        render(
            <WelcomeWalletChoiceLayout
                {...defaultProps}
                createWalletLabel="Custom Create"
                importWalletLabel="Custom Import"
                connectHardwareWalletLabel="Custom Hardware"
            />,
        );
        expect(screen.getByText('Custom Create')).toBeInTheDocument();
        expect(screen.getByText('Custom Import')).toBeInTheDocument();
        expect(screen.getByText('Custom Hardware')).toBeInTheDocument();
    });
});
