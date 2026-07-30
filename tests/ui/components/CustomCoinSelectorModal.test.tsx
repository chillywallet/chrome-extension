import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomCoinSelectorModal from '../../../src/ui/components/CustomCoinSelectorModal';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: any) =>
        visible ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: any) => (
        <div>
            <span>{title}</span>
            <button onClick={onClosePress}>hdr-close</button>
        </div>
    ),
}));

jest.mock('../../../src/ui/components/NoData', () => ({
    __esModule: true,
    default: ({ children }: any) => <div data-testid="no-data">{children}</div>,
}));

jest.mock('../../../src/ui/components/SearchingIndicator', () => ({
    __esModule: true,
    default: () => <div data-testid="searching" />,
}));

jest.mock('../../../src/ui/components/SwapCoinCard', () => ({
    __esModule: true,
    default: ({ data, onPress }: any) => (
        <button data-testid={`coin-${data.symbol}`} onClick={() => onPress(data)}>
            {data.symbol}
        </button>
    ),
}));

jest.mock('../../../src/lib/ChainsUtils', () => ({
    getPlatformIdByChainData: () => 1,
}));

const mockLoadCoins = jest.fn();
jest.mock('../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: {
        loadCoins: (...args: any[]) => mockLoadCoins(...args),
    },

}));

jest.mock('../../../src/shared/constants/network', () => ({
    EVM_NATIVE_TOKEN_ADDRESS: '0xnative',
    POLYGON_NATIVE_TOKEN_ADDRESS: '0xpolygon-native',
}));

const mockUseTopCoinsByNetwork = jest.fn();
jest.mock('../../../src/store/selectors/coin', () => ({
    useTopCoinsByNetwork: () => mockUseTopCoinsByNetwork(),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn() },
}));

jest.mock('lodash', () => {
    const original = jest.requireActual('lodash');
    return {
        ...original,
        debounce: (fn: Function) => {
            const wrapped: any = (...args: any[]) => fn(...args);
            wrapped.cancel = () => {};
            return wrapped;
        },
    };
});

const network: any = { chain_key: 'eth', testnet: false };

function renderComponent(overrides: Partial<React.ComponentProps<typeof CustomCoinSelectorModal>> = {}) {
    const baseProps: any = {
        visible: true,
        data: [],
        onClose: jest.fn(),
        onCoinPress: jest.fn(),
        walletAddress: null,
        network,
    };
    return render(<CustomCoinSelectorModal {...baseProps} {...overrides} />);
}

// jsdom doesn't implement scrollBy on HTMLElement.
(HTMLElement.prototype as any).scrollBy = function () {};

