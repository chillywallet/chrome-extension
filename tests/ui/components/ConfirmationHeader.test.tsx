import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import ConfirmationHeader from '../../../src/ui/components/ConfirmationHeader';
import Toast from '../../../src/ui/components/Toast';

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: jest.fn(),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: jest.fn(),
    },
}));

const VALID_ADDR = '0x0000000000000000000000000000000000000000';
const VALID_TO = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

function mockActualTheme(theme: 'light' | 'dark') {
    const { useActualTheme } = jest.requireMock('../../../src/store/selectors');
    useActualTheme.mockReturnValue(theme);
}

describe('ConfirmationHeader', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockActualTheme('light');
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn(() => Promise.resolve()),
            },
        });
    });

    function copyTargets() {
        return document.querySelectorAll('[data-tooltip-content="Click to copy address"]');
    }

    it('renders from name and address with dark tooltip variant when theme is light', () => {
        render(
            <ConfirmationHeader
                from={{ name: 'Wallet A', address: VALID_ADDR, emoji: '🙂' }}
            />,
        );

        expect(screen.getByText('Wallet A')).toBeInTheDocument();
        expect(screen.getByText(VALID_ADDR)).toBeInTheDocument();
        expect(copyTargets()[0]).toHaveAttribute('data-tooltip-variant', 'dark');
    });

    it('uses light tooltip variant when theme is dark', () => {
        mockActualTheme('dark');

        render(<ConfirmationHeader from={{ address: VALID_ADDR }} />);

        expect(copyTargets()[0]).toHaveAttribute('data-tooltip-variant', 'light');
    });

    it('applies full-mode header styles by default', () => {
        const { container } = render(<ConfirmationHeader from={{ address: VALID_ADDR }} />);

        const root = container.firstChild as HTMLElement;
        expect(root.className).toContain('border-b');
        expect(root.className).toContain('bg-slate-50');
        expect(root.className).not.toContain('rounded-md');
    });

    it('applies padding-mode header styles', () => {
        const { container } = render(
            <ConfirmationHeader from={{ address: VALID_ADDR }} mode="padding" />,
        );

        const root = container.firstChild as HTMLElement;
        expect(root.className).toContain('rounded-xl');
        expect(root.className).toContain('border ');
        expect(root.className).toContain('bg-white');
    });

    it('merges custom className onto the root', () => {
        const { container } = render(
            <ConfirmationHeader from={{ address: VALID_ADDR }} className="extra-class" />,
        );

        expect((container.firstChild as HTMLElement).className).toContain('extra-class');
    });

    it('does not render destination column when to is omitted', () => {
        render(<ConfirmationHeader from={{ address: VALID_ADDR }} />);

        expect(copyTargets()).toHaveLength(1);
    });

    it('renders arrow and destination account when to is provided', () => {
        render(
            <ConfirmationHeader
                from={{ address: VALID_ADDR, name: 'From' }}
                to={{ address: VALID_TO, name: 'To', emoji: '🎉' }}
            />,
        );

        expect(screen.getByText('From')).toBeInTheDocument();
        expect(screen.getByText('To')).toBeInTheDocument();
        expect(copyTargets()).toHaveLength(2);
        expect(screen.getByText(VALID_TO)).toBeInTheDocument();
    });

    it('skips destination EmojiView when to has no emoji and no address', () => {
        const { container } = render(
            <ConfirmationHeader
                from={{ address: VALID_ADDR }}
                to={{ name: 'Named only' }}
            />,
        );

        expect(screen.getByText('Named only')).toBeInTheDocument();
        expect(container.querySelectorAll('.rounded-full').length).toBe(1);
    });

    it('falls back to raw from address when checksum fails', () => {
        render(<ConfirmationHeader from={{ address: 'not-a-valid-address' }} />);

        expect(screen.getByText('not-a-valid-address')).toBeInTheDocument();
    });

    it('checksum fallback uses empty string when from.address is missing', () => {
        render(<ConfirmationHeader from={{ name: 'No chain address' }} />);

        expect(screen.getByText('No chain address')).toBeInTheDocument();
        expect(copyTargets()).toHaveLength(1);
    });

    it('falls back to raw to address when checksum fails', () => {
        render(
            <ConfirmationHeader
                from={{ address: VALID_ADDR }}
                to={{ address: 'bad-recipient' }}
            />,
        );

        expect(screen.getByText('bad-recipient')).toBeInTheDocument();
    });

    it('checksum fallback uses empty string when to.address is missing', () => {
        render(
            <ConfirmationHeader
                from={{ address: VALID_ADDR }}
                to={{ name: 'Recipient', emoji: '🎯' }}
            />,
        );

        expect(screen.getByText('Recipient')).toBeInTheDocument();
        expect(copyTargets()).toHaveLength(2);
    });

    it('copies from checksum and shows toast when address row is clicked', () => {
        render(<ConfirmationHeader from={{ address: VALID_ADDR }} />);

        fireEvent.click(copyTargets()[0]);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(VALID_ADDR);
        expect(Toast.showSuccess).toHaveBeenCalledWith('Address copied to clipboard');
    });

    it('copies destination checksum when destination address row is clicked', () => {
        render(
            <ConfirmationHeader from={{ address: VALID_ADDR }} to={{ address: VALID_TO }} />,
        );

        const targets = copyTargets();
        fireEvent.click(targets[targets.length - 1]);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(VALID_TO);
        expect(Toast.showSuccess).toHaveBeenCalledWith('Address copied to clipboard');
    });
});
