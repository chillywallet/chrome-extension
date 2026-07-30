import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SwapCoinCard from '../../../src/ui/components/SwapCoinCard';

jest.mock('../../../src/ui/components/AssetLogo', () => ({
    __esModule: true,
    default: ({ src }: { src?: string }) => <div data-testid="asset-logo" data-src={src ?? ''} />,
}));

jest.mock('../../../src/lib/WalletUtils', () => ({
    __esModule: true,
    isNativeCoinByPlatformIdAndTokenAddress: (_platformId: number, addr: string) =>
        addr === '0xnative',
}));

const baseCoin: any = {
    name: 'Pepe',
    symbol: 'PEPE',
    logo: 'pepe.png',
    coinAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    platformId: 1,
    is_verified: true,
};

describe('SwapCoinCard', () => {
    beforeEach(() => {
        Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders coin name and symbol', () => {
        render(<SwapCoinCard data={baseCoin} onPress={jest.fn()} />);
        expect(screen.getByText('Pepe')).toBeInTheDocument();
        expect(screen.getByText('PEPE')).toBeInTheDocument();
    });

    it('renders Unknown when name missing', () => {
        render(<SwapCoinCard data={{ ...baseCoin, name: '' }} onPress={jest.fn()} />);
        expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders "---" symbol placeholder when symbol missing', () => {
        render(<SwapCoinCard data={{ ...baseCoin, symbol: '' }} onPress={jest.fn()} />);
        expect(screen.getByText('---')).toBeInTheDocument();
    });

    it('calls onPress when clicked', () => {
        const onPress = jest.fn();
        render(<SwapCoinCard data={baseCoin} onPress={onPress} />);
        fireEvent.click(screen.getByText('Pepe'));
        expect(onPress).toHaveBeenCalledWith(baseCoin);
    });

    it('uses icon when provided, else falls back to logo', () => {
        const { container, rerender } = render(
            <SwapCoinCard
                data={{ ...baseCoin, icon: 'icon.png' }}
                onPress={jest.fn()}
            />,
        );
        expect(container.querySelector('[data-testid="asset-logo"]')?.getAttribute('data-src')).toBe(
            'icon.png',
        );

        rerender(<SwapCoinCard data={baseCoin} onPress={jest.fn()} />);
        expect(container.querySelector('[data-testid="asset-logo"]')?.getAttribute('data-src')).toBe(
            'pepe.png',
        );
    });

    it('does not show verified badge when is_verified is false', () => {
        const { container } = render(
            <SwapCoinCard
                data={{ ...baseCoin, is_verified: false }}
                onPress={jest.fn()}
            />,
        );
        // The verified badge has the green background style
        const styled = container.querySelectorAll('[style*="rgb(23, 181, 105)"]');
        expect(styled.length).toBe(0);
    });

    it('handles invalid checksum address gracefully', () => {
        // Address with invalid checksum/chars triggers the catch branch
        const { container } = render(
            <SwapCoinCard
                data={{ ...baseCoin, coinAddress: 'invalid-address' }}
                onPress={jest.fn()}
            />,
        );
        // Still renders address-derived tooltip element since the catch returns the raw value
        expect(container.querySelector('[data-tooltip-id]')).not.toBeNull();
    });

    it('falls back gracefully when coinAddress is missing', () => {
        const { container } = render(
            <SwapCoinCard
                data={{ ...baseCoin, coinAddress: '' }}
                onPress={jest.fn()}
            />,
        );
        expect(container.querySelector('[data-tooltip-id]')).toBeNull();
    });

    it('copies address on tooltip click and resets tooltip after 2s', () => {
        jest.useFakeTimers();
        const { container } = render(<SwapCoinCard data={baseCoin} onPress={jest.fn()} />);
        const copyEl = container.querySelector('[data-tooltip-id]') as HTMLElement;
        expect(copyEl.getAttribute('data-tooltip-content')).toBe('Copy token address');
        fireEvent.click(copyEl);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        expect(copyEl.getAttribute('data-tooltip-content')).toBe('Copied');

        // Advance timers to cover the setTimeout reset on line 43
        act(() => {
            jest.advanceTimersByTime(2100);
        });
        expect(copyEl.getAttribute('data-tooltip-content')).toBe('Copy token address');
    });

    it('copies address on Enter/Space keydown (covers onKeyDown branches)', () => {
        const { container } = render(<SwapCoinCard data={baseCoin} onPress={jest.fn()} />);
        const copyEl = container.querySelector('[data-tooltip-id]') as HTMLElement;

        fireEvent.keyDown(copyEl, { key: 'Enter' });
        expect(navigator.clipboard.writeText).toHaveBeenCalled();

        // Re-render to reset call count effectively
        (navigator.clipboard.writeText as jest.Mock).mockClear();
        fireEvent.keyDown(copyEl, { key: ' ' });
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('ignores other keys in onKeyDown', () => {
        const { container } = render(<SwapCoinCard data={baseCoin} onPress={jest.fn()} />);
        const copyEl = container.querySelector('[data-tooltip-id]') as HTMLElement;
        fireEvent.keyDown(copyEl, { key: 'a' });
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('hides address for native token', () => {
        const { container } = render(
            <SwapCoinCard
                data={{ ...baseCoin, coinAddress: '0xnative' }}
                onPress={jest.fn()}
            />,
        );
        expect(container.querySelector('[data-tooltip-id]')).toBeNull();
    });

    it('falls back when coinAddress is null (covers ?? branch)', () => {
        const { container } = render(
            <SwapCoinCard
                data={{ ...baseCoin, coinAddress: null as any }}
                onPress={jest.fn()}
            />,
        );
        expect(container.querySelector('[data-tooltip-id]')).toBeNull();
    });

    it('renders with neither icon nor logo (covers ?? undefined branch on line 53)', () => {
        const { container } = render(
            <SwapCoinCard
                data={{ ...baseCoin, icon: null, logo: null } as any}
                onPress={jest.fn()}
            />,
        );
        expect(container.querySelector('[data-testid="asset-logo"]')?.getAttribute('data-src')).toBe(
            '',
        );
    });
});
