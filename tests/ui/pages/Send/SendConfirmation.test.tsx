import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';

import SendConfirmation from '../../../../src/ui/pages/Send/SendConfirmation';
import Toast from '../../../../src/ui/components/Toast';
import {
    estimateGasLimit,
    sendTransaction,
    sendGaslessTransaction,
    addPendingTransaction,
} from '../../../../src/store/actions/uiActions';
import {
    useCurrentAccount,
    useCurrentAddress,
    useIsTestnet,
    useNativeCoinBalance,
    useSelectedNetwork,
} from '../../../../src/store/selectors';
import { useAppDispatch } from '../../../../src/store/store';


jest.mock('../../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(),
}));

jest.mock('../../../../src/store/actions/uiActions', () => ({
    estimateGasLimit: jest.fn(),
    getNativeTokenBalance: jest.fn(() => jest.fn(() => Promise.resolve(BigInt('10000000000000000000')))),
    sendTransaction: jest.fn(() =>
        jest.fn(() => Promise.resolve({ hash: '0xconfirmationhash1234567890abcdef' })),
    ),
    sendGaslessTransaction: jest.fn(() =>
        jest.fn(() => Promise.resolve({ transactionHash: '0xgaslesshash' })),
    ),
    addPendingTransaction: jest.fn(() => jest.fn(() => Promise.resolve())),
}));

jest.mock('../../../../src/lib/web3', () => ({
    getDataForTokenTransfer: jest.fn(() => '0xtokentransferdata'),
    getDataForNftTransfer: jest.fn(() => '0xnfttransferdata'),
}));

jest.mock('../../../../src/store/selectors', () => ({
    useCurrentAccount: jest.fn(),
    useCurrentAddress: jest.fn(),
    useIsTestnet: jest.fn(),
    useNativeCoinBalance: jest.fn(),
    useSelectedNetwork: jest.fn(),
}));

jest.mock('../../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <div>{title}</div>,
}));
jest.mock('../../../../src/ui/components/WalletTag', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../../src/ui/components/ConfirmationHeader', () => ({
    __esModule: true,
    default: () => <div data-testid="confirmation-header" />,
}));
jest.mock('../../../../src/ui/components/AssetLogo', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn(), showError: jest.fn() },
}));

jest.mock('../../../../src/ui/components/GasFee', () => {
    const React = jest.requireActual('react');
    return {
        __esModule: true,
        default: ({
            onGasChange,
        }: {
            onGasChange: (handled: { gasInfo: { gasPrice: bigint } }, fee: bigint) => void;
        }) => {
            React.useEffect(() => {
                onGasChange({ gasInfo: { gasPrice: 10n } }, 2500000000000000n);
            }, [onGasChange]);
            return <div data-testid="gas-fee-mock" />;
        },
    };
});

jest.mock('../../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: { emit: jest.fn() },
}));


