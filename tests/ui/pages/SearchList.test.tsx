import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import * as selectors from '../../../src/store/selectors';
import Toast from '../../../src/ui/components/Toast';
import SearchList, { Placeholder } from '../../../src/ui/pages/SearchList';
import { CONTACT_ROUTE, QUESTS_ROUTE } from '../../../src/shared/constants/routes';
import { MarketRequest, WalletRequest } from '../../../src/api/graphQL';

const mockPush = jest.fn();
const mockOnMarketCoinPress = jest.fn();

const mockDapps: any[] = [];
jest.mock('../../../src/config/trustedDapps', () => ({
    // Lazy getter: the hoisted factory runs while `mockDapps` is still in its TDZ,
    // so the array must be resolved at access time, not factory time.
    get TRUSTED_DAPPS() {
        return mockDapps;
    },
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual<typeof import('react-router-dom')>('react-router-dom'),
    useHistory: () => ({ push: mockPush }),
}));

jest.mock('../../../src/ui/pages/RoutesProvider', () => ({
    __esModule: true,
    useRoutesData: () => ({
        onMarketCoinPress: mockOnMarketCoinPress,
    }),
}));

jest.mock('../../../src/store/selectors', () => ({
    __esModule: true,
    useContacts: jest.fn(() => []),
    useSelectedNetwork: jest.fn(() => ({
        explorer_name: 'Etherscan',
        explorer_url: 'https://etherscan.io',
    })),
}));

jest.mock('../../../src/api/graphQL', () => ({
    WalletRequest: {
        getQuests: jest.fn(),
    },
    MarketRequest: {
        getCoins: jest.fn(),
        getCoinsByIds: jest.fn(),
    },
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <header>{title}</header>,
}));

jest.mock('../../../src/ui/components/ScrollWithButton', () => ({
    __esModule: true,
    default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="scroll-wrap" className={className}>
            {children}
        </div>
    ),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showError: jest.fn(),
    },
}));

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock('../../../src/ui/components/TextTruncate', () => ({
    __esModule: true,
    default: ({ text }: { text: string }) => <span>{text}</span>,
}));

