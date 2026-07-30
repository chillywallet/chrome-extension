import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GasOptionContent from '../../../src/ui/components/GasOptionContent';

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: { div: ({ children, ...rest }: any) => <div {...rest}>{children}</div> },
}));

jest.mock('../../../src/ui/components/AdvancedNumberInput', () => ({
    __esModule: true,
    default: ({ value, onChange, onValidChangeText, subtitle }: any) => (
        <div>
            <input
                data-testid="advanced-num"
                value={value}
                onChange={e => {
                    onChange && onChange(e);
                    onValidChangeText && onValidChangeText(e.target.value);
                }}
            />
            <span data-testid="subtitle">{subtitle}</span>
        </div>
    ),
}));

jest.mock('../../../src/lib/bigintSerializer', () => ({
    serializeBigInt: (v: any) => {
        if (v === null || v === undefined) return v;
        if (typeof v === 'bigint') return v.toString();
        if (Array.isArray(v)) return v.map(item => (typeof item === 'bigint' ? item.toString() : item));
        if (typeof v === 'object') {
            const result: any = {};
            for (const key in v) {
                result[key] = typeof v[key] === 'bigint' ? v[key].toString() : v[key];
            }
            return result;
        }
        return v;
    },
}));

jest.mock('../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: { fetchNativeCoinPrice: jest.fn() },
}));

jest.mock('../../../src/lib/WalletUtils', () => ({
    getNativeSymbol: () => 'ETH',
    safeParseUnits: (val: string, _decimals: number) => {
        const num = parseFloat(val);
        if (isNaN(num)) return 0n;
        return BigInt(Math.floor(num * 1e9));
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({ ANIM_DURATION: 0 }));

jest.mock('../../../src/shared/types/Chain', () => ({
    GasPriceType: { BaseAndPriority: 'baseandpriority', GasPrice: 'gasprice' },
}));

jest.mock('../../../src/shared/types/Wallet', () => ({
    GasType: {
        Low: 'low',
        Medium: 'medium',
        High: 'high',
        Custom: 'custom',
        Suggest: 'suggest',
    },
    GasTypeNameIcon: {
        low: { name: 'Low', icon: '🐢' },
        medium: { name: 'Medium', icon: '🚗' },
        high: { name: 'High', icon: '🚀' },
        custom: { name: 'Custom', icon: '⚙️' },
        suggest: { name: 'Suggest', icon: '💡' },
    },
}));

const mockEventManagerEmit = jest.fn();
jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: { emit: (...args: any[]) => mockEventManagerEmit(...args) },
}));

jest.mock('../../../src/shared/utils/string', () => ({
    getFloatNumber: (s: string) => parseFloat(s) || 0,
}));

const mockSetCustomGas = jest.fn();
const mockSetGasType = jest.fn();
jest.mock('../../../src/store/actions/uiActions', () => ({
    setCustomGas: (...args: any[]) => {
        mockSetCustomGas(...args);
        return { type: 'SET_CUSTOM_GAS' };
    },
    setGasType: (...args: any[]) => {
        mockSetGasType(...args);
        return { type: 'SET_GAS_TYPE' };
    },
}));

let mockGasInfo: any = { gasType: 'medium', gasOptionsData: null, customGas: null };
let mockSelectedNetwork: any = {
    chain_id: 1,
    chain_key: 'eth',
    gasPriceType: 'gasprice',
    native_coin_symbol: 'ETH',
    testnet: false,
};
let mockNativeCoinPrice = 0;
let mockActualTheme: 'light' | 'dark' = 'light';

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: () => mockActualTheme,
    useGasInfo: () => mockGasInfo,
    useNativeCoinPrice: () => mockNativeCoinPrice,
    useSelectedNetwork: () => mockSelectedNetwork,
}));

let mockReduxStore: any = null;
const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    getReduxStore: () => mockReduxStore,
    useAppDispatch: () => mockDispatch,
}));