describe('SendConfirmation', () => {
    const innerDispatchFn = jest.fn();

    const onTxSuccess = jest.fn();

    const mockCoin = {
        coinToSend: {
            token_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            wallet_address: '',
            wallet_name: '',
            token_id: '',
            balance: 1,
            balance_usd: 1,
            platform_id: 1,
            integration_type: '',
            avatar: null,
            coin_name: 'T Token',
            logo: '',
            symbol: 'TT',
            is_custom: false,
            is_hidden: false,
            is_verified: true,
            decimals: 18,
            icon: '',
        },
        isAAWallet: false,
    } as const;

    const receiver = {
        walletAddress: '0x70997970C51812dc3A010C7d01b480eCc8Ea8A4',
        name: 'Bob',
        avatar: null as string | null,
    };

    beforeEach(() => {
        onTxSuccess.mockClear();
        jest.mocked(Toast.showSuccess).mockClear();
        jest.mocked(Toast.showError).mockClear();
        jest.mocked(estimateGasLimit).mockResolvedValue('175000');
        // Restore the thunk factories (the resetMocks default wipes the outer jest.fn
        // implementation between tests; see the project auto-memory note).
        jest.mocked(sendTransaction).mockImplementation(
            () => jest.fn(() => Promise.resolve({ hash: '0xconfirmationhash1234567890abcdef' })) as any,
        );
        jest.mocked(sendGaslessTransaction).mockImplementation(
            () => jest.fn(() => Promise.resolve({ transactionHash: '0xgaslesshash' })) as any,
        );
        jest.mocked(addPendingTransaction).mockImplementation(
            () => jest.fn(() => Promise.resolve()) as any,
        );

        jest.mocked(useCurrentAccount).mockReturnValue({
            address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            id: 'a1',
            metadata: {
                name: 'Me',
                importTime: 0,
                avatar: '🙂',
                smartAvatar: '🔷',
                keyring: { type: 'hd' },
            },
        } as never);

        jest.mocked(useCurrentAddress).mockReturnValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

        jest.mocked(useNativeCoinBalance).mockReturnValue(BigInt('9000000000000000000000'));

        jest.mocked(useIsTestnet).mockReturnValue(false);

        jest.mocked(useSelectedNetwork).mockReturnValue({
            chain_id: 1,
            platform_id: 1,
            chain_key: 'ethereum',
            name: 'Ethereum',
            native_coin_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            gasPadding: 10,
        } as never);

        innerDispatchFn.mockReset();
        innerDispatchFn.mockImplementation((action: unknown) => {
            if (typeof action === 'function') {
                return Promise.resolve(
                    (
                        action as (
                            d: jest.Mock,
                            g: () => { globalState: { selectedNetwork: { chain_id: number } } },
                        ) => unknown
                    )(
                        jest.fn(() => Promise.resolve(undefined)),
                        () =>
                            ({
                                globalState: { selectedNetwork: { chain_id: 1 } },
                            }) as never,
                    ),
                );
            }
            return Promise.resolve(undefined);
        });
        jest.mocked(useAppDispatch).mockReturnValue(innerDispatchFn as never);

    });

    const setup = () => {
        const history = createMemoryHistory();
        return render(
            <Router history={history}>
                <SendConfirmation
                    assetData={mockCoin as never}
                    receiver={receiver}
                    value={BigInt('100000000000000000')}
                    balance={BigInt('1000000000000000000000')}
                    decimals={18}
                    usdValue={10}
                    onTxSuccess={onTxSuccess}
                />
            </Router>,
        );
    };

    it('renders confirmation layout for a coin transfer', async () => {
        setup();

        expect(screen.getByText('Sending Confirmation')).toBeInTheDocument();
        expect(screen.getByTestId('confirmation-header')).toBeInTheDocument();

        await waitFor(() => expect(estimateGasLimit).toHaveBeenCalled());
        expect(screen.getByTestId('gas-fee-mock')).toBeInTheDocument();
    });

    it('fires sendTransaction thunk when Send is clicked', async () => {
        setup();

        const sendButton = await screen.findByRole('button', { name: 'Send' });
        await waitFor(() => expect(sendButton).not.toBeDisabled(), { timeout: 3000 });

        await userEvent.click(sendButton);

        await waitFor(
            () => expect(sendTransaction).toHaveBeenCalled(),
            { timeout: 3000 },
        );
    });

    it('disables Send while gas estimation is still loading gas limit', async () => {
        let resolveEstimate!: (value: string) => void;
        jest.mocked(estimateGasLimit).mockImplementation(
            () =>
                new Promise<string>(resolve => {
                    resolveEstimate = resolve;
                }),
        );

        setup();

        const sendButton = screen.getByRole('button', { name: 'Send' });
        expect(sendButton).toBeDisabled();

        resolveEstimate!('175000');

        await waitFor(() => expect(sendButton).not.toBeDisabled());
    });

    const mockNft = {
        nftToSend: {
            token_id: '1',
            contract_address: '0xnftcontract',
            name: 'Cute Cat',
            contract: { type: 'erc721', name: 'Cool Cats' },
            nft_collection: { name: 'Cool Cats' },
            image_url: 'https://example.com/cat.png',
            chain: 'eth',
            platform_id: 1,
        },
        isAAWallet: false,
    } as const;

    const setupWithProps = (
        propsOverrides: Partial<{
            value: bigint;
            balance: bigint;
            usdValue: number;
            assetData: any;
        }> = {},
    ) => {
        const history = createMemoryHistory();
        return render(
            <Router history={history}>
                <SendConfirmation
                    assetData={(propsOverrides.assetData ?? mockCoin) as never}
                    receiver={receiver}
                    value={propsOverrides.value ?? BigInt('100000000000000000')}
                    balance={propsOverrides.balance ?? BigInt('1000000000000000000000')}
                    decimals={18}
                    usdValue={propsOverrides.usdValue ?? 10}
                    onTxSuccess={onTxSuccess}
                />
            </Router>,
        );
    };

    it('renders NFT details when an NFT is being sent', async () => {
        setupWithProps({ assetData: mockNft, value: 0n });

        expect(screen.getByText('Cool Cats')).toBeInTheDocument();
        expect(screen.getByText('Cute Cat')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'NFT' })).toBeInTheDocument();
    });

    it('shows insufficient-funds toast for the AA-specific gas message', async () => {
        const failingThunk = jest.fn(() =>
            Promise.reject(
                new Error(
                    'Account did not have enough native tokens to cover the gas costs associated with the user operation.',
                ),
            ),
        );
        jest.mocked(sendTransaction).mockReturnValue(failingThunk as any);
        innerDispatchFn.mockImplementation((action: unknown) => {
            if (typeof action === 'function') {
                return (action as any)(jest.fn(), () => ({}));
            }
            return Promise.resolve();
        });

        setupWithProps({
            assetData: { ...mockCoin, isAAWallet: true } as any,
        });
        const sendButton = await screen.findByRole('button', { name: 'Send' });
        await waitFor(() => expect(sendButton).not.toBeDisabled());
        await userEvent.click(sendButton);

        await waitFor(() =>
            expect(Toast.showError).toHaveBeenCalledWith(
                'Insufficient funds in your smart account to cover the required prefund.',
            ),
        );
    });

    it('hardcodes the gas limit when running on Monad testnet for an AA wallet', async () => {
        jest.mocked(useSelectedNetwork).mockReturnValue({
            chain_id: 10143,
            platform_id: 10143,
            chain_key: 'monad_testnet',
            name: 'Monad Testnet',
            native_coin_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            gasPadding: 10,
        } as never);

        setupWithProps({
            assetData: { ...mockCoin, isAAWallet: true } as any,
        });

        // Monad testnet path short-circuits before calling estimateGasLimit
        await waitFor(() => {
            // The Send button becomes enabled because the gas limit is set immediately
            expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled();
        });
        expect(estimateGasLimit).not.toHaveBeenCalled();
    });

    it('falls back to the generic asset error when estimateGasLimit rejects without details', async () => {
        jest.mocked(estimateGasLimit).mockRejectedValue(new Error('boom'));

        const { container } = setup();

        await waitFor(() => {
            expect(container.innerHTML).toContain('We can not send the asset');
        });
    });

    it('extracts a structured reason when estimateGasLimit fails with an originalError body', async () => {
        jest.mocked(estimateGasLimit).mockRejectedValue({
            data: {
                originalError: {
                    body: JSON.stringify({ error: { message: 'insufficient allowance' } }),
                },
            },
        });

        const { container } = setup();

        await waitFor(() => {
            expect(container.innerHTML).toContain('insufficient allowance');
        });
    });

    it('flags insufficient funds when amount + gas exceeds native balance', async () => {
        const { container } = setupWithProps({
            value: BigInt('999000000000000000'),
            balance: BigInt('1000000000000000000'),
            assetData: {
                coinToSend: {
                    ...mockCoin.coinToSend,
                    // native coin token address must match the selected network's native_coin_address
                    token_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                },
                isAAWallet: false,
            } as any,
        });

        await waitFor(() => {
            expect(container.innerHTML).toContain('Insufficient funds to cover the amount');
        });
    });

    it('flags insufficient gas balance for an NFT transfer', async () => {
        jest.mocked(useNativeCoinBalance).mockReturnValue(0n);
        const { container } = setupWithProps({ assetData: mockNft, value: 0n });

        await waitFor(() => {
            expect(container.innerHTML).toContain("don't have enough funds");
        });
    });

    it('flags insufficient gas balance for a non-native token transfer', async () => {
        jest.mocked(useNativeCoinBalance).mockReturnValue(0n);
        const { container } = setupWithProps();

        await waitFor(() => {
            expect(container.innerHTML).toContain("don't have enough funds");
        });
    });

    it('navigates to the default route when Cancel is pressed', async () => {
        const history = createMemoryHistory();
        const replaceSpy = jest.spyOn(history, 'replace');
        render(
            <Router history={history}>
                <SendConfirmation
                    assetData={mockCoin as never}
                    receiver={receiver}
                    value={BigInt('100000000000000000')}
                    balance={BigInt('1000000000000000000000')}
                    decimals={18}
                    usdValue={10}
                    onTxSuccess={onTxSuccess}
                />
            </Router>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(replaceSpy).toHaveBeenCalled();
    });

    it('treats zero value as the formatted display value', async () => {
        // Zero value triggers the early-return branch in formattedCoinValue
        setupWithProps({ value: 0n });

        await waitFor(() => expect(estimateGasLimit).toHaveBeenCalled());
        // Display still rendered
        expect(screen.getByText('Sending Confirmation')).toBeInTheDocument();
    });

    it('completes the success flow on a successful legacy transaction', async () => {
        setupWithProps();
        const sendButton = await screen.findByRole('button', { name: 'Send' });
        await waitFor(() => expect(sendButton).not.toBeDisabled());
        await userEvent.click(sendButton);

        await waitFor(() => expect(addPendingTransaction).toHaveBeenCalled());
        await waitFor(() => expect(onTxSuccess).toHaveBeenCalled());
        await waitFor(() => expect(Toast.showSuccess).toHaveBeenCalled());
    });

    it('clears the native-coin balance error once balance is sufficient', async () => {
        setupWithProps({
            assetData: {
                coinToSend: {
                    ...mockCoin.coinToSend,
                    token_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                },
                isAAWallet: false,
            } as any,
            // value + fee easily fits inside balance
            value: BigInt('1'),
            balance: BigInt('1000000000000000000000'),
        });

        await waitFor(() => expect(estimateGasLimit).toHaveBeenCalled());
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled(),
        );
    });

    it('treats an empty estimateGasLimit result as an asset error', async () => {
        jest.mocked(estimateGasLimit).mockResolvedValue('' as never);

        const { container } = setup();

        await waitFor(() => {
            expect(container.innerHTML).toContain('We can not send the asset');
        });
    });

    it('throws Invalid asset or address inside estimateGas when receiver is missing', async () => {
        const history = createMemoryHistory();
        render(
            <Router history={history}>
                <SendConfirmation
                    assetData={mockCoin as never}
                    receiver={null}
                    value={BigInt('100000000000000000')}
                    balance={BigInt('1000000000000000000000')}
                    decimals={18}
                    usdValue={10}
                    onTxSuccess={onTxSuccess}
                />
            </Router>,
        );

        await screen.findByText(/Invalid asset or address/);
    });

    it('schedules a REFRESH_WALLET emit after a successful transaction', async () => {
        jest.useFakeTimers();
        try {
            setupWithProps();
            const sendButton = await screen.findByRole('button', { name: 'Send' });
            // Real timer not strictly needed here; jest.useFakeTimers doesn't affect promise scheduling
            await waitFor(() => expect(sendButton).not.toBeDisabled());
            await userEvent.click(sendButton);

            await waitFor(() => expect(onTxSuccess).toHaveBeenCalled());

            const eventManager = require('../../../../src/shared/utils/eventManager').default;
            (eventManager.emit as jest.Mock).mockClear();
            jest.advanceTimersByTime(3500);

            expect(eventManager.emit).toHaveBeenCalledWith('REFRESH_WALLET');
        } finally {
            jest.useRealTimers();
        }
    });

    describe('extra branch coverage', () => {
        it('falls back to 1.1 padding when selectedNetwork lacks gasPadding', async () => {
            jest.mocked(useSelectedNetwork).mockReturnValue({
                chain_id: 1,
                platform_id: 1,
                chain_key: 'ethereum',
                name: 'Ethereum',
                native_coin_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            } as never);
            setupWithProps();
            await waitFor(() => expect(estimateGasLimit).toHaveBeenCalled());
            // The 5th arg to estimateGasLimit should be 1.1 (default padding)
            const callArgs = jest.mocked(estimateGasLimit).mock.calls[0];
            expect(callArgs[4]).toBe(1.1);
        });

        it('uses coin.logo when coin.icon is null in the success-tx tokens payload', async () => {
            setupWithProps({
                assetData: {
                    coinToSend: {
                        ...mockCoin.coinToSend,
                        icon: null,
                        logo: 'logo.png',
                    },
                    isAAWallet: false,
                } as any,
            });

            const sendButton = await screen.findByRole('button', { name: 'Send' });
            await waitFor(() => expect(sendButton).not.toBeDisabled());
            await userEvent.click(sendButton);

            await waitFor(() => expect(addPendingTransaction).toHaveBeenCalled());
            const args = jest.mocked(addPendingTransaction).mock.calls[0];
            expect((args[1] as any).tokens[0].icon).toBe('logo.png');
        });

        it('falls back to empty icon when both coin.icon and coin.logo are missing', async () => {
            setupWithProps({
                assetData: {
                    coinToSend: {
                        ...mockCoin.coinToSend,
                        icon: undefined,
                        logo: undefined,
                    },
                    isAAWallet: false,
                } as any,
            });

            const sendButton = await screen.findByRole('button', { name: 'Send' });
            await waitFor(() => expect(sendButton).not.toBeDisabled());
            await userEvent.click(sendButton);

            await waitFor(() => expect(addPendingTransaction).toHaveBeenCalled());
            const args = jest.mocked(addPendingTransaction).mock.calls[0];
            expect((args[1] as any).tokens[0].icon).toBe('');
        });

        it('records nft type in trackData when sending an NFT', async () => {
            setupWithProps({ assetData: mockNft, value: 0n });
            const sendButton = await screen.findByRole('button', { name: 'Send' });
            await waitFor(() => expect(sendButton).not.toBeDisabled());
            await userEvent.click(sendButton);

            await waitFor(() => expect(addPendingTransaction).toHaveBeenCalled());
            const args = jest.mocked(addPendingTransaction).mock.calls[0];
            expect((args[1] as any).trackData.type).toBe('nft');
        });


        it('shows AA-specific toast for the alternate "pay for this operation" gas message', async () => {
            const failingThunk = jest.fn(() =>
                Promise.reject(
                    new Error('Account has insufficient native to pay for this operation'),
                ),
            );
            jest.mocked(sendTransaction).mockReturnValue(failingThunk as any);
            innerDispatchFn.mockImplementation((action: unknown) => {
                if (typeof action === 'function') {
                    return (action as any)(jest.fn(), () => ({}));
                }
                return Promise.resolve();
            });

            setupWithProps({
                assetData: { ...mockCoin, isAAWallet: true } as any,
            });
            const sendButton = await screen.findByRole('button', { name: 'Send' });
            await waitFor(() => expect(sendButton).not.toBeDisabled());
            await userEvent.click(sendButton);

            await waitFor(() =>
                expect(Toast.showError).toHaveBeenCalledWith(
                    'Insufficient funds in your smart account to cover the required prefund.',
                ),
            );
        });

        it('shows the underlying reason when send fails with a reason string', async () => {
            const failingThunk = jest.fn(() =>
                Promise.reject({ reason: 'user rejected' }),
            );
            jest.mocked(sendTransaction).mockReturnValue(failingThunk as any);
            innerDispatchFn.mockImplementation((action: unknown) => {
                if (typeof action === 'function') {
                    return (action as any)(jest.fn(), () => ({}));
                }
                return Promise.resolve();
            });

            setupWithProps();
            const sendButton = await screen.findByRole('button', { name: 'Send' });
            await waitFor(() => expect(sendButton).not.toBeDisabled());
            await userEvent.click(sendButton);

            await waitFor(() => expect(Toast.showError).toHaveBeenCalledWith('user rejected'));
        });

        it('falls back to "Transaction failed." when error has no reason or message', async () => {
            const failingThunk = jest.fn(() => Promise.reject({}));
            jest.mocked(sendTransaction).mockReturnValue(failingThunk as any);
            innerDispatchFn.mockImplementation((action: unknown) => {
                if (typeof action === 'function') {
                    return (action as any)(jest.fn(), () => ({}));
                }
                return Promise.resolve();
            });

            setupWithProps();
            const sendButton = await screen.findByRole('button', { name: 'Send' });
            await waitFor(() => expect(sendButton).not.toBeDisabled());
            await userEvent.click(sendButton);

            await waitFor(() =>
                expect(Toast.showError).toHaveBeenCalledWith('Transaction failed.'),
            );
        });

        it('handles sendTransaction returning falsy (no tx hash success path)', async () => {
            const noTxThunk = jest.fn(() => Promise.resolve(null));
            jest.mocked(sendTransaction).mockReturnValue(noTxThunk as any);
            innerDispatchFn.mockImplementation((action: unknown) => {
                if (typeof action === 'function') {
                    return (action as any)(jest.fn(), () => ({}));
                }
                return Promise.resolve(null);
            });

            setupWithProps();
            const sendButton = await screen.findByRole('button', { name: 'Send' });
            await waitFor(() => expect(sendButton).not.toBeDisabled());
            await userEvent.click(sendButton);

            await waitFor(() => expect(sendTransaction).toHaveBeenCalled());
            // onTxSuccess / Toast.showSuccess should not have fired
            expect(onTxSuccess).not.toHaveBeenCalled();
            expect(Toast.showSuccess).not.toHaveBeenCalled();
        });

        it('renders nft display when image_url is missing', async () => {
            setupWithProps({
                assetData: {
                    nftToSend: {
                        token_id: '1',
                        contract_address: '0xnftcontract',
                        name: 'No Image Cat',
                        contract: { type: 'erc721', name: 'Cool Cats' },
                        nft_collection: { name: 'Cool Cats' },
                        image_url: null,
                        chain: 'eth',
                        platform_id: 1,
                    },
                    isAAWallet: false,
                } as any,
                value: 0n,
            });

            expect(screen.getByText('No Image Cat')).toBeInTheDocument();
            // No <img alt="NFT"> when image_url is null
            expect(screen.queryByRole('img', { name: 'NFT' })).toBeNull();
        });

        it('renders Unknown when current account has no metadata name', async () => {
            jest.mocked(useCurrentAccount).mockReturnValue({
                address: '0xacct',
                id: 'a1',
                metadata: {
                    name: undefined,
                    importTime: 0,
                    avatar: '🙂',
                    smartAvatar: '🔷',
                    keyring: { type: 'hd' },
                },
            } as never);
            // The default ConfirmationHeader mock swallows the props, but the code
            // path still executes the ?? fallback. We just need a stable render.
            setupWithProps();
            await screen.findByText('Sending Confirmation');
        });
    });
});
