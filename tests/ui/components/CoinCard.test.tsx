import React from 'react';
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';

import CoinCard, { Placeholder } from '../../../src/ui/components/CoinCard';
import type { Coin } from '../../../src/shared/types/Wallet';
import EventType from '../../../src/shared/types/EventType';
import eventManager from '../../../src/shared/utils/eventManager';
import {
    useActualTheme,
    useGaslessTokens,
    useIsTestnet,
} from '../../../src/store/selectors';

jest.mock('../../../src/shared/utils/format', () => ({
    ...jest.requireActual('../../../src/shared/utils/format'),
    formatMoney: n => `$${Number(n).toFixed(2)}`,
    formatNumber: n => String(n),
}));

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: jest.fn(),
    useGaslessTokens: jest.fn(),
    useIsTestnet: jest.fn(),
}));

jest.mock('../../../src/ui/components/AssetLogo', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: props =>
            React.createElement('img', { alt: '', src: props.src, 'data-testid': 'asset-logo-img' }),
    };
});

jest.mock('../../../src/ui/components/CoinMenu', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: props =>
            React.createElement('div', {
                'data-testid': 'coin-menu-mock',
                'data-coin-menu-is-hidden': props.isHidden,
            }),
    };
});

describe('Placeholder', () => {
    it('renders skeleton layout', () => {
        render(<Placeholder />);
        expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
});

describe('CoinCard', () => {
    const defaultOnPress = jest.fn();

    function coinFixture(overrides: Partial<Coin> = {}): Coin {
        return {
            wallet_address: '0xABCDEF1234567890abcdef1234567890ABCDEF12',
            wallet_name: '',
            token_id: '',
            token_address: '0xtokenABCDEF',
            balance: 0,
            balance_usd: 0,
            platform_id: 7,
            integration_type: '',
            avatar: null,
            coin_name: 'Moon Token',
            logo: '',
            symbol: 'MOON',
            is_custom: false,
            is_hidden: false,
            is_verified: true,
            id: '',
            name: '',
            type: 'coin',
            total: 0,
            totalUSD: 0,
            color: '',
            coin_balance: 10,
            coin_price: 3,
            ...overrides,
        } as Coin;
    }

    function setupMocks() {
        jest.mocked(useActualTheme).mockReturnValue('light');
        jest.mocked(useGaslessTokens).mockReturnValue([]);
        jest.mocked(useIsTestnet).mockReturnValue(false);
    }

    beforeEach(() => {
        jest.clearAllMocks();
        eventManager.list.clear();
        setupMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('renders name, symbol, balance line, and fiat when data is resolved', () => {
        render(
            <CoinCard type="portfolio" data={coinFixture()} onPress={defaultOnPress} />,
        );
        expect(screen.getByText('Moon Token')).toBeInTheDocument();
        expect(screen.getByText('MOON')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('$30.00')).toBeInTheDocument();
    });

    it('falls back to Unknown and --- when name or symbol missing', () => {
        render(
            <CoinCard
                type="portfolio"
                data={coinFixture({ coin_name: '', symbol: '' })}
                onPress={defaultOnPress}
            />,
        );
        expect(screen.getByText('Unknown')).toBeInTheDocument();
        expect(screen.getByText('---')).toBeInTheDocument();
    });

    it('calls onPress with coin data and prevents default click', () => {
        const onPress = jest.fn();
        const data = coinFixture();
        render(<CoinCard type="portfolio" data={data} onPress={onPress} />);
        const btn = screen.getByRole('button', { name: /moon token/i });
        const ev = createEvent.click(btn, { bubbles: true, cancelable: true });
        const pd = jest.spyOn(ev, 'preventDefault');
        fireEvent(btn, ev);
        expect(pd).toHaveBeenCalled();
        expect(onPress).toHaveBeenCalledWith(data);
    });

    it('uses icon over logo for AssetLogo when icon is present', () => {
        render(
            <CoinCard
                type="portfolio"
                data={coinFixture({ icon: 'https://ex/icon.png', logo: 'https://ex/logo.png' })}
                onPress={defaultOnPress}
            />,
        );
        expect(screen.getByTestId('asset-logo-img')).toHaveAttribute(
            'src',
            'https://ex/icon.png',
        );
    });

    it('shows loading placeholders only when balance is unknown and menu is visible', () => {
        render(
            <CoinCard type="portfolio" data={coinFixture({ coin_balance: -1 })} onPress={defaultOnPress} />,
        );
        expect(screen.getByText('MOON')).toBeInTheDocument();
        expect(document.querySelectorAll('.animate-pulse.bg-placeholder').length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText('-1')).not.toBeInTheDocument();
    });

    it('hides fiat and balance skeletons while loading when showMenu is false', () => {
        render(
            <CoinCard
                type="portfolio"
                data={coinFixture({ coin_balance: -1 })}
                onPress={defaultOnPress}
                showMenu={false}
            />,
        );
        expect(document.querySelectorAll('.animate-pulse.bg-placeholder').length).toBe(0);
    });

    it('omits CoinMenu when showMenu is false', () => {
        render(<CoinCard type="portfolio" data={coinFixture()} onPress={defaultOnPress} showMenu={false} />);
        expect(screen.queryByTestId('coin-menu-mock')).toBeNull();
    });

    it('hides fiat line on testnets', () => {
        jest.mocked(useIsTestnet).mockReturnValue(true);
        render(<CoinCard type="portfolio" data={coinFixture()} onPress={defaultOnPress} />);
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.queryByText('$30.00')).toBeNull();
    });



    it('does not show gasless tooltip for AA wallets', () => {
        jest.mocked(useGaslessTokens).mockReturnValue([{ address: '0xtokenabcdef' }] as never);
        render(<CoinCard type="portfolio" data={coinFixture()} onPress={defaultOnPress} isAAWallet={true} />);
        expect(document.querySelector('[data-tooltip-html*="network fees"]')).toBeNull();
    });

    it('applies the shared hover class on the row for both variants', () => {
        const { rerender, container } = render(
            <CoinCard type="portfolio" data={coinFixture()} onPress={defaultOnPress} />,
        );
        expect((container.firstChild as HTMLElement).className).toContain(
            'dark:hover:bg-white/[0.04]',
        );

        rerender(<CoinCard type="send" data={coinFixture()} onPress={defaultOnPress} />);
        expect((container.firstChild as HTMLElement).className).toContain(
            'dark:hover:bg-white/[0.04]',
        );
    });

    it('renders hidden-token badge styling', () => {
        const { container } = render(
            <CoinCard
                type="portfolio"
                data={coinFixture({
                    is_hidden: true,
                    is_custom: true,
                    is_verified: false,
                })}
                onPress={defaultOnPress}
            />,
        );
        const badge = container.querySelector('.rounded-full.flex.items-center');
        expect(badge).toHaveStyle({ backgroundColor: '#4AA8DC' });
    });

    it('prefers hidden badge colors in dark theme', () => {
        jest.mocked(useActualTheme).mockReturnValue('dark');
        const { container } = render(
            <CoinCard type="portfolio" data={coinFixture({ is_hidden: true })} onPress={defaultOnPress} />,
        );
        const badge = container.querySelector('.rounded-full.flex.items-center');
        expect(badge).toHaveStyle({ backgroundColor: '#69C4EE' });
    });

    it('renders custom-token badge color in light theme', () => {
        const { container } = render(
            <CoinCard
                type="portfolio"
                data={coinFixture({
                    is_hidden: false,
                    is_custom: true,
                    is_verified: false,
                })}
                onPress={defaultOnPress}
            />,
        );
        const badge = container.querySelector('.rounded-full.flex.items-center');
        expect(badge).toHaveStyle({ backgroundColor: '#d8ae27' });
    });

    it('renders verified check badge color', () => {
        const { container } = render(
            <CoinCard
                type="portfolio"
                data={coinFixture({ is_hidden: false, is_custom: false, is_verified: true })}
                onPress={defaultOnPress}
            />,
        );
        const badge = container.querySelector('.rounded-full.flex.items-center');
        expect(badge).toHaveStyle({ backgroundColor: '#17B569' });
    });

    it('renders no badge when hidden, custom, and verified are all inactive', () => {
        const { container } = render(
            <CoinCard
                type="portfolio"
                data={coinFixture({
                    is_hidden: false,
                    is_custom: false,
                    is_verified: false,
                })}
                onPress={defaultOnPress}
            />,
        );
        expect(container.querySelector('[class*="top-0.5"][class*="right-0.5"]')).toBeNull();
    });

    it('uses dark-theme fill for custom token badge', () => {
        jest.mocked(useActualTheme).mockReturnValue('dark');
        const { container } = render(
            <CoinCard
                type="portfolio"
                data={coinFixture({
                    is_hidden: false,
                    is_custom: true,
                    is_verified: false,
                })}
                onPress={defaultOnPress}
            />,
        );
        const badge = container.querySelector('.rounded-full.flex.items-center');
        expect(badge).toHaveStyle({ backgroundColor: '#F0B90B' });
    });

    it('passes isHidden=true to CoinMenu when unverified, non-custom, and visibility is ambiguous', () => {
        render(
            <CoinCard
                type="portfolio"
                data={coinFixture({
                    is_verified: false,
                    is_custom: false,
                    is_hidden: null as never,
                })}
                onPress={defaultOnPress}
            />,
        );
        expect(screen.getByTestId('coin-menu-mock')).toHaveAttribute('data-coin-menu-is-hidden', 'true');
    });

    it('passes isHidden=false to CoinMenu for verified holdings', () => {
        render(
            <CoinCard type="portfolio" data={coinFixture({ is_verified: true })} onPress={defaultOnPress} />,
        );
        expect(screen.getByTestId('coin-menu-mock')).toHaveAttribute('data-coin-menu-is-hidden', 'false');
    });

    it('updates balance when REFRESH_WALLET_COIN_BALANCE matches wallet and token', async () => {
        const data = coinFixture({
            wallet_address: '0xAaAa',
            token_address: '0xBbBb',
            platform_id: 99,
            coin_balance: 1,
            coin_price: 1,
        });
        render(<CoinCard type="portfolio" data={data} onPress={defaultOnPress} />);
        eventManager.emit(
            EventType.REFRESH_WALLET_COIN_BALANCE,
            42,
            99,
            '0xaaaa',
            '0xbbbb',
        );
        await waitFor(() => {
            expect(screen.getByText('42')).toBeInTheDocument();
        });
    });

    it('ignores REFRESH_WALLET_COIN_BALANCE when token does not match', async () => {
        const data = coinFixture({
            wallet_address: '0xAaAa',
            token_address: '0xBbBb',
            platform_id: 99,
            coin_balance: 1,
        });
        render(<CoinCard type="portfolio" data={data} onPress={defaultOnPress} />);
        eventManager.emit(
            EventType.REFRESH_WALLET_COIN_BALANCE,
            999,
            99,
            '0xaaaa',
            '0xOTHER',
        );
        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });
        expect(screen.queryByText('999')).not.toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('updates fiat when REFRESH_WALLET_COIN_PRICE matches', async () => {
        const data = coinFixture({
            wallet_address: '0xAaAa',
            token_address: '0xBbBb',
            platform_id: 101,
            coin_balance: 2,
            coin_price: 1,
        });
        render(<CoinCard type="portfolio" data={data} onPress={defaultOnPress} />);
        eventManager.emit(
            EventType.REFRESH_WALLET_COIN_PRICE,
            10,
            101,
            '0xBBBB',
            '0xAAAA',
        );
        await waitFor(() => {
            expect(screen.getByText('$20.00')).toBeInTheDocument();
        });
    });

    it('syncs local balance when props data.coin_balance changes', () => {
        const { rerender } = render(
            <CoinCard type="portfolio" data={coinFixture({ coin_balance: 5 })} onPress={defaultOnPress} />,
        );
        expect(screen.getByText('5')).toBeInTheDocument();
        rerender(
            <CoinCard type="portfolio" data={coinFixture({ coin_balance: 6 })} onPress={defaultOnPress} />,
        );
        expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('syncs fiat when props data.coin_price changes', () => {
        const { rerender } = render(
            <CoinCard
                type="portfolio"
                data={coinFixture({ coin_balance: 1, coin_price: 5 })}
                onPress={defaultOnPress}
            />,
        );
        expect(screen.getByText('$5.00')).toBeInTheDocument();
        rerender(
            <CoinCard
                type="portfolio"
                data={coinFixture({ coin_balance: 1, coin_price: 7 })}
                onPress={defaultOnPress}
            />,
        );
        expect(screen.getByText('$7.00')).toBeInTheDocument();
    });

    it('uses default type when prop omitted (portfolio fallback)', () => {
        render(
            // @ts-expect-error intentionally omit the `type` prop to hit the default
            <CoinCard data={coinFixture()} onPress={defaultOnPress} />,
        );
        expect(screen.getByText('Moon Token')).toBeInTheDocument();
    });

    it('falls back via ?? when coin_balance is undefined', () => {
        render(
            <CoinCard
                type="portfolio"
                data={coinFixture({ coin_balance: undefined as any, coin_price: undefined as any })}
                onPress={defaultOnPress}
            />,
        );
        expect(screen.getByText('Moon Token')).toBeInTheDocument();
    });

    it('renders without an icon source when both icon and logo are missing', () => {
        render(
            <CoinCard
                type="portfolio"
                data={coinFixture({ logo: undefined as any })}
                onPress={defaultOnPress}
            />,
        );
        const img = screen.getByTestId('asset-logo-img');
        expect(img.getAttribute('src')).toBeFalsy();
    });

    it('updates local balance via REFRESH when incoming data.coin_balance becomes undefined', () => {
        const { rerender } = render(
            <CoinCard type="portfolio" data={coinFixture({ coin_balance: 5 })} onPress={defaultOnPress} />,
        );
        rerender(
            <CoinCard
                type="portfolio"
                data={coinFixture({ coin_balance: undefined as any })}
                onPress={defaultOnPress}
            />,
        );
        expect(screen.getByText('Moon Token')).toBeInTheDocument();
    });

    it('updates local price when incoming data.coin_price becomes undefined', () => {
        const { rerender } = render(
            <CoinCard type="portfolio" data={coinFixture({ coin_price: 5 })} onPress={defaultOnPress} />,
        );
        rerender(
            <CoinCard
                type="portfolio"
                data={coinFixture({ coin_price: undefined as any })}
                onPress={defaultOnPress}
            />,
        );
        expect(screen.getByText('Moon Token')).toBeInTheDocument();
    });
});