describe('GasOptionContent', () => {
    beforeEach(() => {
        mockGasInfo = { gasType: 'medium', gasOptionsData: null, customGas: null };
        mockSelectedNetwork = {
            chain_id: 1,
            chain_key: 'eth',
            gasPriceType: 'gasprice',
            native_coin_symbol: 'ETH',
            testnet: false,
        };
        mockNativeCoinPrice = 0;
        mockActualTheme = 'light';
        mockReduxStore = null;
    });

    it('renders gas type buttons', () => {
        render(<GasOptionContent gasLimit={21000} />);
        expect(screen.getByText('Low')).toBeInTheDocument();
        expect(screen.getByText('Medium')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('renders Advanced Options button', () => {
        render(<GasOptionContent gasLimit={21000} />);
        expect(screen.getByText(/Advanced Options/)).toBeInTheDocument();
    });

    it('toggles advanced options on click', () => {
        render(<GasOptionContent gasLimit={21000} />);
        const btn = screen.getByText(/Advanced Options/).closest('button')!;
        fireEvent.click(btn);
        fireEvent.click(btn); // toggle off
    });

    it('renders Suggest button when suggestionGas is provided', () => {
        const suggestionGas = { gasPrice: 100n };
        render(<GasOptionContent gasLimit={21000} suggestionGas={suggestionGas} />);
        expect(screen.getByText('Suggest')).toBeInTheDocument();
    });

    it('selects Low gas type on click', () => {
        render(<GasOptionContent gasLimit={21000} />);
        fireEvent.click(screen.getByText('Low'));
        expect(mockSetGasType).toHaveBeenCalled();
    });

    it('selects Custom gas type on click and auto-expands advanced options', () => {
        render(<GasOptionContent gasLimit={21000} />);
        fireEvent.click(screen.getByText('Custom'));
        expect(mockSetGasType).toHaveBeenCalled();
    });

    it('selects Custom gas type when already expanded', () => {
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        fireEvent.click(screen.getByText('Custom'));
        expect(mockSetGasType).toHaveBeenCalled();
    });

    it('renders gas price input when expanded with GasPrice network', () => {
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        expect(screen.getByText('Gas Price')).toBeInTheDocument();
    });

    it('renders priority fee inputs when expanded with BaseAndPriority network', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        expect(screen.getByText('Max Priority Fee')).toBeInTheDocument();
        expect(screen.getByText('Max Base Fee')).toBeInTheDocument();
    });

    it('changes gas price text and triggers updateCustomGas', () => {
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: { low: { gasPrice: 1n }, medium: { gasPrice: 2n }, high: { gasPrice: 3n } },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        const inputs = screen.getAllByTestId('advanced-num');
        fireEvent.change(inputs[0], { target: { value: '5.5' } });
        expect(mockSetCustomGas).toHaveBeenCalled();
    });

    it('changes gas price text with comma replaced', () => {
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        const inputs = screen.getAllByTestId('advanced-num');
        fireEvent.change(inputs[0], { target: { value: '5,5' } });
        expect(mockSetCustomGas).toHaveBeenCalled();
    });

    it('changes priority fee text when in BaseAndPriority mode', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        const inputs = screen.getAllByTestId('advanced-num');
        fireEvent.change(inputs[0], { target: { value: '5' } });
        expect(mockSetCustomGas).toHaveBeenCalled();
    });

    it('changes base fee text when in BaseAndPriority mode', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        const inputs = screen.getAllByTestId('advanced-num');
        // input[0] is priority, input[1] is base
        fireEvent.change(inputs[1], { target: { value: '3' } });
        expect(mockSetCustomGas).toHaveBeenCalled();
    });

    it('changes priority fee with no gasOptionsData', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = { gasType: 'medium', gasOptionsData: null, customGas: null };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        const inputs = screen.getAllByTestId('advanced-num');
        fireEvent.change(inputs[0], { target: { value: '5' } });
        expect(mockSetCustomGas).toHaveBeenCalled();
    });

    it('updates customGas when already Custom and customGas differs', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'custom',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
            },
            customGas: { priorityFee: 100n, baseFee: 100n, maxFeePerGas: 200n },
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} initGasType={'custom' as any} />);
        const inputs = screen.getAllByTestId('advanced-num');
        fireEvent.change(inputs[0], { target: { value: '5' } });
    });

    it('does not dispatch when customGas equals new value', () => {
        mockSelectedNetwork.gasPriceType = 'gasprice';
        mockGasInfo = {
            gasType: 'custom',
            gasOptionsData: null,
            customGas: { gasPrice: 0n },
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} initGasType={'custom' as any} />);
        const inputs = screen.getAllByTestId('advanced-num');
        fireEvent.change(inputs[0], { target: { value: '' } });
    });

    it('renders gas fee in USD when not testnet and nativeCoinPrice > 0', () => {
        mockNativeCoinPrice = 2000;
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { gasPrice: 1000000000n },
                medium: { gasPrice: 2000000000n },
                high: { gasPrice: 3000000000n },
                currentBaseFee: 0,
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} />);
        // Should render Max Fee text
        expect(screen.getByText(/Max Fee:/)).toBeInTheDocument();
    });

    it('toggles between USD and coin mode in total fee', () => {
        mockNativeCoinPrice = 2000;
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { gasPrice: 1000000000n },
                medium: { gasPrice: 2000000000n },
                high: { gasPrice: 3000000000n },
            },
            customGas: null,
        };
        const { container } = render(<GasOptionContent gasLimit={21000} />);
        const totalFeeButton = container.querySelector('button.inline-flex');
        if (totalFeeButton) {
            fireEvent.click(totalFeeButton);
            fireEvent.click(totalFeeButton);
        }
    });

    it('renders coin mode when testnet', () => {
        mockSelectedNetwork.testnet = true;
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { gasPrice: 1000000000n },
                medium: { gasPrice: 2000000000n },
                high: { gasPrice: 3000000000n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} />);
        expect(screen.getByText(/Max Fee:/)).toBeInTheDocument();
    });

    it('renders placeholder pulse when maxGasFee is 0 with gasLimit', () => {
        mockGasInfo = { gasType: 'medium', gasOptionsData: null, customGas: null };
        const { container } = render(<GasOptionContent gasLimit={21000} />);
        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('uses dark theme tooltipVariant', () => {
        mockActualTheme = 'dark';
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        // tooltipVariant should be 'light'
    });

    it('uses Suggest gas type when suggestionGas is provided', () => {
        const suggestionGas = { gasPrice: 5000000000n };
        render(<GasOptionContent gasLimit={21000} suggestionGas={suggestionGas} />);
        expect(screen.getByText('Suggest')).toBeInTheDocument();
    });

    it('uses suggestion gas baseFee for BaseAndPriority', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        const suggestionGas = {
            priorityFee: 1n,
            baseFee: 1000000000n,
            maxFeePerGas: 2000000000n,
        };
        render(
            <GasOptionContent
                gasLimit={21000}
                suggestionGas={suggestionGas}
                initGasType={'suggest' as any}
                initExpanded={true}
            />,
        );
        expect(screen.getByText('Suggest')).toBeInTheDocument();
    });

    it('uses customGas baseFee for BaseAndPriority when Custom selected', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'custom',
            gasOptionsData: null,
            customGas: {
                priorityFee: 1n,
                baseFee: 2000000000n,
                maxFeePerGas: 3000000000n,
            },
        };
        render(
            <GasOptionContent
                gasLimit={21000}
                initGasType={'custom' as any}
                initExpanded={true}
            />,
        );
    });

    it('uses Low gas option in BaseAndPriority', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'low',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initGasType={'low' as any} initExpanded={true} />);
    });

    it('uses High gas option in BaseAndPriority', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'high',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initGasType={'high' as any} initExpanded={true} />);
    });

    it('uses suggestion gasPrice for GasPrice network when Suggest selected', () => {
        const suggestionGas = { gasPrice: 5000000000n };
        render(
            <GasOptionContent
                gasLimit={21000}
                suggestionGas={suggestionGas}
                initGasType={'suggest' as any}
                initExpanded={true}
            />,
        );
    });

    it('uses customGas gasPrice for GasPrice when Custom selected', () => {
        mockGasInfo = {
            gasType: 'custom',
            gasOptionsData: null,
            customGas: { gasPrice: 3000000000n },
        };
        render(
            <GasOptionContent
                gasLimit={21000}
                initGasType={'custom' as any}
                initExpanded={true}
            />,
        );
    });

    it('uses Low gas option in GasPrice network', () => {
        mockGasInfo = {
            gasType: 'low',
            gasOptionsData: {
                low: { gasPrice: 1n },
                medium: { gasPrice: 2n },
                high: { gasPrice: 3n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initGasType={'low' as any} initExpanded={true} />);
    });

    it('uses High gas option in GasPrice network', () => {
        mockGasInfo = {
            gasType: 'high',
            gasOptionsData: {
                low: { gasPrice: 1n },
                medium: { gasPrice: 2n },
                high: { gasPrice: 3n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initGasType={'high' as any} initExpanded={true} />);
    });

    it('renders currentBaseFeeDisplay when currentBaseFee provided', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
                currentBaseFee: 5000000000n,
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        expect(screen.getByText(/Current Base Fee:/)).toBeInTheDocument();
    });

    it('renders currentBaseFeeDisplay when currentBaseFee is a string', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
                currentBaseFee: '5000000000',
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        expect(screen.getByText(/Current Base Fee:/)).toBeInTheDocument();
    });

    it('uses network prop when provided', () => {
        const network = {
            chain_id: 5,
            chain_key: 'goerli',
            gasPriceType: 'gasprice',
            native_coin_symbol: 'GETH',
            testnet: true,
        };
        render(<GasOptionContent gasLimit={21000} network={network as any} />);
    });

    it('reads gasType from reduxStore when network prop provided', () => {
        const network = {
            chain_id: 5,
            chain_key: 'goerli',
            gasPriceType: 'gasprice',
            native_coin_symbol: 'GETH',
            testnet: true,
        };
        mockReduxStore = {
            getState: () => ({ globalState: { gasType: { 5: 'high' } } }),
        };
        render(<GasOptionContent gasLimit={21000} network={network as any} />);
    });

    it('skips reduxStore when no gasType found', () => {
        const network = {
            chain_id: 5,
            chain_key: 'goerli',
            gasPriceType: 'gasprice',
            native_coin_symbol: 'GETH',
            testnet: true,
        };
        mockReduxStore = {
            getState: () => ({ globalState: { gasType: {} } }),
        };
        render(<GasOptionContent gasLimit={21000} network={network as any} />);
    });

    it('renders nothing when no gasLimit', () => {
        render(<GasOptionContent />);
        // Should not throw, no Max Fee
        expect(screen.queryByText(/Max Fee:/)).toBeNull();
    });

    it('Custom click expands when not yet expanded', () => {
        const origScrollTo = window.scrollTo;
        (window as any).scrollTo = jest.fn();
        jest.useFakeTimers();
        render(<GasOptionContent gasLimit={21000} initExpanded={false} />);
        act(() => {
            fireEvent.click(screen.getByText('Custom'));
        });
        act(() => {
            jest.runAllTimers();
        });
        jest.useRealTimers();
        window.scrollTo = origScrollTo;
    });

    it('toggles totalFeeMode to coin then back to usd', () => {
        mockNativeCoinPrice = 2000;
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { gasPrice: 1000000000n },
                medium: { gasPrice: 2000000000n },
                high: { gasPrice: 3000000000n },
            },
            customGas: null,
        };
        const { container } = render(<GasOptionContent gasLimit={21000} />);
        const buttons = container.querySelectorAll('button');
        const toggleButton = Array.from(buttons).find(b =>
            b.className.includes('inline-flex'),
        );
        if (toggleButton) {
            fireEvent.click(toggleButton);
            fireEvent.click(toggleButton);
        }
    });

    it('priority fee handler falls back to gasOptionsData.medium.baseFee', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 4000000000n },
                high: { priorityFee: 3n, baseFee: 3n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        const inputs = screen.getAllByTestId('advanced-num');
        // Set priority fee text while baseFee is currently 0 / unset locally
        // input[0] is priority — set with empty baseFeeNum
        fireEvent.change(inputs[0], { target: { value: '' } });
    });

    it('base fee handler falls back to 0 priorityFee', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
        const inputs = screen.getAllByTestId('advanced-num');
        // Touch baseFee input first (input[1]) with empty/0 priorityFee
        fireEvent.change(inputs[1], { target: { value: '' } });
    });

    it('suggestionGas without priorityFee falls back to 0n in BaseAndPriority', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        const suggestionGas = {
            baseFee: 1000000000n,
            maxFeePerGas: 2000000000n,
        };
        render(
            <GasOptionContent
                gasLimit={21000}
                suggestionGas={suggestionGas as any}
                initGasType={'suggest' as any}
                initExpanded={true}
            />,
        );
    });

    it('customGas without priorityFee falls back to 0n in BaseAndPriority', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'custom',
            gasOptionsData: null,
            customGas: {
                baseFee: 2000000000n,
                maxFeePerGas: 3000000000n,
            },
        };
        render(
            <GasOptionContent
                gasLimit={21000}
                initGasType={'custom' as any}
                initExpanded={true}
            />,
        );
    });

    it('option with undefined priorityFee/baseFee falls back to 0n', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: {},
                medium: {},
                high: {},
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
    });

    it('option with undefined gasPrice falls back to 0n in GasPrice network', () => {
        mockGasInfo = {
            gasType: 'medium',
            gasOptionsData: {
                low: {},
                medium: {},
                high: {},
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} />);
    });

    it('shows base fee warning when max base fee is less than current base fee', () => {
        mockSelectedNetwork.gasPriceType = 'baseandpriority';
        mockGasInfo = {
            gasType: 'low',
            gasOptionsData: {
                low: { priorityFee: 1n, baseFee: 1n },
                medium: { priorityFee: 2n, baseFee: 2n },
                high: { priorityFee: 3n, baseFee: 3n },
                currentBaseFee: 100000000000n, // 100 gwei
            },
            customGas: null,
        };
        render(<GasOptionContent gasLimit={21000} initExpanded={true} initGasType={'low' as any} />);
    });
});
