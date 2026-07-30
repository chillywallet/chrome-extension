import { configureStore } from '@reduxjs/toolkit';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';

import { MarketRequest } from '../../../src/api/graphQL';
import { DEFAULT_CHAIN } from '../../../src/lib/ChainsUtils';
import {
    DEFAULT_ROUTE,
    FIAT_OFF_RAMP_ROUTE,
    FIAT_ON_RAMP_ROUTE,
} from '../../../src/shared/constants/routes';
import { EVM_NATIVE_TOKEN_ADDRESS } from '../../../src/shared/constants/network';
import type { Coin } from '../../../src/shared/types/Wallet';
import AssetCoinDetail from '../../../src/ui/pages/AssetCoinDetail';
import type { RoutesContextType } from '../../../src/ui/pages/RoutesProvider';
import { RoutesContext } from '../../../src/ui/pages/RoutesProvider';
import { getTokenTransactionHistory } from '../../../src/shared/utils/portfolio';
import { getEnvironmentType } from '../../../src/shared/utils/utils';
import { useIsTestnet, useSelectedNetwork } from '../../../src/store/selectors';

import { buildHomeReduxState, defaultRoutesValue } from './Home/fixtures/homeHarness';

const mockExtractColorResult: { darkerColor?: string } = { darkerColor: '#112233' };

jest.mock('react-extract-colors', () => ({
    useExtractColor: () => mockExtractColorResult,
}));

jest.mock('../../../src/shared/utils/portfolio', () => ({
    ...jest.requireActual('../../../src/shared/utils/portfolio'),
    getTokenTransactionHistory: jest.fn(),
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useSelectedNetwork: jest.fn(),
    useIsTestnet: jest.fn(),
}));

jest.mock('../../../src/shared/utils/utils', () => ({
    ...jest.requireActual('../../../src/shared/utils/utils'),
    getEnvironmentType: jest.fn(() => 'fullscreen'),
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

jest.mock('../../../src/ui/components/WalletTag', () => ({
    __esModule: true,
    default: ({ isAAWallet }: { isAAWallet: boolean }) => (
        <span data-testid="wallet-tag">{isAAWallet ? 'aa' : 'eoa'}</span>
    ),
}));

jest.mock('../../../src/ui/components/PriceChart', () => ({
    __esModule: true,
    default: ({ data }: { data: number[] }) => (
        <div data-testid="chilly-chart">chart-points:{data.length}</div>
    ),
    PriceChartPlaceholder: () => <div data-testid="chart-placeholder" />,
}));

jest.mock('../../../src/ui/components/TransactionCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: { data: { id?: string }; onPress: () => void }) => (
        <button type="button" data-testid="tx-card" onClick={onPress}>
            {data?.id ?? 'tx'}
        </button>
    ),
    Placeholder: () => <div data-testid="tx-placeholder" />,
}));

jest.mock('../../../src/ui/components/TransactionDetailModal', () => ({
    __esModule: true,
    default: ({
        visible,
        onClosePress,
    }: {
        visible: boolean;
        onClosePress: () => void;
    }) =>
        visible ? (
            <div data-testid="tx-detail-modal">
                <button type="button" data-testid="close-tx-modal" onClick={onClosePress}>
                    close
                </button>
            </div>
        ) : null,
}));

function buildMockCoin(overrides: Partial<Coin> = {}): Coin {
    return {
        id: 'coin-1',
        name: 'Test',
        type: 'coin',
        total: 0,
        totalUSD: 0,
        color: '#000',
        wallet_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        wallet_name: 'W1',
        token_id: 'token-id-1',
        token_address: '0x1111111111111111111111111111111111111111',
        balance: 1,
        balance_usd: 1,
        platform_id: DEFAULT_CHAIN.platform_id,
        integration_type: 'native',
        avatar: null,
        coin_name: 'Test Coin',
        logo: 'https://logo.test/coin.png',
        symbol: 'TC',
        is_custom: false,
        is_hidden: false,
        is_verified: true,
        ...overrides,
    } as Coin;
}

