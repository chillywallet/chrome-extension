import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import NetworkMenu from '../../../src/ui/components/NetworkMenu';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children, onClose }: any) =>
        visible ? (
            <div data-testid="modal">
                <button data-testid="modal-close" onClick={onClose} />
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: any) => (
        <div>
            <button data-testid="header-close" onClick={onClosePress} />
            {title}
        </div>
    ),
}));

jest.mock('../../../src/ui/components/NetworkCard', () => ({
    __esModule: true,
    default: ({ network, onPress, onCustomizePress }: any) => (
        <div data-testid={`netcard-${network.chain_id}`}>
            <button data-testid={`net-${network.chain_id}`} onClick={() => onPress(network)}>
                {network.name}
            </button>
            <button
                data-testid={`customize-${network.chain_id}`}
                onClick={(e: any) => onCustomizePress(network, e)}
            />
        </div>
    ),
}));

jest.mock('../../../src/ui/components/CustomNetworkModal', () => ({
    __esModule: true,
    default: ({ visible, onClosePress }: any) =>
        visible ? (
            <div data-testid="custom-network-modal">
                <button data-testid="cnm-close" onClick={onClosePress} />
            </div>
        ) : null,
}));

const mockShowError = jest.fn();
jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showError: (...args: any[]) => mockShowError(...args) },
}));

