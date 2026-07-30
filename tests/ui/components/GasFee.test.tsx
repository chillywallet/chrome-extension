import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import GasFee from '../../../src/ui/components/GasFee';
import { GasType } from '../../../src/shared/types/Wallet';

const mockState: any = {};

jest.mock('../../../src/ui/components/GasOptionModal', () => ({
    __esModule: true,
    default: ({ visible, onClosePress }: any) =>
        visible ? (
            <div data-testid="gas-option-modal">
                <button data-testid="gas-option-close" onClick={onClosePress}>
                    close
                </button>
            </div>
        ) : null,
}));


const mockFetchNativeCoinPrice = jest.fn();
jest.mock('../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: { fetchNativeCoinPrice: (...args: any[]) => mockFetchNativeCoinPrice(...args) },
}));

const mockHandleGasPrice = jest.fn();
jest.mock('../../../src/lib/WalletUtils', () => ({
    handleGasPrice: (...args: any[]) => mockHandleGasPrice(...args),
}));

jest.mock('../../../src/shared/messages/ErrorMessages', () => ({
    __esModule: true,
    default: {
        INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS: 'Insufficient',
        INSUFFICIENT_FUNDS_FOR_GAS: 'Insufficient gas',
    },
}));

jest.mock('../../../src/shared/types/Chain', () => ({
    GasPriceType: { BaseAndPriority: 'baseandpriority', GasPrice: 'gasprice' },
}));

const mockEventOn = jest.fn();
const mockEventOff = jest.fn();
jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        on: (...args: any[]) => mockEventOn(...args),
        off: (...args: any[]) => mockEventOff(...args),
        emit: jest.fn(),
    },
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockGetTokenBalance = jest.fn();
const mockLoadGasOptions = jest.fn();
jest.mock('../../../src/store/actions/uiActions', () => ({
    getTokenBalance: (...args: any[]) => mockGetTokenBalance(...args),
    loadGasOptions: (...args: any[]) => mockLoadGasOptions(...args),
}));

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: () => mockState.actualTheme,
    useCurrentAddress: () => mockState.walletAddress,
    useGasInfo: () => mockState.gasInfo,
    useIsTestnet: () => mockState.isTestnet,
    useNativeCoinPrice: () => mockState.nativeCoinPrice,
    useSelectedNetwork: () => mockState.selectedNetwork,
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/shared/constants/swap', () => ({
    UPDATE_GAS_INTERVAL: 60000,
}));

jest.mock('../../../src/shared/utils/format', () => ({
    formatMoney: (n: number) => `$${n.toFixed(2)}`,
    formatNumber: (n: number) => String(n),
}));

jest.mock('ethers', () => ({
    formatEther: (v: any) => String(Number(v) / 1e18),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockState.setError = jest.fn();
    mockState.actualTheme = 'light';
    mockState.walletAddress = '0xwallet';
    mockState.isTestnet = false;
    mockState.nativeCoinPrice = 2;
    mockState.selectedNetwork = {
        chain_id: 143,
        chain_key: 'monad',
        short_name: 'Monad',
        native_coin_symbol: 'MON',
        gasPriceType: 'baseandpriority',
    };
    mockState.gasInfo = {
        gasType: GasType.Medium,
        gasOptionsData: { currentBaseFee: 10n },
        customGas: {},
    };

    mockGetTokenBalance.mockResolvedValue({ balance: 10n ** 18n, decimals: 18, error: false });
    mockHandleGasPrice.mockReturnValue({
        gasPrice: 100n,
        gasInfo: { priorityFee: 1n },
    });
});

describe('GasFee (EOA-only)', () => {
    it('renders the network fee row and opens the gas option modal', async () => {
        render(<GasFee gasLimit={21000} />);

        expect(screen.getAllByText('Network Fee').length).toBeGreaterThan(0);

        const editButtons = document.querySelectorAll('button');
        // The pencil edit button opens the modal
        fireEvent.click(editButtons[1]);
        await waitFor(() =>
            expect(screen.getByTestId('gas-option-modal')).toBeInTheDocument(),
        );

        fireEvent.click(screen.getByTestId('gas-option-close'));
        expect(screen.queryByTestId('gas-option-modal')).not.toBeInTheDocument();
    });

    it('shows the loading skeleton when isLoading', () => {
        const { container } = render(<GasFee gasLimit={21000} isLoading />);
        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('reports insufficient funds through the onError prop', async () => {
        mockGetTokenBalance.mockResolvedValue({ balance: 0n, decimals: 18, error: false });
        mockHandleGasPrice.mockReturnValue({
            gasPrice: 10n ** 15n,
            gasInfo: { priorityFee: 1n },
        });

        const onError = jest.fn();
        render(<GasFee gasLimit={21000} onError={onError} />);

        await waitFor(() => expect(onError).toHaveBeenCalledWith('Insufficient gas'));
    });

    it('propagates gas data via onGasChange', async () => {
        const onGasChange = jest.fn();
        render(<GasFee gasLimit={21000} onGasChange={onGasChange} />);
        await waitFor(() => expect(onGasChange).toHaveBeenCalled());
    });

    it('subscribes to CHANGE_GAS_TYPE events', () => {
        render(<GasFee gasLimit={21000} />);
        expect(mockEventOn).toHaveBeenCalled();
    });
});