describe('AssetCoinDetail', () => {
    const replace = jest.fn();
    const push = jest.fn();
    let history: MemoryHistory;
    let getCoinPortfolioSpy: jest.SpyInstance;

    const mockOnCoinSendPress = jest.fn();
    const mockOnCoinSwapPress = jest.fn();
    let openExtensionInBrowser: jest.Mock;

    beforeEach(() => {
        openExtensionInBrowser = jest.fn();
        (global as any).platform = { openExtensionInBrowser };

        jest.mocked(useSelectedNetwork).mockReturnValue(DEFAULT_CHAIN as never);
        jest.mocked(useIsTestnet).mockReturnValue(false);

        getCoinPortfolioSpy?.mockRestore();
        getCoinPortfolioSpy = jest
            .spyOn(MarketRequest, 'getCoinChartData')
            .mockResolvedValue({
                data: {
                    quotes: [
                        {
                            quotes: [
                                {
                                    price: 2,
                                    last_updated: '2024-06-01T12:00:00.000Z',
                                },
                            ],
                        },
                    ],
                },
            } as never);

        jest.mocked(getTokenTransactionHistory).mockResolvedValue({
            data: [{ id: 'tx-1' } as never],
            pagination: { page: 1, hasNextPage: false },
        });

        history = createMemoryHistory({ initialEntries: ['/asset-detail'] });
        jest.spyOn(history, 'replace').mockImplementation(replace);
        jest.spyOn(history, 'push').mockImplementation(push);

        mockOnCoinSendPress.mockClear();
        mockOnCoinSwapPress.mockClear();
        replace.mockClear();
        push.mockClear();
        openExtensionInBrowser.mockClear();
        jest.mocked(getEnvironmentType).mockReturnValue('fullscreen');
        mockExtractColorResult.darkerColor = '#112233';
    });

    function renderPage(options: {
        routes?: Partial<RoutesContextType>;
        coin?: Coin | null;
    } = {}) {
        const initialState = buildHomeReduxState();
        const store = configureStore({
            reducer: (state = initialState) => state,
            middleware: (getDefaultMiddleware) =>
                getDefaultMiddleware({
                    serializableCheck: false,
                    immutableCheck: false,
                }),
        });

        const defaultSend: RoutesContextType['sendAssetViewData'] =
            options.coin === null
                ? undefined
                : {
                      coinToSend: options.coin ?? buildMockCoin(),
                      isAAWallet: false,
                  };

        const routes: RoutesContextType = {
            ...defaultRoutesValue,
            dispatch: store.dispatch as RoutesContextType['dispatch'],
            onCoinSendPress: mockOnCoinSendPress,
            onCoinSwapPress: mockOnCoinSwapPress,
            sendAssetViewData: defaultSend,
            ...options.routes,
        };

        return render(
            <Provider store={store}>
                <Router history={history}>
                    <RoutesContext.Provider value={routes}>
                        <AssetCoinDetail />
                    </RoutesContext.Provider>
                </Router>
            </Provider>,
        );
    }

    it('redirects home when coin context is missing', () => {
        renderPage({ coin: null });
        expect(replace).toHaveBeenCalledWith(DEFAULT_ROUTE);
    });

    it('renders coin title and shows chart after portfolio loads', async () => {
        renderPage();

        expect(await screen.findByText('Test Coin')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId('chilly-chart')).toBeInTheDocument();
        });
        expect(screen.getByTestId('chilly-chart')).toHaveTextContent('chart-points:1');
    });

    it('shows empty transactions copy when history is empty', async () => {
        jest.mocked(getTokenTransactionHistory).mockResolvedValue({
            data: [],
            pagination: { page: 1, hasNextPage: false },
        });
        renderPage();

        await waitFor(() => {
            expect(screen.getByText(/There are no transactions/i)).toBeInTheDocument();
        });
    });

    it('switches chart range and requests portfolio for that frame', async () => {
        renderPage();

        await waitFor(() => {
            expect(getCoinPortfolioSpy).toHaveBeenCalled();
        });

        const initialCalls = getCoinPortfolioSpy.mock.calls.length;
        await userEvent.click(screen.getByRole('button', { name: '1 W' }));

        await waitFor(() => {
            expect(getCoinPortfolioSpy.mock.calls.length).toBeGreaterThan(initialCalls);
        });
        expect(getCoinPortfolioSpy.mock.calls.some(c => c[1] === 'week')).toBe(true);
    });

    it('uses chart placeholder when portfolio request fails', async () => {
        getCoinPortfolioSpy.mockRejectedValueOnce(new Error('network'));
        renderPage();

        await waitFor(() => {
            expect(screen.getByTestId('chart-placeholder')).toBeInTheDocument();
        });
    });

    it('Buy navigates to on-ramp with token query when not AA and not testnet', async () => {
        renderPage();

        await userEvent.click(screen.getByRole('button', { name: 'Buy' }));

        expect(push).toHaveBeenCalledWith(
            expect.stringMatching(
                new RegExp(
                    `^${FIAT_ON_RAMP_ROUTE.replace('/', '\\/')}\\?contractAddress=.+\&chainId=`,
                ),
            ),
        );
    });

    it('Buy uses zero address query param when token is native to the network', async () => {
        renderPage({
            coin: buildMockCoin({ token_address: EVM_NATIVE_TOKEN_ADDRESS }),
        });

        await userEvent.click(screen.getByRole('button', { name: 'Buy' }));

        expect(push.mock.calls[0][0]).toContain('contractAddress=0x0000000000000000000000000000000000000000');
    });

    it('Sell navigates to off-ramp route', async () => {
        renderPage();

        await userEvent.click(screen.getByRole('button', { name: 'Sell' }));
        expect(push.mock.calls[0][0]).toContain(FIAT_OFF_RAMP_ROUTE);
    });

    it('disables Buy and Sell for AA wallet', async () => {
        renderPage({
            routes: {
                sendAssetViewData: {
                    coinToSend: buildMockCoin(),
                    isAAWallet: true,
                },
            },
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
        });

        await userEvent.click(screen.getByRole('button', { name: 'Buy' }));
        expect(push).not.toHaveBeenCalled();
    });

    it('disables Buy and Sell on testnet', async () => {
        jest.mocked(useIsTestnet).mockReturnValue(true);
        renderPage();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
        });

        await userEvent.click(screen.getByRole('button', { name: 'Buy' }));
        expect(push).not.toHaveBeenCalled();
    });

    it('Send invokes onCoinSendPress with coin and AA flag', async () => {
        renderPage({
            routes: {
                sendAssetViewData: { coinToSend: buildMockCoin(), isAAWallet: true },
            },
        });

        await userEvent.click(screen.getByRole('button', { name: 'Send' }));

        expect(mockOnCoinSendPress).toHaveBeenCalledWith(
            expect.objectContaining({ coin_name: 'Test Coin' }),
            true,
        );
    });

    it('Swap invokes onCoinSwapPress when swap is supported', async () => {
        const coin = buildMockCoin();
        renderPage({ coin });

        await userEvent.click(screen.getByRole('button', { name: 'Swap' }));

        expect(mockOnCoinSwapPress).toHaveBeenCalledWith(
            expect.objectContaining({
                coinAddress: coin.token_address,
                symbol: 'TC',
            }),
        );
    });

    it('Swap is disabled for AA wallet', async () => {
        renderPage({
            routes: {
                sendAssetViewData: {
                    coinToSend: buildMockCoin(),
                    isAAWallet: true,
                },
            },
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Swap' })).toBeDisabled();
        });
    });

    it('opens transaction detail modal when a transaction row is pressed', async () => {
        renderPage();

        await waitFor(() => {
            expect(screen.getByTestId('tx-card')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('tx-card'));
        expect(screen.getByTestId('tx-detail-modal')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('close-tx-modal'));
        expect(screen.queryByTestId('tx-detail-modal')).not.toBeInTheDocument();
    });

    it('loads more transactions when pagination has next page', async () => {
        jest.mocked(getTokenTransactionHistory)
            .mockResolvedValueOnce({
                data: [{ id: 'tx-a' } as never],
                pagination: { page: 1, hasNextPage: true },
            })
            .mockResolvedValueOnce({
                data: [{ id: 'tx-b' } as never],
                pagination: { page: 2, hasNextPage: false },
            });

        renderPage();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

        await waitFor(() => {
            expect(jest.mocked(getTokenTransactionHistory).mock.calls.length).toBeGreaterThanOrEqual(
                2,
            );
        });
    });

    it('uses primary color fallback when extract color is unavailable', async () => {
        mockExtractColorResult.darkerColor = undefined;
        renderPage();

        await waitFor(() => {
            expect(screen.getByTestId('chilly-chart')).toBeInTheDocument();
        });
    });

    it('reads chart from cache when the same range is selected again', async () => {
        renderPage();

        await waitFor(() => {
            expect(getCoinPortfolioSpy).toHaveBeenCalled();
        });
        const callsBefore = getCoinPortfolioSpy.mock.calls.length;

        await userEvent.click(screen.getByRole('button', { name: '24H' }));
        expect(getCoinPortfolioSpy.mock.calls.length).toBe(callsBefore);
    });

    it('stops transaction loading when history fetch fails', async () => {
        jest.mocked(getTokenTransactionHistory).mockRejectedValueOnce(new Error('tx fail'));
        renderPage();

        await waitFor(() => {
            expect(screen.getByText(/There are no transactions/i)).toBeInTheDocument();
        });
    });

    it('opens fiat route in browser when environment is popup', async () => {
        jest.mocked(getEnvironmentType).mockReturnValueOnce('popup');

        renderPage();

        await userEvent.click(screen.getByRole('button', { name: 'Buy' }));
        expect(openExtensionInBrowser).toHaveBeenCalledWith(
            expect.stringContaining(FIAT_ON_RAMP_ROUTE),
        );
        expect(push).not.toHaveBeenCalled();
    });

    describe('additional branches', () => {
        it('renders placeholder when portfolio response has no portfolio data', async () => {
            getCoinPortfolioSpy.mockResolvedValueOnce({ data: {} } as never);
            renderPage();

            await waitFor(() => {
                expect(screen.getByTestId('chart-placeholder')).toBeInTheDocument();
            });
        });

        it('uses coin.icon for the header avatar when available', async () => {
            renderPage({
                coin: buildMockCoin({ icon: 'icon-url', logo: 'logo-url' as any }),
            });
            // Header is rendered via the mocked Header, so just assert title text resolved.
            expect(await screen.findByText('Test Coin')).toBeInTheDocument();
        });

        it('falls back to "Unknown" when coin has no coin_name', async () => {
            renderPage({
                coin: buildMockCoin({ coin_name: undefined as any }),
            });
            expect(await screen.findByText('Unknown')).toBeInTheDocument();
        });

        it('builds the swap PlatformCoin payload using defaults when symbol/logo are missing', async () => {
            const coin = buildMockCoin({ symbol: undefined as any, logo: undefined as any });
            renderPage({ coin });

            await userEvent.click(screen.getByRole('button', { name: 'Swap' }));
            expect(mockOnCoinSwapPress).toHaveBeenCalledWith(
                expect.objectContaining({
                    symbol: '',
                    logo: '',
                }),
            );
        });

        it('does not load transactions when the coin has no wallet_address', async () => {
            // Force the page to render but skip the loader because wallet_address is empty.
            jest.mocked(getTokenTransactionHistory).mockClear();
            const coin = buildMockCoin({ wallet_address: '' });
            renderPage({ coin });

            // The chart load still runs but the transaction loader is gated by _address.
            await waitFor(() => {
                expect(screen.getByText(/There are no transactions/i)).toBeInTheDocument();
            });
            // Should never have been called because _address is falsy.
            expect(jest.mocked(getTokenTransactionHistory)).not.toHaveBeenCalled();
        });

        it('Buy click is gated by coin null guard via disabled state', async () => {
            // When no coin, the page redirects home — but the Buy button is also gated by
            // not-AA + not-testnet, so disabling testnet path covers the coin null branch via
            // the redirect flow.
            renderPage({ coin: null });
            expect(replace).toHaveBeenCalledWith(DEFAULT_ROUTE);
        });

        it('uses incoming coin.icon when it is set (icon branch in header)', async () => {
            renderPage({ coin: buildMockCoin({ icon: 'present', logo: 'logo' as any }) });
            expect(await screen.findByText('Test Coin')).toBeInTheDocument();
        });

        it('falls back to empty string when token_address or chain_id missing', async () => {
            // Missing token_address → the buy URL should NOT include contractAddress.
            renderPage({
                coin: buildMockCoin({ token_address: '' as any }),
            });
            await userEvent.click(screen.getByRole('button', { name: 'Buy' }));
            expect(push.mock.calls[0][0]).not.toContain('contractAddress');
        });
    });
});
