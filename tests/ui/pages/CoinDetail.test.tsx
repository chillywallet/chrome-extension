import { configureStore } from '@reduxjs/toolkit';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';

import { MarketRequest } from '../../../src/api/graphQL';
import { DEFAULT_ROUTE } from '../../../src/shared/constants/routes';
import type { MarketCoinPrice } from '../../../src/shared/types/Wallet';
import CoinDetail from '../../../src/ui/pages/CoinDetail';
import type { RoutesContextType } from '../../../src/ui/pages/RoutesProvider';
import { RoutesContext } from '../../../src/ui/pages/RoutesProvider';

import { buildHomeReduxState, defaultRoutesValue } from './Home/fixtures/homeHarness';

import Toast from '../../../src/ui/components/Toast';

const SET_FAVORITES = 'test/setFavoriteCoins';

jest.mock('../../../src/store/actions/uiActions', () => {
    const actual = jest.requireActual('../../../src/store/actions/uiActions');
    return {
        ...actual,
        setFavoriteCoins:
            (favoriteCoins: unknown[]) =>
            async (dispatch: (a: { type: string; payload: unknown }) => void) => {
                dispatch({ type: SET_FAVORITES, payload: favoriteCoins });
            },
    };
});

const mockExtractColorResult: { darkerColor?: string } = { darkerColor: '#112233' };

jest.mock('react-extract-colors', () => ({
    useExtractColor: () => mockExtractColorResult,
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: jest.fn(),
    },
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) => (
        <div>
            <div data-testid="header-title">{title}</div>
            {action}
        </div>
    ),
}));

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} data-testid="safe-img" />,
}));

jest.mock('../../../src/ui/components/PriceChart', () => ({
    __esModule: true,
    default: ({ data }: { data: number[] }) => (
        <div data-testid="chilly-chart">chart-points:{data.length}</div>
    ),
    PriceChartPlaceholder: () => <div data-testid="chart-placeholder" />,
}));

function defaultLatest(): MarketCoinPrice['latest'] {
    return {
        price: 50000,
        fully_diluted_market_cap: 1_000_000,
        percent_change_7d: 0,
        percent_change_24h: 0,
        percent_change_30d: 0,
        volume_24h: 0,
    };
}

function buildMockMarketCoin(overrides: Partial<MarketCoinPrice> = {}): MarketCoinPrice {
    const { latest: latestOverrides, ...rest } = overrides;
    return {
        id: 1,
        description: 'desc',
        coinId: 'chilly-btc',
        latest: { ...defaultLatest(), ...latestOverrides },
        logo: 'https://logo.test/btc.png',
        logo_lrg: '',
        max_supply: 21_000_000,
        name: 'Bitcoin',
        platformId: 1,
        rank: 1,
        symbol: 'BTC',
        ...rest,
        latest: { ...defaultLatest(), ...latestOverrides },
    };
}

function chartApiResult(points: { price: number; last_updated: string }[]) {
    return Promise.resolve({
        data: {
            quotes: [{ quotes: points }],
        },
    } as Awaited<ReturnType<typeof MarketRequest.getCoinChartData>>);
}

function favoritesReducer(state: ReturnType<typeof buildHomeReduxState>, action: { type: string; payload?: unknown }) {
    if (action.type === SET_FAVORITES && Array.isArray(action.payload)) {
        return {
            ...state,
            globalState: {
                ...state.globalState,
                preferences: {
                    ...state.globalState.preferences,
                    favoriteCoins: action.payload,
                },
            },
        };
    }
    return state;
}

