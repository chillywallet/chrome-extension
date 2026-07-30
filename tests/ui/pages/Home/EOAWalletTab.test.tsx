import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EOAWalletTab from '../../../../src/ui/pages/Home/EOAWalletTab';
import { renderWithHomeProviders } from './fixtures/homeHarness';
import { DEFAULT_CHAIN } from '../../../../src/lib/ChainsUtils';
import eventManager from '../../../../src/shared/utils/eventManager';
import EventType from '../../../../src/shared/types/EventType';
import {
    FIAT_OFF_RAMP_ROUTE,
    FIAT_ON_RAMP_ROUTE,
} from '../../../../src/shared/constants/routes';

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

jest.mock('../../../../src/shared/utils/portfolio', () => ({
    getCoinHoldings: () => Promise.resolve({ assets: { groupByCoins: [] } }),
    getNftHoldings: () => Promise.resolve({ nfts: [], pagination: null }),
    getTransactionHistory: () =>
        Promise.resolve({ data: [], pagination: { page: 1, hasNextPage: false } }),
    importPortfolioWallet: () => {},
}));

jest.mock('../../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: {
        fetchPortfolioCoins: () => {},
        getCoinsByTokenAddresses: () => Promise.resolve({}),
    },
}));

jest.mock('../../../../src/ui/components/CoinPortfolio', () => ({
    __esModule: true,
    default: () => <div data-testid="coin-portfolio" />,
}));
jest.mock('../../../../src/ui/components/NFTPortfolio', () => ({
    __esModule: true,
    default: () => <div data-testid="nft-portfolio" />,
}));
jest.mock('../../../../src/ui/components/TransactionPortfolio', () => ({
    __esModule: true,
    default: () => <div data-testid="tx-portfolio" />,
}));

// Render context menu inline so we can directly trigger its items.
jest.mock('../../../../src/ui/components/ContextMenu', () => {
    const React = require('react');
    const ContextMenuItem = ({ title, onClick }: any) => (
        <button data-ctx-item={title} onClick={onClick}>
            {title}
        </button>
    );
    const ContextMenu = ({ id, menus, placeholder }: any) => (
        <div id={id}>
            {placeholder}
            {menus}
        </div>
    );
    return { __esModule: true, default: ContextMenu, ContextMenuItem };
});

const mockGetEnvironmentType = jest.fn(() => 'popup');
jest.mock('../../../../src/shared/utils/utils', () => ({
    ...jest.requireActual('../../../../src/shared/utils/utils'),
    getEnvironmentType: () => mockGetEnvironmentType(),
}));

// Allow per-test override of useSelectedNetwork to exercise the no-explorer_url branch.
const _selectorOverrides: any = { selectedNetwork: null };
jest.mock('../../../../src/store/selectors', () => {
    const actual = jest.requireActual('../../../../src/store/selectors');
    return {
        ...actual,
        useSelectedNetwork: () => {
            if (_selectorOverrides.selectedNetwork) {
                return _selectorOverrides.selectedNetwork;
            }
            return actual.useSelectedNetwork();
        },
    };
});

const props = {
    setIsShowConnectedSites: jest.fn(),
    onTransactionPress: jest.fn(),
    onPendingTransactionPress: jest.fn(),
    setCancelSpeedUpTxData: jest.fn(),
};

const baseGlobal = {
    preferences: {
        smartWalletEnabled: true,
        bridgeUrl: 'https://example.test/bridge',
        earnEnabled: true,
        // Buy/Sell ship disabled (FEATURE_FLAGS in src/config/defaults.ts); these tests
        // cover the enabled path, so opt in explicitly.
        buyEnabled: true,
        sellEnabled: true,
        earnList: [{ platformId: DEFAULT_CHAIN.platform_id }] as any,
    },
};

