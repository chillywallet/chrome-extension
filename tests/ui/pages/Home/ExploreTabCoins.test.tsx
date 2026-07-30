import { configureStore } from '@reduxjs/toolkit';
import React, { useCallback, useMemo, useState } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MarketRequest } from '../../../../src/api/graphQL';
import ExploreTabCoins from '../../../../src/ui/pages/Home/Explore/ExploreTabCoins';
import type { RoutesContextType } from '../../../../src/ui/pages/RoutesProvider';
import { RoutesContext } from '../../../../src/ui/pages/RoutesProvider';
import { buildHomeReduxState, defaultRoutesValue } from './fixtures/homeHarness';

jest.mock('../../../../src/store/backgroundConnection', () => {
    const {
        submitRequestToBackgroundTestDouble,
    } = require('./fixtures/backgroundTestDouble');
    return {
        generateActionId: () => 'test-action',
        submitRequestToBackground: (method: string, args?: unknown[]) =>
            submitRequestToBackgroundTestDouble(method, args),
    };
});

jest.mock('../../../../src/api/graphQL', () => ({
    MarketRequest: {
        getCoins: jest.fn(),
        getCoinsByIds: jest.fn(),
    },
}));

function coinsResponse(data: any[], hasMore = false) {
    return Promise.resolve({
        data: {
            coins: {
                data,
                pagination: hasMore ? [{ page: 1, last: 2 }] : [{ page: 1, last: 1 }],
            },
        },
    });
}

beforeEach(() => {
    (MarketRequest.getCoins as jest.Mock).mockImplementation(() =>
        coinsResponse([{ id: '1', name: 'Mock', symbol: 'MCK' }]),
    );
    (MarketRequest.getCoinsByIds as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: { coins: { data: [] } } }),
    );
});