describe('CustomCoinSelectorModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseTopCoinsByNetwork.mockReturnValue([]);
        mockLoadCoins.mockImplementation((_name: string, _platformId: number, cb: any) =>
            cb({ error: false, result: [] }),
        );
    });

    it('renders the Select Coin header and search box', () => {
        renderComponent();
        expect(screen.getByText('Select Coin')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search coin')).toBeInTheDocument();
    });

    it('toggles the "Other Coins" section', async () => {
        renderComponent({
            data: [{ id: 'a', name: 'A', symbol: 'A', coinAddress: '0xowned' } as any],
        });
        // Trigger an other-coins load by providing data → useEffect runs.
        const otherCoinsToggle = screen.getByText('Other Coins');
        fireEvent.click(otherCoinsToggle.parentElement!);
        fireEvent.click(otherCoinsToggle.parentElement!); // toggle back
    });

    it('uses topCoins when available instead of fetching', () => {
        mockUseTopCoinsByNetwork.mockReturnValue([
            { id: 'c1', name: 'Top', symbol: 'TOP', coinAddress: '0xtop' },
        ]);
        const onLoadEnd = jest.fn();
        renderComponent({
            data: [{ id: 'd1', name: 'O', symbol: 'O', coinAddress: '0xown' } as any],
            onLoadEnd,
        });
        expect(onLoadEnd).toHaveBeenCalled();
        expect(mockLoadCoins).not.toHaveBeenCalled();
    });

    it('filters out native and polygon native tokens', () => {
        const polyNetwork = { chain_key: 'polygon', testnet: false } as any;
        mockUseTopCoinsByNetwork.mockReturnValue([
            { id: 'native', name: 'Native', symbol: 'N', coinAddress: '0xnative' },
            { id: 'matic', name: 'Matic', symbol: 'MATIC', coinAddress: '0xpolygon-native' },
            { id: 'usdc', name: 'USDC', symbol: 'USDC', coinAddress: '0xusdc' },
        ]);
        const onLoadEnd = jest.fn();
        renderComponent({
            data: [{ id: 'd1', name: 'O', symbol: 'O', coinAddress: '0xown' } as any],
            network: polyNetwork,
            onLoadEnd,
        });
        const filtered = onLoadEnd.mock.calls[0][0];
        // Both natives should be filtered out, leaving USDC only.
        expect(filtered.map((c: any) => c.symbol)).toEqual(['USDC']);
    });

    it('triggers onLoadStart and onLoadEnd when fetching coins', async () => {
        mockLoadCoins.mockImplementationOnce((_n: string, _p: number, cb: any) =>
            cb({
                error: false,
                result: [{ id: 'c1', name: 'C1', symbol: 'C1', coinAddress: '0xc1' }],
            }),
        );
        const onLoadStart = jest.fn();
        const onLoadEnd = jest.fn();
        renderComponent({
            data: [{ id: 'o', name: 'O', symbol: 'O', coinAddress: '0xown' } as any],
            onLoadStart,
            onLoadEnd,
        });
        expect(onLoadStart).toHaveBeenCalled();
        await waitFor(() => expect(onLoadEnd).toHaveBeenCalled());
    });

    it('retries load when results are empty', async () => {
        jest.useFakeTimers();
        // First call returns empty → retry path; second also empty → second retry; third empty → exhaust.
        mockLoadCoins
            .mockImplementationOnce((_n: string, _p: number, cb: any) =>
                cb({ error: false, result: [] }),
            )
            .mockImplementationOnce((_n: string, _p: number, cb: any) =>
                cb({ error: false, result: [] }),
            )
            .mockImplementationOnce((_n: string, _p: number, cb: any) =>
                cb({ error: false, result: [] }),
            )
            .mockImplementationOnce((_n: string, _p: number, cb: any) =>
                cb({ error: false, result: [] }),
            );
        const onLoadEnd = jest.fn();
        renderComponent({
            data: [{ id: 'o', name: 'O', symbol: 'O', coinAddress: '0xown' } as any],
            onLoadEnd,
        });
        // Advance through the retries (RETRY_NUM=3, 1 second each).
        for (let i = 0; i < 4; i++) {
            jest.advanceTimersByTime(1000);
        }
        await Promise.resolve();
        jest.useRealTimers();
        // onLoadEnd is eventually called with [] when retries exhaust.
        expect(onLoadEnd).toHaveBeenCalledWith([], []);
    });

    it('searches and shows "No result found" when nothing matches', async () => {
        renderComponent({
            data: [{ id: 'o', name: 'OOO', symbol: 'OOO', coinAddress: '0xown' } as any],
        });
        const input = screen.getByPlaceholderText('Search coin');
        fireEvent.change(input, { target: { value: 'xyz' } });
        await screen.findByTestId('no-data');
    });

    it('searches and shows filtered coins', async () => {
        renderComponent({
            data: [{ id: 'o', name: 'Owned Coin', symbol: 'OWN', coinAddress: '0xown' } as any],
        });
        const input = screen.getByPlaceholderText('Search coin');
        fireEvent.change(input, { target: { value: 'owned' } });
        await screen.findByTestId('coin-OWN');
    });

    it('clearing the search resets results', async () => {
        renderComponent({
            data: [{ id: 'o', name: 'Owned Coin', symbol: 'OWN', coinAddress: '0xown' } as any],
        });
        const input = screen.getByPlaceholderText('Search coin');
        fireEvent.change(input, { target: { value: 'owned' } });
        fireEvent.change(input, { target: { value: '' } });
        // After clearing, the search results section is empty and the default view returns.
        expect(screen.getByText('Other Coins')).toBeInTheDocument();
    });

    it('clicking a coin invokes onCoinPress', () => {
        const onCoinPress = jest.fn();
        renderComponent({
            data: [{ id: 'o', name: 'OWN', symbol: 'OWN', coinAddress: '0xown' } as any],
            onCoinPress,
        });
        fireEvent.click(screen.getByTestId('coin-OWN'));
        expect(onCoinPress).toHaveBeenCalled();
    });

    it('resets state when visible flips to false', () => {
        const { rerender } = render(
            <CustomCoinSelectorModal
                visible={true}
                data={[]}
                onClose={jest.fn()}
                onCoinPress={jest.fn()}
                walletAddress={null}
                network={network}
            />,
        );
        rerender(
            <CustomCoinSelectorModal
                visible={false}
                data={[]}
                onClose={jest.fn()}
                onCoinPress={jest.fn()}
                walletAddress={null}
                network={network}
            />,
        );
        // Hidden state should not throw.
        expect(screen.queryByTestId('modal')).toBeNull();
    });
});