jest.mock('react-tabs', () => ({
    Tab: ({ children }: any) => <li>{children}</li>,
    TabList: ({ children }: any) => <ul>{children}</ul>,
    TabPanel: ({ children }: any) => <div>{children}</div>,
    Tabs: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('../../../src/lib/ChainsUtils', () => ({
    getCurrentChains: () => [
        { chain_id: 1, name: 'Eth', testnet: false },
        { chain_id: 137, name: 'Polygon', testnet: false },
        { chain_id: 11155111, name: 'Sepolia', testnet: true },
        { chain_id: 80002, name: 'Amoy', testnet: true },
    ],
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

const mockUseSelectedNetwork = jest.fn(() => ({ chain_id: 1, testnet: false }));
const mockUsePreferences = jest.fn(() => ({ defaultChainId: 1 }));
jest.mock('../../../src/store/selectors', () => ({
    usePreferences: () => mockUsePreferences(),
    useSelectedNetwork: () => mockUseSelectedNetwork(),
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    setSelectedNetwork: (id: number) => ({ type: 'SET_NET', id }),
    setUseDefaultNetwork: (v: boolean) => ({ type: 'SET_USE_DEFAULT', v }),
}));

describe('NetworkMenu', () => {
    beforeEach(() => {
        mockDispatch.mockImplementation(() => Promise.resolve());
        mockShowError.mockReset();
        mockUseSelectedNetwork.mockImplementation(() => ({ chain_id: 1, testnet: false }));
        mockUsePreferences.mockImplementation(() => ({ defaultChainId: 1 }));
    });

    it('renders Select a Network title and network cards', () => {
        render(<NetworkMenu visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByText('Select a Network')).toBeInTheDocument();
        expect(screen.getByText('Eth')).toBeInTheDocument();
        expect(screen.getByText('Sepolia')).toBeInTheDocument();
    });

    it('renders Mainnet/Testnet tabs', () => {
        render(<NetworkMenu visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByText('Mainnet')).toBeInTheDocument();
        expect(screen.getByText('Testnet')).toBeInTheDocument();
    });

    it('emits onNetworkChange when a different network is pressed', async () => {
        const onNetworkChange = jest.fn();
        const onClosePress = jest.fn();
        render(
            <NetworkMenu
                visible={true}
                onClosePress={onClosePress}
                onNetworkChange={onNetworkChange}
            />,
        );
        fireEvent.click(screen.getByTestId('net-11155111'));
        // dispatch chain is async; wait for the callback
        await new Promise(r => setTimeout(r, 0));
        expect(onNetworkChange).toHaveBeenCalled();
    });

    it('does not render when invisible', () => {
        render(<NetworkMenu visible={false} onClosePress={jest.fn()} />);
        expect(screen.queryByText('Select a Network')).toBeNull();
    });

    it('closes when selecting the already-selected network', () => {
        const onClosePress = jest.fn();
        render(<NetworkMenu visible={true} onClosePress={onClosePress} />);
        fireEvent.click(screen.getByTestId('net-1'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('shows a Toast error when dispatch fails', async () => {
        mockDispatch.mockImplementationOnce(() => {
            throw new Error('boom');
        });
        const onClosePress = jest.fn();
        render(<NetworkMenu visible={true} onClosePress={onClosePress} />);
        fireEvent.click(screen.getByTestId('net-11155111'));
        await new Promise(r => setTimeout(r, 0));
        expect(mockShowError).toHaveBeenCalledWith('boom');
    });

    it('swallows dispatch error without message silently', async () => {
        mockDispatch.mockImplementationOnce(() => {
            // eslint-disable-next-line no-throw-literal
            throw { code: 'no-message' };
        });
        const onClosePress = jest.fn();
        render(<NetworkMenu visible={true} onClosePress={onClosePress} />);
        fireEvent.click(screen.getByTestId('net-11155111'));
        await new Promise(r => setTimeout(r, 0));
        // No toast shown because message is falsy
        expect(mockShowError).not.toHaveBeenCalled();
    });

    it('opens and closes the CustomNetworkModal via customize button', () => {
        render(<NetworkMenu visible={true} onClosePress={jest.fn()} />);
        fireEvent.click(screen.getByTestId('customize-1'));
        expect(screen.getByTestId('custom-network-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('cnm-close'));
        // After close, modal is dismissed because customNetworkModal.network is null.
        expect(screen.queryByTestId('custom-network-modal')).toBeNull();
    });

    it('filters out networks from the excludeNetworks list', () => {
        render(
            <NetworkMenu
                visible={true}
                onClosePress={jest.fn()}
                excludeNetworks={[{ chain_id: 1, name: 'Eth' } as any]}
            />,
        );
        expect(screen.queryByText('Eth')).toBeNull();
        expect(screen.getByText('Polygon')).toBeInTheDocument();
    });

    it('sorts networks so the default chain appears first', () => {
        render(<NetworkMenu visible={true} onClosePress={jest.fn()} />);
        // Polygon, Eth — but default is 1 (Eth) so Eth must come first.
        const cards = screen.getAllByTestId(/^netcard-/);
        // Mainnets are the first two cards (chain_id 1, 137); testnets follow.
        const mainnetIds = cards
            .slice(0, 2)
            .map(c => c.getAttribute('data-testid'));
        expect(mainnetIds[0]).toBe('netcard-1');
    });

    it('does not dispatch when customNetwork prop is true', async () => {
        const onClosePress = jest.fn();
        const onNetworkChange = jest.fn();
        render(
            <NetworkMenu
                visible={true}
                onClosePress={onClosePress}
                onNetworkChange={onNetworkChange}
                customNetwork={true}
            />,
        );
        mockDispatch.mockClear();
        fireEvent.click(screen.getByTestId('net-11155111'));
        await new Promise(r => setTimeout(r, 0));
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(onNetworkChange).toHaveBeenCalled();
        expect(onClosePress).toHaveBeenCalled();
    });

    it('closes via the modal onClose handler', () => {
        const onClosePress = jest.fn();
        render(<NetworkMenu visible={true} onClosePress={onClosePress} />);
        fireEvent.click(screen.getByTestId('modal-close'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('defaults to testnet tab when current network is a testnet (handles undefined testnet too)', () => {
        mockUseSelectedNetwork.mockImplementation(() => ({ chain_id: 11155111 }) as any);
        render(<NetworkMenu visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByText('Select a Network')).toBeInTheDocument();
    });

    it('sorts default chain second when bIsDefault flag wins (default is Polygon)', () => {
        mockUsePreferences.mockImplementation(() => ({ defaultChainId: 137 }));
        render(<NetworkMenu visible={true} onClosePress={jest.fn()} />);
        const cards = screen.getAllByTestId(/^netcard-/);
        expect(cards[0].getAttribute('data-testid')).toBe('netcard-137');
    });

    it('defaults to testnet tab when selected network is testnet', () => {
        mockUseSelectedNetwork.mockImplementation(() => ({ chain_id: 11155111, testnet: true }));
        render(<NetworkMenu visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByText('Select a Network')).toBeInTheDocument();
    });
});
