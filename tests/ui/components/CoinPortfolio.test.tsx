import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import CoinPortfolio from '../../../src/ui/components/CoinPortfolio';
import { usePortfolioCoins } from '../../../src/store/selectors';
import { useWalletData } from '../../../src/ui/pages/Home/WalletProvider';

jest.mock('../../../src/store/selectors', () => ({
    usePortfolioCoins: jest.fn(),
}));

jest.mock('../../../src/ui/pages/Home/WalletProvider', () => ({
    useWalletData: jest.fn(),
}));

jest.mock('../../../src/ui/components/CoinCard', () => {
    const React = require('react');
    function Placeholder() {
        return React.createElement('div', { 'data-testid': 'coin-portfolio-placeholder' });
    }
    function CoinCardMock(props) {
        const { data, onPress, isAAWallet } = props;
        return React.createElement(
            'button',
            {
                type: 'button',
                'data-testid': `coin-card-${data.id}`,
                'data-aa-wallet': String(isAAWallet),
                onClick: onPress,
            },
            data.symbol,
        );
    }
    return { __esModule: true, default: CoinCardMock, Placeholder };
});

describe('CoinPortfolio', () => {
    const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

    /** Patches scroll metrics in layout phase before CoinPortfolio useEffect walks ancestors. */
    function ScrollHarness({ children }: { children: React.ReactNode }) {
        const scrollRef = React.useRef<HTMLDivElement>(null);

        React.useLayoutEffect(() => {
            const el = scrollRef.current;
            if (!el) return;
            Object.defineProperty(el, 'scrollHeight', { value: 400, configurable: true });
            Object.defineProperty(el, 'clientHeight', { value: 40, configurable: true });
        }, []);

        return (
            <div ref={scrollRef} data-testid="scroll-parent" style={{ height: 40, overflowY: 'auto' }}>
                <div style={{ minHeight: 200 }}>{children}</div>
            </div>
        );
    }

    function coinFixture(overrides = {}) {
        return {
            wallet_address: walletAddress,
            wallet_name: '',
            token_id: '',
            token_address: '0xtoken',
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
            id: 'coin-1',
            name: '',
            type: 'coin',
            total: 0,
            totalUSD: 0,
            color: '',
            coin_balance: 10,
            coin_price: 3,
            ...overrides,
        };
    }

    function setupWalletContext(overrides: Partial<ReturnType<typeof useWalletData>> = {}) {
        const setShowAllCoins = jest.fn();
        jest.mocked(useWalletData).mockReturnValue({
            showAllCoins: false,
            setShowAllCoins,
            onShowMoreCoins: jest.fn(),
            onShowLessCoins: jest.fn(),
            filteredCoins: [],
            hasHiddenCoins: false,
            ...overrides,
        } as ReturnType<typeof useWalletData>);
        return { setShowAllCoins };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders loading placeholders while portfolio list is empty', () => {
        jest.mocked(usePortfolioCoins).mockReturnValue([]);
        setupWalletContext({});

        render(<CoinPortfolio walletAddress={walletAddress} onCoinPress={jest.fn()} />);

        expect(screen.getAllByTestId('coin-portfolio-placeholder')).toHaveLength(5);
    });

    it('renders empty state when not loading and there are no filtered coins', () => {
        jest.mocked(usePortfolioCoins).mockReturnValue([coinFixture()]);
        setupWalletContext({ filteredCoins: [] });

        render(<CoinPortfolio walletAddress={walletAddress} onCoinPress={jest.fn()} />);

        expect(screen.getByText('There are no coins.')).toBeInTheDocument();
    });

    it('renders a coin row per filtered coin and forwards isAAWallet to the card', () => {
        const a = coinFixture({ id: 'a', symbol: 'AAA' });
        const b = coinFixture({ id: 'b', symbol: 'BBB' });
        jest.mocked(usePortfolioCoins).mockReturnValue([a, b]);
        setupWalletContext({ filteredCoins: [a, b] });

        render(
            <CoinPortfolio
                walletAddress={walletAddress}
                onCoinPress={jest.fn()}
                isAAWallet
            />,
        );

        expect(screen.getByTestId('coin-card-a')).toHaveAttribute('data-aa-wallet', 'true');
        expect(screen.getByTestId('coin-card-b')).toHaveAttribute('data-aa-wallet', 'true');
    });

    it('calls onCoinPress with the coin and isAAWallet when a row is pressed', () => {
        const onCoinPress = jest.fn();
        const coin = coinFixture({ id: 'press-me', symbol: 'PRS' });
        jest.mocked(usePortfolioCoins).mockReturnValue([coin]);
        setupWalletContext({ filteredCoins: [coin] });

        render(
            <CoinPortfolio
                walletAddress={walletAddress}
                onCoinPress={onCoinPress}
                isAAWallet={false}
            />,
        );

        fireEvent.click(screen.getByTestId('coin-card-press-me'));
        expect(onCoinPress).toHaveBeenCalledWith(coin, false);
    });

    it('shows Show All with hidden count and calls onShowMoreCoins', () => {
        const onShowMoreCoins = jest.fn();
        jest.mocked(usePortfolioCoins).mockReturnValue([
            coinFixture({ id: '1' }),
            coinFixture({ id: '2', is_hidden: true }),
        ]);
        setupWalletContext({
            filteredCoins: [coinFixture({ id: '1' })],
            hasHiddenCoins: true,
            onShowMoreCoins,
            showAllCoins: false,
        });

        render(<CoinPortfolio walletAddress={walletAddress} onCoinPress={jest.fn()} />);

        expect(screen.getByRole('button', { name: 'Show All (1 more)' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Show All (1 more)' }));
        expect(onShowMoreCoins).toHaveBeenCalled();
    });

    it('shows Show Less and calls onShowLessCoins when expanded', () => {
        const onShowLessCoins = jest.fn();
        jest.mocked(usePortfolioCoins).mockReturnValue([coinFixture({ id: '1' })]);
        setupWalletContext({
            filteredCoins: [coinFixture({ id: '1' })],
            hasHiddenCoins: true,
            showAllCoins: true,
            onShowLessCoins,
        });

        render(<CoinPortfolio walletAddress={walletAddress} onCoinPress={jest.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Show Less' }));
        expect(onShowLessCoins).toHaveBeenCalled();
    });

    it('does not render show more/less controls when hasHiddenCoins is false', () => {
        jest.mocked(usePortfolioCoins).mockReturnValue([coinFixture()]);
        setupWalletContext({
            filteredCoins: [coinFixture()],
            hasHiddenCoins: false,
        });

        render(<CoinPortfolio walletAddress={walletAddress} onCoinPress={jest.fn()} />);

        expect(screen.queryByRole('button', { name: /Show All/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Show Less' })).not.toBeInTheDocument();
    });

    it('collapses expanded list when scrollable ancestor is scrolled to top', () => {
        const setShowAllCoins = jest.fn();
        jest.mocked(usePortfolioCoins).mockReturnValue([coinFixture({ id: '1' })]);
        jest.mocked(useWalletData).mockReturnValue({
            showAllCoins: true,
            setShowAllCoins,
            onShowMoreCoins: jest.fn(),
            onShowLessCoins: jest.fn(),
            filteredCoins: [coinFixture({ id: '1' })],
            hasHiddenCoins: false,
        } as ReturnType<typeof useWalletData>);

        const gcs = jest.spyOn(window, 'getComputedStyle').mockImplementation(el => {
            if (el instanceof HTMLElement && el.getAttribute('data-testid') === 'scroll-parent') {
                return { overflowY: 'auto', overflow: '' } as CSSStyleDeclaration;
            }
            return { overflowY: 'visible', overflow: 'visible' } as CSSStyleDeclaration;
        });

        const view = render(
            <ScrollHarness>
                <CoinPortfolio walletAddress={walletAddress} onCoinPress={jest.fn()} />
            </ScrollHarness>,
        );

        try {
            const scrollParent = screen.getByTestId('scroll-parent');
            act(() => {
                scrollParent.scrollTop = 0;
                fireEvent.scroll(scrollParent);
            });
            expect(setShowAllCoins).toHaveBeenCalledWith(false);
        } finally {
            gcs.mockRestore();
            view.unmount();
        }
    });

    it('does not collapse when scroll position is not at top', () => {
        const setShowAllCoins = jest.fn();
        jest.mocked(usePortfolioCoins).mockReturnValue([coinFixture({ id: '1' })]);
        jest.mocked(useWalletData).mockReturnValue({
            showAllCoins: true,
            setShowAllCoins,
            onShowMoreCoins: jest.fn(),
            onShowLessCoins: jest.fn(),
            filteredCoins: [coinFixture({ id: '1' })],
            hasHiddenCoins: false,
        } as ReturnType<typeof useWalletData>);

        const gcs = jest.spyOn(window, 'getComputedStyle').mockImplementation(el => {
            if (el instanceof HTMLElement && el.getAttribute('data-testid') === 'scroll-parent') {
                return { overflowY: 'auto', overflow: '' } as CSSStyleDeclaration;
            }
            return { overflowY: 'visible', overflow: 'visible' } as CSSStyleDeclaration;
        });

        const view = render(
            <ScrollHarness>
                <CoinPortfolio walletAddress={walletAddress} onCoinPress={jest.fn()} />
            </ScrollHarness>,
        );

        try {
            const scrollParent = screen.getByTestId('scroll-parent');
            act(() => {
                scrollParent.scrollTop = 50;
                fireEvent.scroll(scrollParent);
            });
            expect(setShowAllCoins).not.toHaveBeenCalled();
        } finally {
            gcs.mockRestore();
            view.unmount();
        }
    });
});
