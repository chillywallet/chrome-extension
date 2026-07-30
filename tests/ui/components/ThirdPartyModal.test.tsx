import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ThirdPartyModal from '../../../src/ui/components/ThirdPartyModal';
import Toast from '../../../src/ui/components/Toast';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({
        visible,
        onClose,
        children,
    }: {
        visible: boolean;
        onClose: () => void;
        children: React.ReactNode;
    }) =>
        visible ? (
            <div data-testid="modal">
                <button onClick={onClose}>modal-close</button>
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => (
        <img data-testid="safe-image" data-src={src} alt={alt} />
    ),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn() },
}));

const mockUseActualTheme = jest.fn(() => 'light');
const mockUseSelectedNetwork = jest.fn(() => ({ explorer_url: 'https://explorer.test' }));
jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: () => mockUseActualTheme(),
    useSelectedNetwork: () => mockUseSelectedNetwork(),
}));
const showSuccess = (Toast as any).showSuccess as jest.Mock;

describe('ThirdPartyModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseActualTheme.mockImplementation(() => 'light');
        mockUseSelectedNetwork.mockImplementation(() => ({
            explorer_url: 'https://explorer.test',
        }));
        (global as any).platform = { openLink: jest.fn() };
        Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
    });

    it('does not render when not visible', () => {
        render(
            <ThirdPartyModal
                visible={false}
                onClose={jest.fn()}
                tokenSymbol="TKN"
                tokenAddress="0x1"
                spenderAddress="0x2"
            />,
        );
        expect(screen.queryByTestId('modal')).toBeNull();
    });

    it('renders token and spender details', () => {
        render(
            <ThirdPartyModal
                visible={true}
                onClose={jest.fn()}
                tokenSymbol="TKN"
                tokenAddress="0xtokenaddress"
                spenderAddress="0xspenderaddress"
            />,
        );
        expect(screen.getByText('TKN')).toBeInTheDocument();
        expect(screen.getByTestId('safe-image')).toBeInTheDocument();
    });

    it('copies tokenAddress on copy click and shows toast', () => {
        const { container } = render(
            <ThirdPartyModal
                visible={true}
                onClose={jest.fn()}
                tokenSymbol="TKN"
                tokenAddress="0xtoken"
                spenderAddress="0xspender"
            />,
        );
        const copyIcons = container.querySelectorAll('[data-tooltip-content="Copy to clipboard"]');
        fireEvent.click(copyIcons[0]);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0xtoken');
        expect(showSuccess).toHaveBeenCalledWith('Copied to clipboard');
    });

    it('opens explorer when external link icon is clicked', () => {
        const { container } = render(
            <ThirdPartyModal
                visible={true}
                onClose={jest.fn()}
                tokenSymbol="TKN"
                tokenAddress="0xtoken"
                spenderAddress="0xspender"
            />,
        );
        const links = container.querySelectorAll('[data-tooltip-content="Open in block explorer"]');
        fireEvent.click(links[0]);
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            'https://explorer.test/address/0xtoken',
            '_blank',
        );
    });

    it('Close button calls onClose', () => {
        const onClose = jest.fn();
        render(
            <ThirdPartyModal
                visible={true}
                onClose={onClose}
                tokenSymbol="TKN"
                tokenAddress="0x1"
                spenderAddress="0x2"
            />,
        );
        fireEvent.click(screen.getByText('Close'));
        expect(onClose).toHaveBeenCalled();
    });

    it('Modal onClose triggers parent onClose', () => {
        const onClose = jest.fn();
        render(
            <ThirdPartyModal
                visible={true}
                onClose={onClose}
                tokenSymbol="TKN"
                tokenAddress="0x1"
                spenderAddress="0x2"
            />,
        );
        fireEvent.click(screen.getByText('modal-close'));
        expect(onClose).toHaveBeenCalled();
    });

    it('copies spenderAddress on second copy click and shows toast', () => {
        const { container } = render(
            <ThirdPartyModal
                visible={true}
                onClose={jest.fn()}
                tokenSymbol="TKN"
                tokenAddress="0xtoken"
                spenderAddress="0xspender"
            />,
        );
        const copyIcons = container.querySelectorAll('[data-tooltip-content="Copy to clipboard"]');
        fireEvent.click(copyIcons[1]);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0xspender');
        expect(showSuccess).toHaveBeenCalledWith('Copied to clipboard');
    });

    it('opens explorer for spender when its external icon is clicked', () => {
        const { container } = render(
            <ThirdPartyModal
                visible={true}
                onClose={jest.fn()}
                tokenSymbol="TKN"
                tokenAddress="0xtoken"
                spenderAddress="0xspender"
            />,
        );
        const links = container.querySelectorAll('[data-tooltip-content="Open in block explorer"]');
        fireEvent.click(links[1]);
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            'https://explorer.test/address/0xspender',
            '_blank',
        );
    });

    it('does not copy token nor open explorer when address is empty', () => {
        const { container } = render(
            <ThirdPartyModal
                visible={true}
                onClose={jest.fn()}
                tokenSymbol="TKN"
                tokenAddress=""
                spenderAddress=""
            />,
        );
        const copyIcons = container.querySelectorAll('[data-tooltip-content="Copy to clipboard"]');
        const links = container.querySelectorAll('[data-tooltip-content="Open in block explorer"]');
        copyIcons.forEach((el: any) => fireEvent.click(el));
        links.forEach((el: any) => fireEvent.click(el));
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
        expect((global as any).platform.openLink).not.toHaveBeenCalled();
    });

    it('does not open explorer when selectedNetwork has no explorer_url', () => {
        mockUseSelectedNetwork.mockImplementation(() => ({}));
        const { container } = render(
            <ThirdPartyModal
                visible={true}
                onClose={jest.fn()}
                tokenSymbol="TKN"
                tokenAddress="0xtoken"
                spenderAddress="0xspender"
            />,
        );
        const links = container.querySelectorAll('[data-tooltip-content="Open in block explorer"]');
        links.forEach((el: any) => fireEvent.click(el));
        expect((global as any).platform.openLink).not.toHaveBeenCalled();
    });

    it('uses light tooltip variant in dark theme and falls back to Unknown symbol', () => {
        mockUseActualTheme.mockImplementation(() => 'dark');
        const { container } = render(
            <ThirdPartyModal
                visible={true}
                onClose={jest.fn()}
                tokenSymbol={undefined as any}
                tokenAddress="0xtoken"
                spenderAddress="0xspender"
            />,
        );
        expect(screen.getByText('Unknown')).toBeInTheDocument();
        // Dark theme -> tooltip variant is light
        const tooltipEls = container.querySelectorAll('[data-tooltip-variant="light"]');
        expect(tooltipEls.length).toBeGreaterThan(0);
    });
});