describe('CoinDetail', () => {
    const replace = jest.fn();
    let history: MemoryHistory;
    let chartSpy: jest.SpyInstance;

    beforeEach(() => {
        mockExtractColorResult.darkerColor = '#112233';
        jest.mocked(Toast.showSuccess).mockClear();

        chartSpy = jest.spyOn(MarketRequest, 'getCoinChartData').mockImplementation(((_id: string, type: string) => {
            if (type === 'week') {
                return chartApiResult([{ price: 2, last_updated: '2024-06-02T12:00:00.000Z' }]);
            }
            return chartApiResult([{ price: 1, last_updated: '2024-06-01T12:00:00.000Z' }]);
        }) as typeof MarketRequest.getCoinChartData);

        history = createMemoryHistory({ initialEntries: ['/coin-detail'] });
        jest.spyOn(history, 'replace').mockImplementation(replace);
        replace.mockClear();
    });

    afterEach(() => {
        chartSpy.mockRestore();
    });

    function renderPage(options: { routes?: Partial<RoutesContextType>; reduxState?: Record<string, unknown> } = {}) {
        const initialState = buildHomeReduxState(options.reduxState ?? {});
        const store = configureStore({
            reducer: (state = initialState, action) => favoritesReducer(state, action as never),
            middleware: getDefaultMiddleware =>
                getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
        });

        const routesPartial = options.routes ?? {};
        const routes: RoutesContextType = {
            ...defaultRoutesValue,
            dispatch: store.dispatch as RoutesContextType['dispatch'],
            ...routesPartial,
        };
        if (!Object.prototype.hasOwnProperty.call(routesPartial, 'coin')) {
            routes.coin = buildMockMarketCoin();
        }

        return render(
            <Provider store={store}>
                <Router history={history}>
                    <RoutesContext.Provider value={routes}>
                        <CoinDetail />
                    </RoutesContext.Provider>
                </Router>
            </Provider>,
        );
    }

    it('redirects home when coin context is missing', () => {
        renderPage({ routes: { coin: undefined } });
        expect(replace).toHaveBeenCalledWith(DEFAULT_ROUTE);
    });

    it('renders coin title and chart after chart data loads', async () => {
        renderPage();

        const title = screen.getByTestId('header-title');
        expect(within(title).getByText('Bitcoin')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('chilly-chart')).toBeInTheDocument();
        });
        expect(screen.getByTestId('chilly-chart')).toHaveTextContent('chart-points:1');
    });

    it('shows Unknown when coin name is missing', async () => {
        renderPage({
            routes: {
                coin: buildMockMarketCoin({ name: undefined as unknown as string }),
            },
        });

        await waitFor(() => {
            expect(within(screen.getByTestId('header-title')).getByText('Unknown')).toBeInTheDocument();
        });
    });

    it('shows chart placeholder when chart request fails', async () => {
        chartSpy.mockRejectedValueOnce(new Error('network'));
        renderPage();

        await waitFor(() => {
            expect(screen.getByTestId('chart-placeholder')).toBeInTheDocument();
        });
    });

    it('shows placeholder when API returns no quote series', async () => {
        chartSpy.mockResolvedValueOnce({ data: { quotes: [] } } as never);
        renderPage();

        await waitFor(() => {
            expect(screen.getByTestId('chart-placeholder')).toBeInTheDocument();
        });
    });

    it('requests a new range when filter changes and uses cache when switching back', async () => {
        renderPage();

        await waitFor(() => {
            expect(chartSpy).toHaveBeenCalledWith('chilly-btc', 'day');
        });

        await userEvent.click(screen.getByRole('button', { name: '1 W' }));

        await waitFor(() => {
            expect(chartSpy).toHaveBeenCalledWith('chilly-btc', 'week');
        });

        const callsAfterWeek = chartSpy.mock.calls.length;
        await userEvent.click(screen.getByRole('button', { name: '24H' }));

        expect(chartSpy.mock.calls.length).toBe(callsAfterWeek);
    });

    it('refetches chart when refresh control is used', async () => {
        renderPage();

        await waitFor(() => {
            expect(chartSpy).toHaveBeenCalledTimes(1);
        });

        const refresh = document.querySelector('[data-tooltip-content="Refresh Chart Data"]');
        expect(refresh).toBeTruthy();
        await userEvent.click(refresh as HTMLElement);

        await waitFor(() => {
            expect(chartSpy).toHaveBeenCalledTimes(2);
        });
    });

    it('shows the animated refresh icon while chart data is loading', async () => {
        let resolveChart!: (value: Awaited<ReturnType<typeof MarketRequest.getCoinChartData>>) => void;
        chartSpy.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveChart = resolve;
                }),
        );

        renderPage();

        await waitFor(() => {
            expect(document.querySelector('.custom-anim-fast')).toBeInTheDocument();
        });

        await chartApiResult([{ price: 1, last_updated: '2024-06-01T12:00:00.000Z' }]).then(result =>
            resolveChart(result),
        );

        await waitFor(() => {
            expect(screen.getByTestId('chilly-chart')).toBeInTheDocument();
        });
    });

    it('uses light tooltip variant on refresh control when theme is dark', async () => {
        renderPage({
            reduxState: {
                globalState: {
                    preferences: {
                        darkMode: true,
                        darkModeSystem: false,
                    },
                },
            },
        });

        await waitFor(() => {
            const refresh = document.querySelector('[data-tooltip-content="Refresh Chart Data"]');
            expect(refresh?.getAttribute('data-tooltip-variant')).toBe('light');
        });
    });

    it('shows market cap N/A when fully diluted cap is null', async () => {
        renderPage({
            routes: {
                coin: buildMockMarketCoin({
                    latest: {
                        ...defaultLatest(),
                        fully_diluted_market_cap: null as unknown as number,
                    },
                }),
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Market Capitalization')).toBeInTheDocument();
        });
        expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(1);
    });

    it('shows market cap dash when fully diluted cap is zero', async () => {
        renderPage({
            routes: {
                coin: buildMockMarketCoin({
                    latest: {
                        ...defaultLatest(),
                        fully_diluted_market_cap: 0,
                    },
                }),
            },
        });

        await waitFor(() => {
            expect(screen.getByText('--')).toBeInTheDocument();
        });
    });

    it('formats positive fully diluted market cap', async () => {
        renderPage({
            routes: {
                coin: buildMockMarketCoin({
                    latest: {
                        ...defaultLatest(),
                        fully_diluted_market_cap: 1_234_567,
                    },
                }),
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Market Capitalization')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.queryByText('N/A')).not.toBeInTheDocument();
        });
        expect(screen.queryByText('--')).not.toBeInTheDocument();
    });

    it('shows infinity icon when max supply is null', async () => {
        renderPage({
            routes: {
                coin: buildMockMarketCoin({
                    max_supply: null as unknown as number,
                    symbol: 'BTC',
                }),
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Maximum Supply')).toBeInTheDocument();
        });

        const row = screen.getByText('Maximum Supply').closest('.flex');
        expect(row?.querySelector('svg')).toBeTruthy();
    });

    it('shows N/A for ranking when rank is null', async () => {
        renderPage({
            routes: {
                coin: buildMockMarketCoin({ rank: null as unknown as number }),
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Ranking')).toBeInTheDocument();
        });
        const row = screen.getByText('Ranking').closest('.flex');
        expect(row?.textContent).toContain('N/A');
    });

    it('formats maximum supply with symbol when supply is set', async () => {
        renderPage({
            routes: {
                coin: buildMockMarketCoin({ max_supply: 1000, symbol: 'ETH' }),
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Maximum Supply')).toBeInTheDocument();
        });
        const row = screen.getByText('Maximum Supply').closest('.flex');
        expect(row?.textContent).toContain('ETH');
        expect(row?.textContent).toMatch(/1,000|1000/);
    });

    it('falls back to primary color when extract-color returns nothing', async () => {
        mockExtractColorResult.darkerColor = undefined;
        renderPage();

        await waitFor(() => {
            expect(screen.getByTestId('chilly-chart')).toBeInTheDocument();
        });
    });

    it('adds coin to favorites and shows toast', async () => {
        renderPage();

        await waitFor(() => {
            expect(document.querySelector('[data-tooltip-content="Add to favorites"]')).toBeTruthy();
        });

        await userEvent.click(document.querySelector('[data-tooltip-content="Add to favorites"]')!);

        await waitFor(() => {
            expect(Toast.showSuccess).toHaveBeenCalledWith('Coin added to favorites');
        });
        expect(document.querySelector('[data-tooltip-content="Coin is already in favorites"]')).toBeTruthy();
    });

    it('removes coin from favorites and shows toast', async () => {
        const coin = buildMockMarketCoin();
        renderPage({
            routes: { coin },
            reduxState: {
                globalState: {
                    preferences: {
                        favoriteCoins: [coin],
                    },
                },
            },
        });

        await waitFor(() => {
            expect(document.querySelector('[data-tooltip-content="Coin is already in favorites"]')).toBeTruthy();
        });

        await userEvent.click(
            document.querySelector('[data-tooltip-content="Coin is already in favorites"]')!,
        );

        await waitFor(() => {
            expect(Toast.showSuccess).toHaveBeenCalledWith('Coin removed from favorites');
        });
    });

    it('falls back to [] when preferences omit favoriteCoins (uses ?? [] branch)', async () => {
        renderPage({
            reduxState: {
                globalState: {
                    preferences: {
                        favoriteCoins: undefined,
                    },
                },
            },
        });

        await waitFor(() => {
            expect(document.querySelector('[data-tooltip-content="Add to favorites"]')).toBeTruthy();
        });
        await userEvent.click(
            document.querySelector('[data-tooltip-content="Add to favorites"]')!,
        );
        await waitFor(() => {
            expect(Toast.showSuccess).toHaveBeenCalledWith('Coin added to favorites');
        });
    });
});