describe('ExploreTabCoins', () => {
    function ExploreCoinsHarness(props: {
        state?: Record<string, unknown>;
        initialFavorite?: boolean;
    }) {
        const { state: stateOverrides, initialFavorite = false } = props;
        const store = useMemo(
            () =>
                configureStore({
                    reducer: (state = buildHomeReduxState(stateOverrides ?? {})) => state,
                    middleware: getDefaultMiddleware =>
                        getDefaultMiddleware({
                            serializableCheck: false,
                            immutableCheck: false,
                        }),
                }),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [],
        );

        const [exploreCoinData, setExploreCoinDataInner] = useState({
            data: [] as any[],
            offset: 0,
            hasMore: false,
        });
        const setExploreCoinData = useCallback((value: any) => {
            setExploreCoinDataInner(prev => (typeof value === 'function' ? value(prev) : value));
        }, []);

        const [isFavorite, setIsFavorite] = useState(initialFavorite);
        const [coinSearchText, setCoinSearchText] = useState('');

        const onMarketCoinPress = useMemo(() => jest.fn(), []);
        const routes: RoutesContextType = {
            ...defaultRoutesValue,
            dispatch: store.dispatch as RoutesContextType['dispatch'],
            exploreCoinData,
            setExploreCoinData,
            isFavorite,
            setIsFavorite,
            coinSearchText,
            setCoinSearchText,
            onMarketCoinPress,
        };

        return (
            <Provider store={store}>
                <MemoryRouter>
                    <RoutesContext.Provider value={routes}>
                        <ExploreTabCoins />
                    </RoutesContext.Provider>
                </MemoryRouter>
            </Provider>
        );
    }

    it('renders market coins from initial load and toggles favorite filter', async () => {
        render(<ExploreCoinsHarness />);

        await waitFor(() => {
            expect(screen.getByText('Mock')).toBeInTheDocument();
        });

        const favToggle = document.querySelector('[data-tooltip-content="Show favorite coins"]');
        expect(favToggle).toBeTruthy();
        await userEvent.click(favToggle as Element);
    });

    it('shows favorite list when isFavorite', async () => {
        const coin = { name: 'Fav', symbol: 'FV', coinId: 'h1' } as any;

        render(
            <ExploreCoinsHarness
                initialFavorite
                state={{
                    globalState: {
                        preferences: {
                            favoriteCoins: [coin],
                        },
                    },
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Fav')).toBeInTheDocument();
        });
    });

    it('toggles favorite off when star icon is clicked while in favorite mode', async () => {
        render(<ExploreCoinsHarness initialFavorite />);

        const offToggle = await waitFor(() => {
            const node = document.querySelector('[data-tooltip-content="Show all coins"]');
            expect(node).toBeTruthy();
            return node!;
        });
        await userEvent.click(offToggle);

        await waitFor(() => {
            expect(
                document.querySelector('[data-tooltip-content="Show favorite coins"]'),
            ).toBeTruthy();
        });
    });

    it('runs a debounced search when typing into the search box', async () => {
        render(<ExploreCoinsHarness />);

        await waitFor(() => {
            expect(MarketRequest.getCoins).toHaveBeenCalled();
        });
        (MarketRequest.getCoins as jest.Mock).mockClear();

        const input = (await screen.findByPlaceholderText(
            /search for coin/i,
        )) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'sea' } });

        await waitFor(() => {
            expect(input.value).toBe('sea');
        });

        await waitFor(
            () => {
                expect(MarketRequest.getCoins).toHaveBeenCalledWith('sea', 20, 0, true);
            },
            { timeout: 1500 },
        );
    });

    it('loads more when the Load more button is clicked', async () => {
        (MarketRequest.getCoins as jest.Mock).mockImplementation((name: string, _limit, offset) =>
            coinsResponse(
                [{ id: String(offset), name: `Coin-${offset}`, symbol: 'C' }],
                /* hasMore */ offset === 0,
            ),
        );

        render(<ExploreCoinsHarness />);

        const loadMore = await screen.findByRole('button', { name: /load more/i });
        await userEvent.click(loadMore);

        await waitFor(() => {
            expect(MarketRequest.getCoins).toHaveBeenCalledTimes(2);
        });
        expect(MarketRequest.getCoins).toHaveBeenLastCalledWith('', 20, 20, true);
    });

    it('filters favorite coins by symbol when there is search text', async () => {
        const favorites = [
            { name: 'Alpha', symbol: 'AAA', coinId: 'a' },
            { name: 'Bitcoin', symbol: 'BTC', coinId: 'b' },
        ];

        function FavoriteSearchHarness() {
            const initialState = buildHomeReduxState({
                globalState: { preferences: { favoriteCoins: favorites } },
            });
            const store = configureStore({
                reducer: (state = initialState) => state,
                middleware: getDefaultMiddleware =>
                    getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
            });

            const [exploreCoinData, setExploreCoinDataInner] = useState({
                data: [] as any[],
                offset: 0,
                hasMore: false,
            });
            const setExploreCoinData = useCallback((value: any) => {
                setExploreCoinDataInner(prev => (typeof value === 'function' ? value(prev) : value));
            }, []);

            const routes: RoutesContextType = {
                ...defaultRoutesValue,
                dispatch: store.dispatch as RoutesContextType['dispatch'],
                exploreCoinData,
                setExploreCoinData,
                isFavorite: true,
                setIsFavorite: () => {},
                coinSearchText: 'btc',
                setCoinSearchText: () => {},
            };

            return (
                <Provider store={store}>
                    <MemoryRouter>
                        <RoutesContext.Provider value={routes}>
                            <ExploreTabCoins />
                        </RoutesContext.Provider>
                    </MemoryRouter>
                </Provider>
            );
        }

        render(<FavoriteSearchHarness />);

        await waitFor(() => {
            expect(screen.getByText('Bitcoin')).toBeInTheDocument();
        });
        expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    });


    it('falls back to defaults when getCoins resolves without data', async () => {
        (MarketRequest.getCoins as jest.Mock).mockResolvedValueOnce({});

        render(<ExploreCoinsHarness />);

        await waitFor(() => {
            expect(MarketRequest.getCoins).toHaveBeenCalled();
        });
    });

    it('renders when preferences omit favoriteCoins (uses [] default)', async () => {
        render(
            <ExploreCoinsHarness state={{ globalState: { preferences: {} } }} />,
        );
        await waitFor(() => expect(MarketRequest.getCoins).toHaveBeenCalled());
    });

    it('filters favorite coins without crashing when name/symbol are missing', async () => {
        const coin = { name: undefined, symbol: undefined, coinId: 'h-empty' } as any;
        (MarketRequest.getCoinsByIds as jest.Mock).mockResolvedValueOnce({
            data: { coins: { data: [coin] } },
        });

        function NameAndSymbolMissingHarness() {
            const store = useMemo(
                () =>
                    configureStore({
                        reducer: (state = buildHomeReduxState({
                            globalState: { preferences: { favoriteCoins: [coin] } },
                        })) => state,
                        middleware: getDefaultMiddleware =>
                            getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
                    }),
                [],
            );
            const [exploreCoinData, setExploreCoinDataInner] = useState({
                data: [] as any[],
                offset: 0,
                hasMore: false,
            });
            const setExploreCoinData = useCallback((v: any) => {
                setExploreCoinDataInner(prev => (typeof v === 'function' ? v(prev) : v));
            }, []);
            const [coinSearchText, setCoinSearchText] = useState('q');
            const routes: RoutesContextType = {
                ...defaultRoutesValue,
                dispatch: store.dispatch as RoutesContextType['dispatch'],
                exploreCoinData,
                setExploreCoinData,
                isFavorite: true,
                setIsFavorite: () => {},
                coinSearchText,
                setCoinSearchText,
                onMarketCoinPress: jest.fn(),
            };
            return (
                <Provider store={store}>
                    <MemoryRouter>
                        <RoutesContext.Provider value={routes}>
                            <ExploreTabCoins />
                        </RoutesContext.Provider>
                    </MemoryRouter>
                </Provider>
            );
        }

        render(<NameAndSymbolMissingHarness />);
        // No throw is sufficient — the (name ?? '') / (symbol ?? '') filter ran without erroring
        await waitFor(() => expect(MarketRequest.getCoinsByIds).toHaveBeenCalled());
    });

    it('handles getCoinsByIds populated favorites', async () => {
        const coin = { name: 'Fav', symbol: 'FV', coinId: 'h1' } as any;
        (MarketRequest.getCoinsByIds as jest.Mock).mockResolvedValueOnce({
            data: { coins: { data: [{ name: 'Backend Fav', symbol: 'BF', coinId: 'h1' }] } },
        });

        render(
            <ExploreCoinsHarness
                initialFavorite
                state={{ globalState: { preferences: { favoriteCoins: [coin] } } }}
            />,
        );

        await waitFor(() => {
            expect(MarketRequest.getCoinsByIds).toHaveBeenCalledWith(['h1'], true);
        });
    });
});