describe('EOAWalletTab', () => {
    beforeEach(() => {
        mockGetEnvironmentType.mockReturnValue('popup');
        (global as any).platform = {
            openLink: jest.fn(),
            openExtensionInBrowser: jest.fn(),
            isRunningInIncognito: jest.fn().mockResolvedValue(false),
        };
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
        });
        props.setIsShowConnectedSites.mockReset();
    });

    it('renders legacy wallet header and action buttons', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Buy');
        expect(screen.getByText('Sell')).toBeInTheDocument();
        expect(screen.getByText('Send')).toBeInTheDocument();
        expect(screen.getByText('Swap')).toBeInTheDocument();
        expect(screen.getByText('Earn')).toBeInTheDocument();
        expect(screen.getByText('Bridge')).toBeInTheDocument();
    });

    it('copies address when address button clicked', async () => {
        const { container } = render(
            renderWithHomeProviders(<EOAWalletTab {...props} />),
        );
        // Rendered without baseGlobal, so the fiat flags are off — anchor on Send.
        await screen.findByText('Send');

        const addrBtn = container.querySelector('[data-tooltip-content="Click to Copy Address"]');
        expect(addrBtn).toBeTruthy();
        await userEvent.click(addrBtn as Element);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('opens fiat on-ramp via extension when in popup', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Buy');

        fireEvent.click(screen.getByText('Buy'));
        expect((global as any).platform.openExtensionInBrowser).toHaveBeenCalledWith(
            FIAT_ON_RAMP_ROUTE,
        );

        fireEvent.click(screen.getByText('Sell'));
        expect((global as any).platform.openExtensionInBrowser).toHaveBeenCalledWith(
            FIAT_OFF_RAMP_ROUTE,
        );
    });

    it('pushes fiat route via history when in fullscreen', async () => {
        mockGetEnvironmentType.mockReturnValue('fullscreen');
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Buy');
        fireEvent.click(screen.getByText('Buy'));
        // history.push won't surface a side effect we can read trivially here,
        // but we can ensure the popup-only openExtensionInBrowser was NOT called.
        expect((global as any).platform.openExtensionInBrowser).not.toHaveBeenCalled();
    });

    it('opens external bridge when bridgeUrl set', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Bridge');

        fireEvent.click(screen.getByText('Bridge'));
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            'https://example.test/bridge',
            '_blank',
        );
    });

    it('disables bridge button when no bridgeUrl', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: { preferences: { bridgeUrl: '' } } },
            }),
        );
        await screen.findByText('Bridge');
        const btn = screen.getByText('Bridge').closest('button');
        expect(btn).toBeDisabled();
    });

    it('hides Earn button when earn list does not include current network', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: {
                    globalState: {
                        // Use a platformId that doesn't match the current network.
                        preferences: {
                            earnEnabled: true,
                            earnList: [{ platformId: 9999 }] as any,
                            bridgeUrl: '',
                        },
                    },
                },
            }),
        );
        // Anchor on Send: it is unconditional, unlike Buy which is feature-flagged.
        await screen.findByText('Send');
        expect(screen.queryByText('Earn')).not.toBeInTheDocument();
    });

    it('hides Earn button when earnEnabled is false', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: {
                    globalState: {
                        preferences: {
                            earnEnabled: false,
                            earnList: [{ platformId: DEFAULT_CHAIN.platform_id }] as any,
                            bridgeUrl: '',
                        },
                    },
                },
            }),
        );
        await screen.findByText('Send');
        expect(screen.queryByText('Earn')).not.toBeInTheDocument();
    });

    it('hides Buy and Sell when the fiat feature flags are off', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: {
                    globalState: {
                        preferences: {
                            ...baseGlobal.preferences,
                            buyEnabled: false,
                            sellEnabled: false,
                        },
                    },
                },
            }),
        );
        await screen.findByText('Send');
        expect(screen.queryByText('Buy')).not.toBeInTheDocument();
        expect(screen.queryByText('Sell')).not.toBeInTheDocument();
    });

    it('calls onCoinSendPress when Send pressed', async () => {
        const onCoinSendPress = jest.fn();
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                routes: { onCoinSendPress },
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Send');
        fireEvent.click(screen.getByText('Send'));
        expect(onCoinSendPress).toHaveBeenCalled();
    });

    it('calls onCoinSwapPress when Swap pressed', async () => {
        const onCoinSwapPress = jest.fn();
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                routes: { onCoinSwapPress },
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Swap');
        fireEvent.click(screen.getByText('Swap'));
        expect(onCoinSwapPress).toHaveBeenCalled();
    });

    it('opens wallet address modal via the Receive tile', async () => {
        const spy = jest.spyOn(eventManager, 'emit');
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Buy');

        const receiveBtn = screen.getByText('Receive').closest('button');
        expect(receiveBtn).toBeTruthy();
        fireEvent.click(receiveBtn as Element);
        expect(spy).toHaveBeenCalledWith(
            EventType.SHOW_WALLET_ADDRESS_MODAL,
            expect.objectContaining({ isSmartWallet: false }),
        );
        spy.mockRestore();
    });

    it('context menu: View on Explorer opens explorer URL', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('View on Explorer');
        fireEvent.click(screen.getByText('View on Explorer'));
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            expect.stringContaining('/address/'),
        );
    });

    it('context menu: Connected Sites sets show flag', async () => {
        const setIsShowConnectedSites = jest.fn();
        render(
            renderWithHomeProviders(
                <EOAWalletTab {...props} setIsShowConnectedSites={setIsShowConnectedSites} />,
                { state: { globalState: baseGlobal } },
            ),
        );
        await screen.findByText('Connected Sites');
        fireEvent.click(screen.getByText('Connected Sites'));
        expect(setIsShowConnectedSites).toHaveBeenCalledWith({ isShowConnectedSites: true });
    });

    it('context menu: Reveal Seed Phrase, View Private Key, Add Custom Token emit events', async () => {
        const spy = jest.spyOn(eventManager, 'emit');
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Reveal Seed Phrase');

        fireEvent.click(screen.getByText('Reveal Seed Phrase'));
        expect(spy).toHaveBeenCalledWith(EventType.SHOW_SEED_PHRASE_MODAL, expect.any(Object));

        fireEvent.click(screen.getByText('View Private Key'));
        expect(spy).toHaveBeenCalledWith(EventType.SHOW_PRIVATE_KEY_MODAL, expect.any(Object));

        fireEvent.click(screen.getByText('Add Custom Token'));
        expect(spy).toHaveBeenCalledWith(
            EventType.SHOW_ADD_CUSTOM_COIN_MODAL,
            expect.any(String),
        );
        spy.mockRestore();
    });

    it('triggers refresh wallet on refresh icon click', async () => {
        const { container } = render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Buy');
        const refreshBtn = container.querySelector('#refresh-wallet');
        expect(refreshBtn).toBeTruthy();
        fireEvent.click(refreshBtn as Element);
        // no throw is sufficient; loadData re-runs the portfolio fetches.
    });

    it('navigates to earn route when Earn pressed', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
            }),
        );
        await screen.findByText('Earn');
        fireEvent.click(screen.getByText('Earn'));
        // history.push runs through MemoryRouter — no error is sufficient.
        expect((global as any).platform.openExtensionInBrowser).not.toHaveBeenCalled();
    });

    it('disables Swap button on a network without swap support (Sepolia)', async () => {
        // Sepolia has swapSupport: false; selectedNetwork.chain_id resolves it via
        // getCurrentChainByChainId inside useSelectedNetwork.
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: {
                    globalState: {
                        ...baseGlobal,
                        selectedNetwork: { chain_id: 11155111 } as any,
                    },
                },
            }),
        );
        await screen.findByText('Swap');
        const swapBtn = screen.getByText('Swap').closest('button');
        expect(swapBtn).toBeDisabled();
    });

    it('disables Buy/Sell on a testnet (Sepolia)', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: {
                    globalState: {
                        ...baseGlobal,
                        selectedNetwork: { chain_id: 11155111 } as any,
                    },
                },
            }),
        );
        await screen.findByText('Buy');
        const buyBtn = screen.getByText('Buy').closest('button');
        const sellBtn = screen.getByText('Sell').closest('button');
        expect(buyBtn).toBeDisabled();
        expect(sellBtn).toBeDisabled();
    });

    it('falls back to the raw address when getAddress throws (covers checksum catch)', async () => {
        const harness = renderWithHomeProviders(<EOAWalletTab {...props} />, {
            state: {
                globalState: {
                    ...baseGlobal,
                    internalAccounts: {
                        accounts: {
                            'account-1': {
                                id: 'account-1',
                                // Invalid address: getAddress will throw, catch returns this raw value
                                address: 'invalid',
                                type: 'eip155:eoa',
                                options: {},
                                methods: [],
                                metadata: {
                                    name: 'Bad Address',
                                    importTime: 1,
                                    keyring: { type: 'HD Key Tree' },
                                },
                            } as any,
                        },
                        selectedAccount: 'account-1',
                    },
                },
            },
        });
        render(harness);
        await screen.findByText('Buy');
        // smartTrim with a string shorter than 15 leaves it untouched.
        expect(screen.getByText('invalid')).toBeInTheDocument();
    });

    it('renders the NFTs tab when selected', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
                routes: { subTabIndex: 1 },
            }),
        );
        await screen.findByTestId('nft-portfolio');
    });


    it('calls setSubTabIndex when a tab is clicked', async () => {
        const setSubTabIndex = jest.fn();
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: { globalState: baseGlobal },
                routes: { setSubTabIndex, subTabIndex: 0 },
            }),
        );
        await screen.findByText('Collectibles');
        fireEvent.click(screen.getByText('Collectibles'));
        expect(setSubTabIndex).toHaveBeenCalled();
    });

    it('hides View on Explorer menu item when selectedNetwork has no explorer_url', async () => {
        _selectorOverrides.selectedNetwork = {
            ...DEFAULT_CHAIN,
            explorer_url: '',
            swapSupport: true,
        };
        try {
            render(
                renderWithHomeProviders(<EOAWalletTab {...props} />, {
                    state: { globalState: baseGlobal },
                }),
            );
            await screen.findByText('Buy');
            // View on Explorer should be ABSENT.
            expect(screen.queryByText('View on Explorer')).not.toBeInTheDocument();
        } finally {
            _selectorOverrides.selectedNetwork = null;
        }
    });

    it('handles bridge action with no bridgeUrl (covers falsy bridge branch in onActionButtonPress)', async () => {
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: {
                    globalState: { preferences: { bridgeUrl: '' } },
                },
            }),
        );
        await screen.findByText('Bridge');
        const bridgeBtn = screen.getByText('Bridge').closest('button') as HTMLButtonElement;
        expect(bridgeBtn).toBeDisabled();
        // dispatchEvent skips disabled-suppression of jsdom's button.click() in some envs.
        // Use mouseEvent dispatch to invoke React's onClick directly.
        bridgeBtn.removeAttribute('disabled');
        (bridgeBtn as any).disabled = false;
        bridgeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        // openLink should NOT have been called since bridgeUrl is empty.
        expect((global as any).platform.openLink).not.toHaveBeenCalled();
    });

    it('handles a null currentAccount (covers checksum fallback and conditional rendering)', async () => {
        // Render without a selected account or wallet so currentAccount and currentWallet are null.
        render(
            renderWithHomeProviders(<EOAWalletTab {...props} />, {
                state: {
                    globalState: {
                        ...baseGlobal,
                        internalAccounts: {
                            accounts: {},
                            selectedAccount: null,
                        },
                        internalWallets: {
                            wallets: {},
                            selectedWallet: null,
                        },
                    },
                },
            }),
        );
        await screen.findByText('Buy');

        // Context menu items present even without a current account
        fireEvent.click(screen.getByText('View on Explorer'));
        fireEvent.click(screen.getByText('Add Custom Token'));
        // QR button click with no current account.
        const qrBtn = document.querySelector('button.absolute.top-4');
        if (qrBtn) {
            fireEvent.click(qrBtn);
        }
        // No throw is sufficient.
    });
});
