import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { MarketRequest, WalletRequest } from '../../../src/api/graphQL';
import { PAGING_LIMIT } from '../../../src/shared/constants/number';
import type { ChainData } from '../../../src/shared/types/Chain';
import type { PlatformCoin } from '../../../src/shared/types/Wallet';
import logger from '../../../src/shared/utils/logger';
import { useTopCoinsByNetwork } from '../../../src/store/selectors/coin';
import CoinSelectorModal from '../../../src/ui/components/CoinSelectorModal';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({
        children,
        visible,
    }: {
        children: React.ReactNode;
        visible: boolean;
        onClose: () => void;
    }) => (visible ? <div data-testid="coin-selector-modal-shell">{children}</div> : null),
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: { title: string; onClosePress?: () => void }) => (
        <div>
            <span>{title}</span>
            <button type="button" data-testid="header-close" onClick={onClosePress}>
                close
            </button>
        </div>
    ),
}));

jest.mock('react-icons/fi', () => ({
    FiSearch: () => <span data-testid="search-icon-mock" />,
}));

jest.mock('../../../src/store/selectors/coin', () => ({
    useTopCoinsByNetwork: jest.fn(),
}));

jest.mock('../../../src/api/graphQL', () => ({
    MarketRequest: {
        getCoins: jest.fn(),
    },
    WalletRequest: {
        getCoinsByPlatformIds: jest.fn(),
    },
}));

jest.mock('../../../src/ui/components/CoinSelectorCard', () => ({
    __esModule: true,
    default: ({
        data,
        onPress,
    }: {
        data: PlatformCoin;
        onPress: (c: PlatformCoin) => void;
    }) => (
        <button type="button" data-testid={`coin-card-${data.symbol}`} onClick={() => onPress(data)}>
            {data.symbol}
        </button>
    ),
}));

jest.mock('../../../src/ui/components/SearchingIndicator', () => ({
    __esModule: true,
    default: () => <div data-testid="searching-indicator" />,
}));

jest.mock('../../../src/ui/components/LoadMore', () => ({
    __esModule: true,
    default: () => <div data-testid="load-more" />,
}));

const mockedUseTopCoins = useTopCoinsByNetwork as jest.MockedFunction<typeof useTopCoinsByNetwork>;
const mockedGetCoins = MarketRequest.getCoins as jest.MockedFunction<typeof MarketRequest.getCoins>;
const mockedGetCoinsByPlatformIds = WalletRequest.getCoinsByPlatformIds as jest.MockedFunction<
    typeof WalletRequest.getCoinsByPlatformIds
>;

const mockNetwork: ChainData = {
    name: 'Testnet',
    short_name: 'TST',
    native_coin_symbol: 'ETH',
    native_coin_address: '0x',
    native_coin_name: 'Ether',
    chain: 'eth',
    chain_id: 1,
    platform_id: 42,
    explorer_url: '',
    explorer_name: '',
    chain_key: 'ethereum',
    icon: '',
    gasPriceType: 'legacy',
    swapSupport: true,
    smartWalletSupport: false,
    testnet: true,
};

function makeCoin(overrides: Partial<PlatformCoin> = {}): PlatformCoin {
    return {
        id: 1,
        name: 'Test Coin',
        symbol: 'TST',
        logo: '',
        logo_lrg: '',
        platformId: 1,
        rank: 1,
        coinId: 'h1',
        coinAddress: '0xabc',
        is_verified: true,
        latest: { price: 1, percent_change_24h: 0 },
        ...overrides,
    };
}

function platformCoinsResponse(
    data: PlatformCoin[],
    pagination?: { page: number; last: number }[] | null,
) {
    const pag = pagination === undefined ? [{ page: 1, last: 1 }] : pagination ?? undefined;
    return Promise.resolve({
        data: pag
            ? {
                  platformCoins: {
                      data,
                      pagination: pag,
                  },
              }
            : {
                  platformCoins: {
                      data,
                  },
              },
    });
}

function marketCoinsResponse(
    data: PlatformCoin[],
    pagination?: { page: number; last: number }[] | null,
) {
    const pag = pagination === undefined ? [{ page: 1, last: 1 }] : pagination ?? undefined;
    return Promise.resolve({
        data: pag
            ? {
                  coins: {
                      data,
                      pagination: pag,
                  },
              }
            : {
                  coins: {
                      data,
                  },
              },
    });
}

