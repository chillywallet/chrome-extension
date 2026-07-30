
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as ethers from 'ethers';

import EventType from '../../../src/shared/types/EventType';
import { PlatformId } from '../../../src/shared/types/Chain';
import type { ChainData } from '../../../src/shared/types/Chain';
import { GasPriceType } from '../../../src/shared/types/Chain';
import Toast from '../../../src/ui/components/Toast';
import AddCustomCoinModal from '../../../src/ui/components/AddCustomCoinModal';
import logger from '../../../src/shared/utils/logger';
import { useAppDispatch } from '../../../src/store/store';
import { usePreferences, useSelectedNetwork } from '../../../src/store/selectors';

const mockReadAddressAsContract = jest.fn();

jest.mock('lodash', () => {
    const actual = jest.requireActual<typeof import('lodash')>('lodash');
    return {
        ...actual,
        debounce: (fn: (...args: unknown[]) => void) =>
            Object.assign(
                (...args: unknown[]) => {
                    fn(...args);
                },
                { cancel: jest.fn() },
            ),
    };
});

jest.mock('../../../src/lib/transactions/utils', () => ({
    readAddressAsContract: (...args: unknown[]) => mockReadAddressAsContract(...args),
}));


jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(),
}));

const mockSetPreferences = jest.fn();
jest.mock('../../../src/store/actions/uiActions', () => ({
    showLoadingIndicator: jest.fn(
        () => (dispatch: (a: { type: string }) => void) => {
            dispatch({ type: 'SHOW_LOADING' });
        },
    ),
    hideLoadingIndicator: jest.fn(
        () => (dispatch: (a: { type: string }) => void) => {
            dispatch({ type: 'HIDE_LOADING' });
        },
    ),
    setPreferences: (prefs: any) => mockSetPreferences(prefs),
}));

jest.mock('../../../src/lib/customTokens', () => ({
    buildCustomTokensPreference: (chainId: number, token: any) => ({
        [String(chainId)]: [token],
    }),
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useSelectedNetwork: jest.fn(),
    usePreferences: jest.fn(),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: jest.fn(),
        showError: jest.fn(),
    },
}));

const mockEmit = jest.fn();
jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        emit: (...args: unknown[]) => mockEmit(...args),
    },
}));

jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({
            children,
            className,
            onClick,
        }: {
            children?: React.ReactNode;
            className?: string;
            onClick?: () => void;
        }) => (
            <div className={className} onClick={onClick} data-testid="motion-div">
                {children}
            </div>
        ),
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0.3,
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
    },
}));

const TOKEN_ADDR = '0x1234567890123456789012345678901234567890';
const WALLET = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

function erc1155BalanceMock() {
    return {
        balanceOf: jest.fn().mockResolvedValue(1),
        name: jest.fn().mockRejectedValue(new Error('no name')),
        symbol: jest.fn().mockRejectedValue(new Error('no symbol')),
    };
}

function contractProbeImplementation(
    _address: string,
    _abi: readonly unknown[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _provider?: any,
): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis;
    const cfg = g.__addCustomCoinModalEthersCfg ?? {
        erc20Fails: false,
        erc721Fails: false,
    };
    g.__addCoinContractProbe = (g.__addCoinContractProbe ?? 0) + 1;
    const probe = g.__addCoinContractProbe;

    if (probe === 1) {
        if (cfg.erc20Fails) {
            return {
                name: jest.fn().mockRejectedValue(new Error('not erc20')),
                symbol: jest.fn().mockRejectedValue(new Error('not erc20')),
                decimals: jest.fn().mockRejectedValue(new Error('not erc20')),
            };
        }
        return {
            name: jest.fn().mockResolvedValue('My Token'),
            symbol: jest.fn().mockResolvedValue('MT'),
            decimals: jest.fn().mockResolvedValue(BigInt(18)),
        };
    }

    if (probe === 2) {
        if (cfg.erc721Fails) {
            return {
                name: jest.fn().mockRejectedValue(new Error('not erc721')),
                symbol: jest.fn().mockRejectedValue(new Error('not erc721')),
            };
        }
        return {
            name: jest.fn().mockResolvedValue('Cool NFT'),
            symbol: jest.fn().mockResolvedValue('CNFT'),
        };
    }

    if (probe === 3) {
        return erc1155BalanceMock();
    }

    return {};
}