jest.mock('../../../src/ui/components/EmojiView', () => ({
    __esModule: true,
    default: ({ emoji }: { emoji?: string }) => <span data-testid="emoji-view">{emoji ?? ''}</span>,
}));
describe('Placeholder', () => {
    it('renders skeleton blocks', () => {
        const { container } = render(<Placeholder />);
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
});

describe('SearchList', () => {
    const validAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415d37aA96045';

    const sampleDomains = [
        {
            url: 'https://safe-site.example',
            description: 'ok',
            name: 'Safe Site',
            level: 'HIGH' as const,
        },
        {
            url: 'https://another.example',
            description: 'ok2',
            name: 'Another',
            level: 'HIGH' as const,
        },
    ];

    const sampleCoin = {
        id: 1,
        coinId: 'coin-chilly',
        name: 'Testcoin',
        symbol: 'TST',
        logo: 'https://example.com/c.png',
        latest: {
            price: 12.345,
            percent_change_24h: 2.5,
        },
        rank: 3,
    };

    let store = configureStore({ reducer: { _: () => ({}) } });

    function renderSearchList() {
        return render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/search']}>
                    <SearchList />
                </MemoryRouter>
            </Provider>,
        );
    }

    beforeAll(() => {
        (global as unknown as { platform: { openLink: jest.Mock } }).platform = {
            openLink: jest.fn(),
        };
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockDapps.length = 0;
        mockDapps.push(...sampleDomains, {
            url: 'https://bad.com',
            description: '',
            name: 'ScamCo',
            level: 'SCAM',
        });
        jest.mocked(MarketRequest.getCoins).mockResolvedValue({
            data: { coins: { data: [sampleCoin] } },
        } as never);
        jest.mocked(MarketRequest.getCoinsByIds).mockResolvedValue({
            data: { coins: { data: [sampleCoin] } },
        } as never);

        (selectors.useContacts as jest.Mock).mockReturnValue([]);
        (selectors.useSelectedNetwork as jest.Mock).mockReturnValue({
            explorer_name: 'Etherscan',
            explorer_url: 'https://etherscan.io',
        });

        store = configureStore({ reducer: { _: () => ({}) } });
    });

    it('renders the committed dapp directory immediately', async () => {
        renderSearchList();
        await waitFor(() => {
            expect(screen.getByText('Safe Site')).toBeInTheDocument();
        });
        expect(screen.getByText('Trusted Domains')).toBeInTheDocument();
    });

    it('limits trusted domain matches to MAX_RESULT_PER_TYPE', async () => {
        mockDapps.length = 0;
        mockDapps.push(
            ...Array.from({ length: 8 }, (_, i) => ({
                url: `https://d${i}.example`,
                description: '',
                name: `Domain ${i + 1}`,
                level: 'HIGH' as const,
            })),
        );


        renderSearchList();
        await waitFor(() => {
            expect(screen.getByText('Domain 1')).toBeInTheDocument();
            expect(screen.getByText('Domain 5')).toBeInTheDocument();
        });

        expect(screen.queryByText('Domain 8')).not.toBeInTheDocument();
    });

    it('shows no results when there is nothing to display', async () => {
        mockDapps.length = 0;

        renderSearchList();

        await waitFor(() => {
            expect(screen.getByText('No results found')).toBeInTheDocument();
        });
    });

    it('filters domains by search text case-insensitively', async () => {
        mockDapps.length = 0;
        mockDapps.push(...sampleDomains);

        renderSearchList();
        await screen.findByText('Safe Site');

        await userEvent.type(screen.getByPlaceholderText(/Search domains/), 'another');

        expect(screen.queryByText('Safe Site')).not.toBeInTheDocument();
        expect(screen.getByText('Another')).toBeInTheDocument();
    });

    it('debounces MarketRequest.getCoins when typing non-address search', async () => {
        jest.useFakeTimers();
        mockDapps.length = 0;

        renderSearchList();
        const input = screen.getByPlaceholderText(/Search domains/);
        fireEvent.change(input, { target: { value: 'eth' } });

        expect(MarketRequest.getCoins).not.toHaveBeenCalled();

        await act(async () => {
            jest.advanceTimersByTime(500);
        });

        await waitFor(() => {
            expect(MarketRequest.getCoins).toHaveBeenCalledWith('eth', 20, 0, false);
        });

        jest.useRealTimers();
    });

    it('clears coin results when search is cleared without calling getCoins for empty query', async () => {
        jest.useFakeTimers();
        mockDapps.length = 0;

        renderSearchList();
        const input = screen.getByPlaceholderText(/Search domains/) as HTMLInputElement;

        fireEvent.change(input, { target: { value: 'x' } });
        await act(async () => {
            jest.advanceTimersByTime(500);
        });
        await waitFor(() => expect(MarketRequest.getCoins).toHaveBeenCalled());

        jest.mocked(MarketRequest.getCoins).mockClear();
        fireEvent.change(input, { target: { value: '' } });

        await act(async () => {
            jest.advanceTimersByTime(500);
        });

        expect(MarketRequest.getCoins).not.toHaveBeenCalled();
        expect(screen.getByText('No results found')).toBeInTheDocument();

        jest.useRealTimers();
    });

    it('renders coin rows and opens detail on successful getCoinsByIds', async () => {
        mockDapps.length = 0;

        jest.useFakeTimers();
        renderSearchList();

        fireEvent.change(screen.getByPlaceholderText(/Search domains/), {
            target: { value: 'tst' },
        });
        await act(async () => {
            jest.advanceTimersByTime(500);
        });

        await waitFor(() => {
            expect(screen.getByText('Coin Prices')).toBeInTheDocument();
        });

        const coinBtn = screen.getByRole('button', { name: /Testcoin/i });
        await userEvent.click(coinBtn);

        await waitFor(() => {
            expect(MarketRequest.getCoinsByIds).toHaveBeenCalledWith(['coin-chilly'], true);
            expect(mockOnMarketCoinPress).toHaveBeenCalledWith(sampleCoin);
        });

        jest.useRealTimers();
    });

    it('shows error toast when getCoinsByIds fails', async () => {
        jest.useFakeTimers();
        mockDapps.length = 0;
        jest.mocked(MarketRequest.getCoinsByIds).mockRejectedValueOnce(new Error('fail'));

        renderSearchList();

        fireEvent.change(screen.getByPlaceholderText(/Search domains/), {
            target: { value: 'tst' },
        });
        await act(async () => {
            jest.advanceTimersByTime(500);
        });

        await screen.findByRole('button', { name: /Testcoin/i });
        await userEvent.click(screen.getByRole('button', { name: /Testcoin/i }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('Failed to load coin data');
        });

        jest.useRealTimers();
    });

    it('shows negative percentage styling for losers', async () => {
        jest.useFakeTimers();
        mockDapps.length = 0;
        jest.mocked(MarketRequest.getCoins).mockResolvedValue({
            data: {
                coins: {
                    data: [
                        {
                            ...sampleCoin,
                            latest: {
                                price: 1,
                                percent_change_24h: -3.333,
                            },
                            rank: 0,
                        },
                    ],
                },
            },
        } as never);

        renderSearchList();
        fireEvent.change(screen.getByPlaceholderText(/Search domains/), {
            target: { value: 'x' },
        });
        await act(async () => {
            jest.advanceTimersByTime(500);
        });

        await waitFor(() => {
            expect(screen.getByText('-3.33%')).toBeInTheDocument();
        });

        jest.useRealTimers();
    });



    it('opens explorer links when a validated address is entered', async () => {
        mockDapps.length = 0;

        const openLink = (
            global as unknown as {
                platform: { openLink: jest.Mock };
            }
        ).platform.openLink;

        renderSearchList();
        await waitFor(() => {
            expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
        });

        await userEvent.type(screen.getByPlaceholderText(/Search domains/), validAddress);

        expect(screen.getByText('Blockscan')).toBeInTheDocument();
        expect(screen.getByText('Etherscan')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /Etherscan/i }));

        expect(openLink).toHaveBeenCalledWith(
            expect.stringContaining(`https://etherscan.io/address/${validAddress}`),
            '_blank',
        );
    });

    it('shows Unknown Explorer title when chain is missing', async () => {
        (selectors.useSelectedNetwork as jest.Mock).mockReturnValue(undefined);
        mockDapps.length = 0;

        renderSearchList();
        await waitFor(() => {
            expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
        });

        await userEvent.type(screen.getByPlaceholderText(/Search domains/), validAddress);

        expect(screen.getByText('Unknown Explorer')).toBeInTheDocument();
    });

    it('shows matching contacts under an address query and navigates contacts on row press', async () => {
        mockDapps.length = 0;
        (selectors.useContacts as jest.Mock).mockReturnValue([
            {
                id: 'c1',
                name: 'Alice Buddy',
                walletAddress: validAddress,
                avatar: '😀',
            },
        ]);

        renderSearchList();
        await waitFor(() => {
            expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
        });

        await userEvent.type(screen.getByPlaceholderText(/Search domains/), validAddress);

        expect(screen.getByText('Contacts')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Alice Buddy/i }));

        expect(mockPush).toHaveBeenCalledWith(CONTACT_ROUTE);
    });

    it('shows contacts filtered by substring in normal search mode', async () => {
        mockDapps.length = 0;
        (selectors.useContacts as jest.Mock).mockReturnValue([
            { id: 'a', name: 'Zeta Friend', walletAddress: validAddress },
            { id: 'b', name: 'Alice Friend', walletAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
        ]);

        renderSearchList();
        await waitFor(() => expect(screen.queryByText('Trusted Domains')).not.toBeInTheDocument());

        await userEvent.type(screen.getByPlaceholderText(/Search domains/), 'alice');

        await waitFor(() => {
            expect(screen.getByText('Alice Friend')).toBeInTheDocument();
            expect(screen.queryByText('Zeta Friend')).not.toBeInTheDocument();
        });
    });

    it('prefixes bare domain URLs with https when opened', async () => {
        mockDapps.length = 0;
        mockDapps.push({
            url: 'chilly.me',
            description: 'd',
            name: 'Bare domain',
            level: 'HIGH' as const,
        });

        const openLink = (
            global as unknown as {
                platform: { openLink: jest.Mock };
            }
        ).platform.openLink;

        renderSearchList();
        await screen.findByText('Bare domain');
        await userEvent.click(screen.getByRole('button', { name: /Bare domain/i }));

        expect(openLink).toHaveBeenCalledWith('https://chilly.me', '_blank');
    });

    it('suppresses getQuests errors without crashing UI', async () => {
        mockDapps.length = 0;
        mockDapps.push(...sampleDomains);

        renderSearchList();

        await waitFor(() => {
            expect(screen.getByText('Safe Site')).toBeInTheDocument();
        });
        expect(screen.queryByText('Quests')).not.toBeInTheDocument();
    });

    it('suppresses getCoins errors and leaves list without coin rows', async () => {
        jest.useFakeTimers();
        mockDapps.length = 0;
        jest.mocked(MarketRequest.getCoins).mockRejectedValueOnce(new Error('coin fail'));

        renderSearchList();
        fireEvent.change(screen.getByPlaceholderText(/Search domains/), {
            target: { value: 'eth' },
        });
        await act(async () => {
            jest.advanceTimersByTime(500);
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(MarketRequest.getCoins).toHaveBeenCalled();
        expect(screen.queryByText('Coin Prices')).not.toBeInTheDocument();

        jest.useRealTimers();
    });
});