describe('CoinSelectorModal', () => {
    beforeAll(() => {
        HTMLElement.prototype.scrollTo = jest.fn();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetCoins.mockReset();
        mockedGetCoinsByPlatformIds.mockReset();
        mockedUseTopCoins.mockReturnValue([]);
        mockedGetCoins.mockResolvedValue({ data: null } as Awaited<ReturnType<typeof mockedGetCoins>>);
        mockedGetCoinsByPlatformIds.mockResolvedValue({
            data: null,
        } as Awaited<ReturnType<typeof mockedGetCoinsByPlatformIds>>);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function renderModal(
        props: Partial<React.ComponentProps<typeof CoinSelectorModal>> = {},
    ) {
        return render(
            <CoinSelectorModal
                visible={true}
                onClose={jest.fn()}
                onCoinPress={jest.fn()}
                {...props}
            />,
        );
    }

    it('renders nothing when not visible', () => {
        renderModal({
            visible: false,
            onClose: jest.fn(),
            onCoinPress: jest.fn(),
        });

        expect(screen.queryByText('Select Coin')).not.toBeInTheDocument();
    });

    it('shows initial list from top coins for a network and prepends USD by default', async () => {
        const ethCoin = makeCoin({
            symbol: 'ETH',
            name: 'Ethereum',
        });
        mockedUseTopCoins.mockReturnValue([ethCoin]);

        const onLoadEnd = jest.fn();
        renderModal({ network: mockNetwork, onLoadEnd });

        await waitFor(() => {
            expect(screen.getByTestId('coin-card-USD')).toBeInTheDocument();
            expect(screen.getByTestId('coin-card-ETH')).toBeInTheDocument();
        });

        expect(mockedGetCoinsByPlatformIds).not.toHaveBeenCalled();
        expect(mockedGetCoins).not.toHaveBeenCalled();
        expect(onLoadEnd).toHaveBeenCalledWith([ethCoin]);
    });

    it('omits USD when excludeUsd is true with top coins', async () => {
        const ethCoin = makeCoin({ symbol: 'ETH' });
        mockedUseTopCoins.mockReturnValue([ethCoin]);

        renderModal({ network: mockNetwork, excludeUsd: true });

        await screen.findByTestId('coin-card-ETH');
        expect(screen.queryByTestId('coin-card-USD')).not.toBeInTheDocument();
    });

    it('loads coins via MarketRequest when network is unset and there are no top coins', async () => {
        const coin = makeCoin({ symbol: 'MKR', id: 9 });
        mockedGetCoins.mockImplementation(() =>
            Promise.resolve({
                data: {
                    coins: {
                        data: [coin],
                        pagination: [{ page: 1, last: 1 }],
                    },
                },
            }),
        );

        const onLoadStart = jest.fn();
        const onLoadEnd = jest.fn();
        renderModal({ onLoadStart, onLoadEnd, network: undefined });

        await waitFor(() => {
            expect(mockedGetCoins).toHaveBeenCalledWith('', PAGING_LIMIT, 0);
            expect(screen.getByTestId('coin-card-USD')).toBeInTheDocument();
            expect(screen.getByTestId('coin-card-MKR')).toBeInTheDocument();
        });

        expect(onLoadStart).toHaveBeenCalledTimes(1);
        expect(onLoadEnd).toHaveBeenCalledWith([coin]);
    });

    it('does not prepend USD after market fetch when excludeUsd is true', async () => {
        const coin = makeCoin({ symbol: 'SOLO', id: 44 });
        mockedGetCoins.mockImplementation(() => marketCoinsResponse([coin], [{ page: 1, last: 1 }]));

        renderModal({ network: undefined, excludeUsd: true });

        await screen.findByTestId('coin-card-SOLO');
        expect(screen.queryByTestId('coin-card-USD')).not.toBeInTheDocument();
    });

    it('loads coins via WalletRequest when network is set and top coins empty', async () => {
        const coin = makeCoin({ symbol: 'CHAIN' });
        mockedGetCoinsByPlatformIds.mockImplementation(() =>
            platformCoinsResponse([coin], [{ page: 1, last: 1 }]),
        );

        renderModal({ network: mockNetwork });

        await waitFor(() => {
            expect(mockedGetCoinsByPlatformIds).toHaveBeenCalledWith(
                '',
                [mockNetwork.platform_id],
                PAGING_LIMIT,
                0,
            );
            expect(screen.getByTestId('coin-card-CHAIN')).toBeInTheDocument();
        });
        expect(mockedGetCoins).not.toHaveBeenCalled();
    });

    it('retries wallet fetch while responses are empty then stops', async () => {
        jest.useFakeTimers();
        const logSpy = jest.spyOn(logger, 'log').mockImplementation();

        const emptyPlatform = {
            data: {
                platformCoins: {
                    data: [],
                    pagination: [{ page: 1, last: 1 }],
                },
            },
        } as Awaited<ReturnType<typeof mockedGetCoinsByPlatformIds>>;

        mockedGetCoinsByPlatformIds.mockImplementation(() =>
            Promise.resolve(emptyPlatform),
        );

        renderModal({ network: mockNetwork });

        await waitFor(() => expect(mockedGetCoinsByPlatformIds).toHaveBeenCalledTimes(1));

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        await waitFor(() => expect(mockedGetCoinsByPlatformIds).toHaveBeenCalledTimes(2));
        expect(logSpy).toHaveBeenCalledWith('CoinSelector', expect.stringContaining('Retry'));

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        await waitFor(() => expect(mockedGetCoinsByPlatformIds).toHaveBeenCalledTimes(3));

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        await waitFor(() => expect(mockedGetCoinsByPlatformIds).toHaveBeenCalledTimes(4));

        await waitFor(() => expect(screen.queryByAltText('loading')).not.toBeInTheDocument());

        logSpy.mockRestore();
    });

    it('fires onCoinPress when a coin row is clicked', async () => {
        const coin = makeCoin({ symbol: 'XYA' });
        mockedUseTopCoins.mockReturnValue([coin]);
        const onCoinPress = jest.fn();

        renderModal({ network: mockNetwork, onCoinPress });

        await screen.findByTestId('coin-card-XYA');
        await userEvent.click(screen.getByTestId('coin-card-XYA'));

        expect(onCoinPress).toHaveBeenCalledTimes(1);
        expect(onCoinPress).toHaveBeenCalledWith(coin);
    });

    it('debounces search then queries and shows SearchingIndicator briefly', async () => {
        jest.useFakeTimers();
        const searchHit = makeCoin({ symbol: 'FIND' });
        mockedGetCoins.mockImplementation(name => {
            if (!name) {
                return marketCoinsResponse([makeCoin({ symbol: 'INIT' })], [{ page: 1, last: 1 }]);
            }
            return marketCoinsResponse([searchHit], [{ page: 1, last: 1 }]);
        });

        renderModal({ network: undefined });

        await waitFor(() => expect(screen.queryByAltText('loading')).not.toBeInTheDocument());

        const searchInput = screen.getByPlaceholderText('Search coin');
        fireEvent.change(searchInput, { target: { value: 'abc' } });

        expect(screen.queryByTestId('searching-indicator')).not.toBeInTheDocument();

        await act(async () => {
            jest.advanceTimersByTime(299);
        });
        await act(async () => {
            jest.advanceTimersByTime(1);
        });

        await waitFor(() =>
            expect(mockedGetCoins).toHaveBeenCalledWith('abc', PAGING_LIMIT, 0),
        );

        await waitFor(() => {
            expect(screen.getByTestId('coin-card-FIND')).toBeInTheDocument();
            expect(screen.queryByTestId('searching-indicator')).not.toBeInTheDocument();
        });
    });

    it('shows empty state when search returns no matches', async () => {
        jest.useFakeTimers();
        mockedGetCoins.mockImplementation(name => {
            if (!name) {
                return marketCoinsResponse([makeCoin({ symbol: 'INIT' })], [{ page: 1, last: 1 }]);
            }
            return Promise.resolve({
                data: {
                    coins: {
                        data: [],
                        pagination: [{ page: 1, last: 1 }],
                    },
                },
            });
        });

        renderModal({ network: undefined });
        await waitFor(() => expect(screen.queryByAltText('loading')).not.toBeInTheDocument());

        fireEvent.change(screen.getByPlaceholderText('Search coin'), { target: { value: 'zzz' } });

        await act(async () => {
            jest.advanceTimersByTime(301);
        });

        await screen.findByText('No result found');
    });

    it('loads more coins when scrolled near bottom (market list)', async () => {
        jest.useFakeTimers();
        const first = makeCoin({ symbol: 'A', id: 1 });
        const second = makeCoin({ symbol: 'B', id: 2 });
        mockedGetCoins
            .mockImplementationOnce(() =>
                marketCoinsResponse([first], [{ page: 1, last: 2 }]),
            )
            .mockImplementationOnce(() =>
                marketCoinsResponse([second], [{ page: 2, last: 2 }]),
            );

        renderModal({});
        await screen.findByTestId('coin-card-A');

        const list = screen.getByTestId('coin-card-A').closest('.overflow-y-auto') as HTMLElement;
        Object.defineProperty(list, 'scrollHeight', {
            configurable: true,
            value: 900,
        });
        Object.defineProperty(list, 'clientHeight', {
            configurable: true,
            value: 400,
        });
        list.scrollTop = 450;

        await act(async () => {
            list.dispatchEvent(new Event('scroll'));
            jest.advanceTimersByTime(400);
        });

        await waitFor(() => expect(mockedGetCoins).toHaveBeenCalledTimes(2));
        expect(mockedGetCoins.mock.calls[1]).toEqual(['', PAGING_LIMIT, PAGING_LIMIT]);
        await screen.findByTestId('coin-card-B');
    });

    it('stops load-more when scroll fetch rejects', async () => {
        jest.useFakeTimers();
        const first = makeCoin({ symbol: 'XE', id: 1 });
        mockedGetCoins
            .mockImplementationOnce(() => marketCoinsResponse([first], [{ page: 1, last: 2 }]))
            .mockImplementationOnce(() => Promise.reject(new Error('scroll fail')));

        renderModal({ network: undefined });
        await screen.findByTestId('coin-card-XE');

        const list = screen.getByTestId('coin-card-XE').closest('.overflow-y-auto') as HTMLElement;
        Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 900 });
        Object.defineProperty(list, 'clientHeight', { configurable: true, value: 400 });
        list.scrollTop = 450;

        await act(async () => {
            list.dispatchEvent(new Event('scroll'));
        });

        await waitFor(() => expect(mockedGetCoins).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByTestId('load-more')).not.toBeInTheDocument());
    });

    it('handles market response without pagination metadata', async () => {
        const coin = makeCoin({ symbol: 'NOPAG', id: 99 });
        mockedGetCoins.mockImplementation(() => marketCoinsResponse([coin], null));

        renderModal({ network: undefined });
        await screen.findByTestId('coin-card-NOPAG');
    });

    it('merges default icon data for known coin ids from market API', async () => {
        const eth = makeCoin({
            symbol: 'ETH',
            id: 1027,
            name: 'Ethereum',
            coinId: '616756cb97b3be542eb70b06',
        });
        mockedGetCoins.mockImplementation(() => marketCoinsResponse([eth]));
        renderModal({ network: undefined });
        await screen.findByTestId('coin-card-ETH');
    });

    it('loads more filtered coins when scrolled during an active search', async () => {
        jest.useFakeTimers();
        const initial = makeCoin({ symbol: 'INIT', id: 1 });
        const nextPage = makeCoin({ symbol: 'NEXT', id: 2 });

        mockedGetCoins
            .mockImplementationOnce(() => marketCoinsResponse([initial], [{ page: 1, last: 2 }]))
            .mockImplementationOnce(() =>
                marketCoinsResponse([makeCoin({ symbol: 'FIND1', id: 10 })], [{ page: 1, last: 2 }]),
            )
            .mockImplementationOnce(() => marketCoinsResponse([nextPage], [{ page: 2, last: 2 }]));

        renderModal({ network: undefined });

        await screen.findByTestId('coin-card-INIT');

        fireEvent.change(screen.getByPlaceholderText('Search coin'), {
            target: { value: 'find' },
        });
        await act(async () => {
            jest.advanceTimersByTime(301);
        });

        await screen.findByTestId('coin-card-FIND1');

        const list = screen.getByTestId('coin-card-FIND1').closest('.overflow-y-auto') as HTMLElement;
        Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 900 });
        Object.defineProperty(list, 'clientHeight', { configurable: true, value: 400 });
        list.scrollTop = 450;

        await act(async () => {
            list.dispatchEvent(new Event('scroll'));
            jest.advanceTimersByTime(400);
        });

        await waitFor(() =>
            expect(mockedGetCoins).toHaveBeenCalledWith('find', PAGING_LIMIT, PAGING_LIMIT),
        );
        await screen.findByTestId('coin-card-NEXT');
    });

    it('resets search when modal becomes invisible', async () => {
        mockedUseTopCoins.mockReturnValue([makeCoin({ symbol: 'RST' })]);
        const onClose = jest.fn();
        const { rerender } = renderModal({ visible: true, network: mockNetwork, onClose });
        await waitFor(() => expect(screen.queryByAltText('loading')).not.toBeInTheDocument());

        const input = screen.getByPlaceholderText('Search coin');
        await userEvent.type(input, 'hold');

        expect(input).toHaveValue('hold');

        rerender(
            <CoinSelectorModal visible={false} onClose={onClose} onCoinPress={jest.fn()} network={mockNetwork} />,
        );

        rerender(
            <CoinSelectorModal visible={true} onClose={jest.fn()} onCoinPress={jest.fn()} network={mockNetwork} />,
        );

        await waitFor(() =>
            expect((screen.getByPlaceholderText('Search coin') as HTMLInputElement).value).toBe(''),
        );
    });

    it('handles initial API rejection then returns coins on retry', async () => {
        jest.useFakeTimers();
        mockedGetCoins.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
            data: {
                coins: {
                    data: [makeCoin({ symbol: 'OK' })],
                    pagination: [{ page: 1, last: 1 }],
                },
            },
        } as Awaited<ReturnType<typeof mockedGetCoins>>);

        renderModal({ network: undefined });

        await waitFor(() =>
            expect(mockedGetCoins).toHaveBeenCalledWith('', PAGING_LIMIT, 0),
        );

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        await screen.findByTestId('coin-card-OK');
        expect(mockedGetCoins.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});
