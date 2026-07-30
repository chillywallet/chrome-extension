import React from 'react';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';

import ContactCard from '../../../src/ui/components/ContactCard';

jest.mock('../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({
            placeholder,
            menus,
        }: {
            placeholder: React.ReactNode;
            menus: React.ReactNode;
        }) => (
            <div data-testid="contact-context-menu-root">
                <div data-testid="context-menu-trigger">{placeholder}</div>
                <div>{menus}</div>
            </div>
        ),
        ContextMenuItem: ({
            title,
            onClick,
            type,
        }: {
            title: string;
            onClick: (item: unknown) => void;
            type?: 'delete';
        }) => (
            <button
                type="button"
                data-testid={`ctx-${title.replace(/\s+/g, '-').toLowerCase()}`}
                className={type === 'delete' ? 'text-red-600' : undefined}
                onClick={() => onClick({})}>
                {title}
            </button>
        ),
    };
});

const VALID = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

describe('ContactCard', () => {
    const defaultProps = {
        walletAddress: VALID,
        name: 'Alice',
        avatar: '🦁' as string | null | undefined,
        onPress: jest.fn(),
        onMenuItemClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders name, emoji, and checksummed address', () => {
        render(<ContactCard {...defaultProps} />);
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('🦁')).toBeInTheDocument();
        expect(screen.getByText(VALID)).toBeInTheDocument();
    });

    it('calls onPress with preventDefault when row is clicked', () => {
        const onPress = jest.fn();
        render(<ContactCard {...defaultProps} onPress={onPress} />);
        const btn = screen.getByRole('button', { name: /alice/i });
        const ev = createEvent.click(btn, { bubbles: true, cancelable: true });
        const pd = jest.spyOn(ev, 'preventDefault');
        fireEvent(btn, ev);
        expect(pd).toHaveBeenCalled();
        expect(onPress).toHaveBeenCalled();
    });

    it('renders empty address line when wallet checksum fails', () => {
        render(<ContactCard {...defaultProps} walletAddress="not-an-address" />);
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.queryByText(/^0x/)).not.toBeInTheDocument();
    });

    it('treats nullish walletAddress like empty string for checksum', () => {
        render(
            <ContactCard
                {...defaultProps}
                walletAddress={undefined as unknown as string}
            />,
        );
        expect(screen.queryByText(/^0x/)).not.toBeInTheDocument();
    });

    it('shows Smart Wallet badge when isSmartWallet', () => {
        render(<ContactCard {...defaultProps} isSmartWallet={true} />);
        expect(screen.getByText('Smart Wallet')).toBeInTheDocument();
    });

    it('does not show Smart Wallet badge by default', () => {
        render(<ContactCard {...defaultProps} />);
        expect(screen.queryByText('Smart Wallet')).toBeNull();
    });

    it('renders context menu with View Address', () => {
        render(<ContactCard {...defaultProps} />);
        expect(screen.getByTestId('contact-context-menu-root')).toBeInTheDocument();
        expect(screen.getByTestId('ctx-view-address')).toBeInTheDocument();
    });

    it('calls onMenuItemClick for view_address with wallet and optional contactId', () => {
        const onMenuItemClick = jest.fn();
        render(
            <ContactCard
                {...defaultProps}
                contactId="c-99"
                onMenuItemClick={onMenuItemClick}
            />,
        );
        fireEvent.click(screen.getByTestId('ctx-view-address'));
        expect(onMenuItemClick).toHaveBeenCalledWith('view_address', VALID, 'c-99');
    });

    it('adds Delete Contact when isContact and contactId', () => {
        const onMenuItemClick = jest.fn();
        render(
            <ContactCard
                {...defaultProps}
                isContact={true}
                contactId="cid-1"
                onMenuItemClick={onMenuItemClick}
            />,
        );
        const del = screen.getByTestId('ctx-delete-contact');
        expect(del.className).toContain('text-red-600');
        fireEvent.click(del);
        expect(onMenuItemClick).toHaveBeenCalledWith('delete', VALID, 'cid-1');
    });

    it('omits Delete Contact when isContact but contactId is missing', () => {
        render(<ContactCard {...defaultProps} isContact={true} />);
        expect(screen.queryByTestId('ctx-delete-contact')).toBeNull();
    });

    it('omits Delete Contact when contactId set but isContact false', () => {
        render(<ContactCard {...defaultProps} contactId="only-id" />);
        expect(screen.queryByTestId('ctx-delete-contact')).toBeNull();
    });

    it('passes undefined contactId to onMenuItemClick when omitted', () => {
        const onMenuItemClick = jest.fn();
        render(<ContactCard {...defaultProps} onMenuItemClick={onMenuItemClick} />);
        fireEvent.click(screen.getByTestId('ctx-view-address'));
        expect(onMenuItemClick).toHaveBeenCalledWith('view_address', VALID, undefined);
    });
});