function mockChain(overrides: Partial<ChainData> = {}): ChainData {
    return {
        name: 'Test',
        short_name: 'TST',
        native_coin_symbol: 'TST',
        native_coin_address: '0x0000000000000000000000000000000000000000',
        native_coin_name: 'Test',
        chain: 'ethereum',
        chain_id: 4242,
        platform_id: PlatformId.Ethereum,
        explorer_url: 'https://explorer.test',
        explorer_name: 'Explorer',
        chain_key: 'ethereum',
        icon: '',
        gasPriceType: GasPriceType.GasPrice,
        swapSupport: true,
        smartWalletSupport: true,
        rpcUrl: 'http://127.0.0.1:8545',
        ...overrides,
    };
}

function setupSelectors(chain: ChainData | null | undefined = mockChain()) {
    jest.mocked(useSelectedNetwork).mockReturnValue(chain as ChainData | undefined | null);
    jest.mocked(usePreferences).mockReturnValue({
        customNetworks: [],
        rpcUrls: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
}

async function settleLatestAddPromise(): Promise<void> {
    await waitFor(() => expect(mockSetPreferences).toHaveBeenCalled());
    await Promise.resolve();
}

describe('AddCustomCoinModal', () => {
    const onClosePress = jest.fn();

    const mockThunkDispatch: jest.Mock = jest.fn();
    const thunkDispatchImpl = (action: unknown) => {
        if (typeof action === 'function') {
            return (
                action as (d: typeof mockThunkDispatch, s: () => unknown) => unknown
            )(mockThunkDispatch, () => ({}));
        }
        // Promise-shaped actions (e.g. the mocked setPreferences) pass through
        return action;
    };

    let jsonRpcSpy: jest.SpiedFunction<typeof ethers.JsonRpcProvider> | undefined;
    let contractSpy: jest.SpiedFunction<typeof ethers.Contract> | undefined;

    beforeEach(() => {
        mockSetPreferences.mockImplementation(() => Promise.resolve());
        mockThunkDispatch.mockImplementation(thunkDispatchImpl);
        jsonRpcSpy?.mockRestore();
        contractSpy?.mockRestore();

        jsonRpcSpy = jest.spyOn(ethers, 'JsonRpcProvider').mockImplementation(
            function RpcMock(this: unknown) {
                return this;
            } as unknown as typeof ethers.JsonRpcProvider,
        );

        contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(
            function (
                this: unknown,
                address: string,
                abi: readonly unknown[],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                provider?: any,
            ) {
                return contractProbeImplementation(address, abi, provider);
            } as unknown as typeof ethers.Contract,
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any = globalThis;
        g.__addCustomCoinModalEthersCfg = {
            erc20Fails: false,
            erc721Fails: false,
        };
        g.__addCoinContractProbe = 0;
        mockReadAddressAsContract.mockReset();
        mockReadAddressAsContract.mockImplementation(async () => {
            g.__addCoinContractProbe = 0;
            return {
                contractCode: '0xabcd',
                isContractLikeAddress: true,
                isPrecompileOrSystemAddress: false,
                contractAddressType: 'deployed_contract',
            };
        });

        jest.mocked(logger.error).mockClear();
        mockEmit.mockClear();

        mockThunkDispatch.mockClear();
        jest.mocked(useAppDispatch).mockReturnValue(mockThunkDispatch);

        setupSelectors();
        onClosePress.mockClear();
    });

    async function renderOpen(props?: Partial<React.ComponentProps<typeof AddCustomCoinModal>>) {
        const utils = render(
            <MemoryRouter>
                <AddCustomCoinModal
                    visible
                    walletAddress={WALLET}
                    onClosePress={onClosePress}
                    {...props}
                />
            </MemoryRouter>,
        );

        await screen.findByText('Add Custom Token');
        return utils;
    }

    it('does not render content when invisible', () => {
        render(
            <MemoryRouter>
                <AddCustomCoinModal visible={false} onClosePress={onClosePress} />
            </MemoryRouter>,
        );

        expect(screen.queryByText('Add Custom Token')).not.toBeInTheDocument();
    });

    it('shows invalid address error for non-address input', async () => {
        await renderOpen();
        fireEvent.change(screen.getByPlaceholderText('0xabc...'), { target: { value: 'bad' } });

        await waitFor(() => {
            expect(screen.getByText('Invalid address format')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: /^ADD$/i })).toBeDisabled();
    });

    it('shows invalid token contract when address is valid but readAddress fails', async () => {
        mockReadAddressAsContract.mockImplementationOnce(async () => ({
            contractCode: null,
            isContractLikeAddress: false,
            isPrecompileOrSystemAddress: false,
            contractAddressType: 'eoa_or_unknown',
        }));
        await renderOpen();

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await waitFor(() => {
            expect(
                screen.getByText(/Invalid token contract\. Must be ERC20, ERC721, or ERC1155\./),
            ).toBeInTheDocument();
        });
    });

    it('shows invalid token contract when provider is unavailable', async () => {
        jest.mocked(useSelectedNetwork).mockReturnValue(undefined);
        await renderOpen();

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await waitFor(() => {
            expect(
                screen.getByText(/Invalid token contract\. Must be ERC20, ERC721, or ERC1155\./),
            ).toBeInTheDocument();
        });
    });

    it('shows ERC20 token details and enables ADD when valid', async () => {
        await renderOpen();

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await waitFor(() => {
            expect(screen.getByText('ERC20')).toBeInTheDocument();
            expect(screen.getByText('My Token')).toBeInTheDocument();
            expect(screen.getByText('MT')).toBeInTheDocument();
            expect(screen.getByText(/^18$/)).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: /^ADD$/i })).not.toBeDisabled();
    });

    it('shows ERC721 token details when ERC20 probes fail', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__addCustomCoinModalEthersCfg.erc20Fails = true;

        await renderOpen();

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await waitFor(() => {
            expect(screen.getByText('ERC721')).toBeInTheDocument();
            expect(screen.getByText('Cool NFT')).toBeInTheDocument();
            expect(screen.getByText('CNFT')).toBeInTheDocument();
        });

        expect(screen.queryByText(/^Decimals:$/)).not.toBeInTheDocument();
    });

    it('shows ERC1155 token details when only ERC1155 probes succeed', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cfg = (globalThis as any).__addCustomCoinModalEthersCfg;
        cfg.erc20Fails = true;
        cfg.erc721Fails = true;

        await renderOpen({ walletAddress: WALLET });

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await waitFor(() => {
            expect(screen.getByText('ERC1155')).toBeInTheDocument();
            expect(screen.getByText('Unnamed Token')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: /^ADD$/i })).not.toBeDisabled();
    });

    it('successful add stores the token locally, emits refresh, toast and closes', async () => {
        await renderOpen();

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await screen.findByText('ERC20');

        fireEvent.click(screen.getByRole('button', { name: /^ADD$/i }));

        await settleLatestAddPromise();

        expect(mockSetPreferences).toHaveBeenCalledWith(
            expect.objectContaining({ customTokens: expect.anything() }),
        );
        await waitFor(() => expect(mockEmit).toHaveBeenCalledWith(EventType.REFRESH_WALLET));
        expect(Toast.showSuccess).toHaveBeenCalledWith('Add token succeeded.');
        expect(onClosePress).toHaveBeenCalled();
    });

    it('does nothing when ADD pressed without walletAddress', async () => {
        await renderOpen({ walletAddress: undefined });

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await screen.findByText('ERC20');

        fireEvent.click(screen.getByRole('button', { name: /^ADD$/i }));

        expect(mockSetPreferences).not.toHaveBeenCalled();
    });

    it('clears form state when modal becomes invisible', async () => {
        const { rerender } = render(
            <MemoryRouter>
                <AddCustomCoinModal
                    visible
                    walletAddress={WALLET}
                    onClosePress={onClosePress}
                />
            </MemoryRouter>,
        );

        await screen.findByText('Add Custom Token');
        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });
        await screen.findByText('ERC20');

        rerender(
            <MemoryRouter>
                <AddCustomCoinModal
                    visible={false}
                    walletAddress={WALLET}
                    onClosePress={onClosePress}
                />
            </MemoryRouter>,
        );

        rerender(
            <MemoryRouter>
                <AddCustomCoinModal visible walletAddress={WALLET} onClosePress={onClosePress} />
            </MemoryRouter>,
        );

        await screen.findByText('Add Custom Token');
        expect(screen.getByPlaceholderText('0xabc...')).toHaveValue('');
        expect(screen.queryByText('ERC20')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^ADD$/i })).toBeDisabled();
    });

    it('calls onClosePress when modal backdrop receives click', async () => {
        await renderOpen();

        const backdrop = document.querySelector('.sheet-overlay');
        expect(backdrop).toBeTruthy();
        fireEvent.click(backdrop as Element);

        expect(onClosePress).toHaveBeenCalled();
    });

    it('calls onClosePress when Header close button is pressed', async () => {
        await renderOpen();

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClosePress).toHaveBeenCalled();
    });



    it('clears trimmed-empty address without surfacing validation error', async () => {
        await renderOpen();
        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: '   ' },
        });
        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: '' },
        });

        expect(screen.queryByText('Invalid address format')).not.toBeInTheDocument();
    });

    it('shows invalid token when chain has no usable RPC URL', async () => {
        setupSelectors(mockChain({ rpcUrl: '' }));
        jest.mocked(usePreferences).mockReturnValue({
            customNetworks: [],
            rpcUrls: {},
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        await renderOpen();

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await waitFor(() => {
            expect(
                screen.getByText(/Invalid token contract\. Must be ERC20, ERC721, or ERC1155\./),
            ).toBeInTheDocument();
        });
    });

    it('logs and surfaces error when readAddressAsContract rejects', async () => {
        mockReadAddressAsContract.mockRejectedValueOnce(new Error('rpc error'));

        await renderOpen();

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await waitFor(() => {
            expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
                'detectTokenType',
                expect.any(Error),
            );
        });

        await waitFor(() => {
            expect(
                screen.getByText(/Invalid token contract\. Must be ERC20, ERC721, or ERC1155\./),
            ).toBeInTheDocument();
        });
    });

    it('returns null and shows invalid token when ERC20/ERC721/ERC1155 all fail', async () => {
        // Configure all probes to fail
        // Override the contract spy to always return rejecting mocks.
        contractSpy?.mockRestore();
        contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(
            function () {
                return {
                    name: jest.fn().mockRejectedValue(new Error('fail')),
                    symbol: jest.fn().mockRejectedValue(new Error('fail')),
                    decimals: jest.fn().mockRejectedValue(new Error('fail')),
                    balanceOf: jest.fn().mockRejectedValue(new Error('fail')),
                };
            } as unknown as typeof ethers.Contract,
        );
        await renderOpen();
        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });
        await waitFor(() => {
            expect(
                screen.getByText(/Invalid token contract\. Must be ERC20, ERC721, or ERC1155\./),
            ).toBeInTheDocument();
        });
    });

    it('falls back to empty defaults when preferences omit customNetworks and rpcUrls', async () => {
        jest.mocked(usePreferences).mockReturnValue({} as any);
        await renderOpen();
        // Just opening the modal already evaluates the destructured defaults
        // const { customNetworks = [], rpcUrls = {} } = usePreferences().
        expect(screen.getByText('Add Custom Token')).toBeInTheDocument();
    });

    it('falls back to empty strings for ERC20 name/symbol when contract returns falsy', async () => {
        contractSpy?.mockRestore();
        contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(
            function (this: unknown) {
                return {
                    name: jest.fn().mockResolvedValue(''),
                    symbol: jest.fn().mockResolvedValue(''),
                    decimals: jest.fn().mockResolvedValue(BigInt(18)),
                };
            } as unknown as typeof ethers.Contract,
        );
        await renderOpen();
        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });
        await screen.findByText('ERC20');
    });

    it('shows loading state while token detection is in progress', async () => {
        let finishRead!: (value: {
            contractCode: string;
            isContractLikeAddress: boolean;
            isPrecompileOrSystemAddress: boolean;
            contractAddressType: string;
        }) => void;

        mockReadAddressAsContract.mockImplementation(
            () =>
                new Promise(resolve => {
                    finishRead = value => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (globalThis as any).__addCoinContractProbe = 0;
                        resolve(value);
                    };
                }),
        );

        await renderOpen();

        fireEvent.change(screen.getByPlaceholderText('0xabc...'), {
            target: { value: TOKEN_ADDR },
        });

        await waitFor(() => {
            expect(screen.getByText('Checking token contract...')).toBeInTheDocument();
        });

        finishRead!({
            contractCode: '0xabcd',
            isContractLikeAddress: true,
            isPrecompileOrSystemAddress: false,
            contractAddressType: 'deployed_contract',
        });

        await screen.findByText('ERC20');
    });
});
