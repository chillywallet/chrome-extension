import React from 'react';
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';

import CoinSelectorCard, { Placeholder } from '../../../src/ui/components/CoinSelectorCard';
import { isNativeCoinByPlatformIdAndTokenAddress } from '../../../src/lib/WalletUtils';
import type { PlatformCoin } from '../../../src/shared/types/Wallet';

jest.mock('../../../src/shared/utils/format', () => ({
    ...jest.requireActual('../../../src/shared/utils/format'),
    formatMoney: (n: number) => `$${Number(n).toFixed(2)}`,
}));

jest.mock('../../../src/lib/WalletUtils', () => ({
    isNativeCoinByPlatformIdAndTokenAddress: jest.fn(() => false),
}));

jest.mock('../../../src/ui/components/AssetLogo', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: (props: { src?: string }) =>
            React.createElement('img', { alt: '', src: props.src, 'data-testid': 'asset-logo-img' }),
    };
});

describe('Placeholder', () => {
    it('renders skeleton layout', () => {
        render(<Placeholder />);
        expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
});

describe('CoinSelectorCard', () => {
    function platformCoinFixture(overrides: Partial<PlatformCoin> = {}): PlatformCoin {
        return {
            id: 1,
            name: 'Test Coin',
            symbol: 'TEST',
            logo: 'https://ex/logo.png',
            logo_lrg: '',
            platformId: 1,
            rank: 42,
            coinId: 'hid',
            coinAddress: '0xABCDEF1234567890abcdef1234567890ABCDEF12',
            is_verified: true,
            latest: { price: 1.23, percent_change_24h: 5.5 },
            ...overrides,
        };
    }

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        jest.mocked(isNativeCoinByPlatformIdAndTokenAddress).mockReturnValue(false);
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn(() => Promise.resolve()),
            },
        });
    });

    afterEach(() => {
        act(() => {
            jest.runOnlyPendingTimers();
        });
        jest.useRealTimers();
        cleanup();
    });

    it('renders name, symbol, rank, and formatted price', () => {
        render(<CoinSelectorCard data={platformCoinFixture()} onPress={jest.fn()} />);
        expect(screen.getByText('Test Coin')).toBeInTheDocument();
        expect(screen.getByText('#42')).toBeInTheDocument();
        expect(screen.getByText('TEST')).toBeInTheDocument();
        expect(screen.getByText('$1.23')).toBeInTheDocument();
    });

    it('shows positive 24h change with percent label', () => {
        render(<CoinSelectorCard data={platformCoinFixture()} onPress={jest.fn()} />);
        expect(screen.getByText('5.50%')).toBeInTheDocument();
    });

    it('shows negative 24h change and uses red styling for percent', () => {
        render(
            <CoinSelectorCard
                data={platformCoinFixture({ latest: { price: 2, percent_change_24h: -3.25 } })}
                onPress={jest.fn()}
            />,
        );
        const pct = screen.getByText('3.25%');
        expect(pct).toBeInTheDocument();
        expect(pct.className).toContain('text-red-500');
    });

    it('omits percent row when 24h change is zero', () => {
        render(
            <CoinSelectorCard
                data={platformCoinFixture({ latest: { price: 9, percent_change_24h: 0 } })}
                onPress={jest.fn()}
            />,
        );
        expect(screen.queryByText(/0\.00%/)).not.toBeInTheDocument();
    });

    it('uses default price and change when latest is missing', () => {
        render(
            <CoinSelectorCard
                data={{ ...platformCoinFixture(), latest: undefined as unknown as PlatformCoin['latest'] }}
                onPress={jest.fn()}
            />,
        );
        expect(screen.getByText('$0.00')).toBeInTheDocument();
        expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('treats missing price in latest as zero for display', () => {
        render(
            <CoinSelectorCard
                data={
                    {
                        ...platformCoinFixture(),
                        latest: { percent_change_24h: 0 } as PlatformCoin['latest'],
                    }
                }
                onPress={jest.fn()}
            />,
        );
        expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('hides price column on testnet', () => {
        render(<CoinSelectorCard data={platformCoinFixture()} onPress={jest.fn()} testnet />);
        expect(screen.queryByText('$1.23')).not.toBeInTheDocument();
        expect(screen.queryByText('5.50%')).not.toBeInTheDocument();
    });

    it('calls onPress with coin data and preventDefault on main click', () => {
        const onPress = jest.fn();
        const data = platformCoinFixture();
        render(<CoinSelectorCard data={data} onPress={onPress} />);
        const btn = screen.getByRole('button', { name: /test coin/i });
        const ev = createEvent.click(btn, { bubbles: true, cancelable: true });
        const pd = jest.spyOn(ev, 'preventDefault');
        fireEvent(btn, ev);
        expect(pd).toHaveBeenCalled();
        expect(onPress).toHaveBeenCalledWith(data);
    });

    it('prefers icon over logo for AssetLogo', () => {
        render(
            <CoinSelectorCard
                data={platformCoinFixture({
                    icon: 'https://ex/icon.png',
                    logo: 'https://ex/logo.png',
                })}
                onPress={jest.fn()}
            />,
        );
        expect(screen.getByTestId('asset-logo-img')).toHaveAttribute('src', 'https://ex/icon.png');
    });

    it('passes undefined src to AssetLogo when icon and logo are nullish', () => {
        render(
            <CoinSelectorCard
                data={
                    platformCoinFixture({
                        icon: undefined,
                        logo: null as unknown as string,
                    })
                }
                onPress={jest.fn()}
            />,
        );
        expect(screen.getByTestId('asset-logo-img')).not.toHaveAttribute('src');
    });

    it('uses logo for AssetLogo when icon is omitted', () => {
        render(
            <CoinSelectorCard
                data={platformCoinFixture({ icon: undefined, logo: 'https://ex/only-logo.png' })}
                onPress={jest.fn()}
            />,
        );
        expect(screen.getByTestId('asset-logo-img')).toHaveAttribute('src', 'https://ex/only-logo.png');
    });

    it('renders verified badge only when is_verified is true', () => {
        const { container, rerender } = render(
            <CoinSelectorCard data={platformCoinFixture({ is_verified: true })} onPress={jest.fn()} />,
        );
        let badge = container.querySelector('[style*="rgb(23, 181, 105)"]');
        expect(badge).toBeTruthy();

        rerender(<CoinSelectorCard data={platformCoinFixture({ is_verified: false })} onPress={jest.fn()} />);
        badge = container.querySelector('[style*="rgb(23, 181, 105)"]');
        expect(badge).toBeNull();

        rerender(<CoinSelectorCard data={platformCoinFixture({ is_verified: null })} onPress={jest.fn()} />);
        expect(container.querySelector('[style*="rgb(23, 181, 105)"]')).toBeNull();
    });

    it('omits rank when rank is zero', () => {
        render(<CoinSelectorCard data={platformCoinFixture({ rank: 0 })} onPress={jest.fn()} />);
        expect(screen.queryByText('#0')).not.toBeInTheDocument();
    });

    it('does not render token address copy for native coins', () => {
        jest.mocked(isNativeCoinByPlatformIdAndTokenAddress).mockReturnValue(true);
        render(<CoinSelectorCard data={platformCoinFixture()} onPress={jest.fn()} />);
        expect(
            document.querySelector('[data-tooltip-content="Copy token address"]'),
        ).not.toBeInTheDocument();
    });

    it('does not render copy when coinAddress is empty', () => {
        render(<CoinSelectorCard data={platformCoinFixture({ coinAddress: '' })} onPress={jest.fn()} />);
        expect(
            document.querySelector('[data-tooltip-content="Copy token address"]'),
        ).not.toBeInTheDocument();
    });

    it('copies checksum address and toggles tooltip text', () => {
        render(<CoinSelectorCard data={platformCoinFixture()} onPress={jest.fn()} />);
        const copyEl = document.querySelector('[data-tooltip-content="Copy token address"]') as HTMLElement;
        expect(copyEl).toBeTruthy();
        fireEvent.click(copyEl);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            '0xABCDEF1234567890abcdef1234567890ABCDEF12',
        );
        expect(copyEl).toHaveAttribute('data-tooltip-content', 'Copied');
        act(() => {
            jest.advanceTimersByTime(2000);
        });
        expect(copyEl).toHaveAttribute('data-tooltip-content', 'Copy token address');
    });

    it('copy click stops propagation so row onPress is not invoked', () => {
        const onPress = jest.fn();
        render(<CoinSelectorCard data={platformCoinFixture()} onPress={onPress} />);
        const copyEl = document.querySelector('[data-tooltip-content="Copy token address"]') as HTMLElement;
        fireEvent.click(copyEl);
        expect(onPress).not.toHaveBeenCalled();
    });

    it('fires copy on Enter and Space on the copy control', () => {
        render(<CoinSelectorCard data={platformCoinFixture()} onPress={jest.fn()} />);
        const copyEl = document.querySelector('[data-tooltip-content="Copy token address"]') as HTMLElement;
        fireEvent.keyDown(copyEl, { key: 'Enter' });
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        jest.mocked(navigator.clipboard.writeText).mockClear();
        fireEvent.keyDown(copyEl, { key: ' ' });
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('does not copy when an unrelated key is pressed on the copy control', () => {
        render(<CoinSelectorCard data={platformCoinFixture()} onPress={jest.fn()} />);
        const copyEl = document.querySelector('[data-tooltip-content="Copy token address"]') as HTMLElement;
        fireEvent.keyDown(copyEl, { key: 'Tab' });
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('displays truncated address for invalid checksum input', () => {
        render(
            <CoinSelectorCard
                data={platformCoinFixture({ coinAddress: 'not-a-valid-address' })}
                onPress={jest.fn()}
            />,
        );
        expect(screen.getByText(/not-a-.*ress/)).toBeInTheDocument();
    });
});
