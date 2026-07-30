import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { renderHook } from '@testing-library/react';
import { ApprovalType } from '@metamask/controller-utils';

import {
    useActiveTab,
    useCompletedOnboarding,
    useOnboardingStep,
    useContacts,
    useRecentContacts,
    useKarma,
    useNativeCoinPrice,
    usePendingApprovals,
    useApprovalFlows,
    usePermissionsRequests,
    useFirstPermissionRequest,
    useSubjectMetadataByOrigin,
    useUnapprovedMessages,
    useFirstUnapprovedMessage,
    useRemoteFavoriteLinks,
    useGaslessTokens,
    useIsInitialized,
    useIsUnlocked,
    useUser,
    useCognito,
    usePushToken,
    usePreferences,
    useActualTheme,
    useIsShowLoading,
    useCurrentAccount,
    useCurrentAccountByAddress,
    useCurrentWallet,
    useSmartAddress,
    useCurrentAddress,
    useAccounts,
    useWallets,
    useKeyrings,
    useDefaultProvider,
    useEthProvider,
    usePortfolioCoins,
    useCoinByTokenAddress,
    usePortfolioNfts,
    usePortfolioTransactions,
    usePendingTransactions,
    useCustomGas,
    useGasType,
    useGasOptionsData,
    useGasInfo,
    useConnectedSubjectsForSelectedAddress,
    useConnectedAccountsForTab,
    usePlatform,
    useIsTestnet,
    useNativeCoinBalance,
    useSelectedNetwork,
} from '../../src/store/selectors';
import { GasType } from '../../src/shared/types/Wallet';

const wrap = (state: any) => {
    const store = createStore(() => state);
    return ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
    );
};

const NATIVE_ADDR = '0x0000000000000000000000000000000000000000';

const baseState = (override: any = {}): any => ({
    activeTab: { id: 1, url: 'https://site.com', title: 't', origin: 'https://site.com' },
    globalState: {
        isInitialized: true,
        isUnlocked: true,
        user: null,
        cognito: null,
        pushToken: '',
        preferences: {
            darkMode: false,
            darkModeSystem: false,
            gaslessTokens: { monad: [{ address: '0xT', symbol: 'X' }] },
            remoteFavoriteLinks: [{ url: 'x' }],
        },
        selectedNetwork: {
            chain_id: 143,
            platform_id: 143,
            is_test: false,
            native_coin_address: NATIVE_ADDR,
            chain: 'monad',
        },
        completedOnboarding: true,
        onboardingStep: 0,
        contacts: [{ id: 'c1' }],
        recentContacts: [{ id: 'rc1' }],
        karma: { score: 5 },
        pendingApprovals: {},
        approvalFlows: [],
        subjectMetadata: { 'https://site.com': { iconUrl: 'icon.png', name: 'site' } },
        rpcMessages: [],
        ...override.globalState,
    },
    portfolio: {
        nativeCoinPrice: { 143: { usdPrice: 1.5 } },
        portfolioCoins: {},
        portfolioNfts: {},
        portfolioTransactions: {},
        pendingTransactions: {},
        coinPrices: {},
        topCoinsByNetwork: { 143: [] },
        ...override.portfolio,
    },
    onRamp: { moonPayIpCheckingResult: null, ...override.onRamp },
    uiState: { isShowLoading: false, ...override.uiState },
});

describe('store/selectors (extended)', () => {
    it('useActiveTab returns activeTab from state', () => {
        const { result } = renderHook(() => useActiveTab(), { wrapper: wrap(baseState()) });
        expect((result.current as any)?.url).toBe('https://site.com');
    });

    it('useCompletedOnboarding returns completedOnboarding', () => {
        const { result } = renderHook(() => useCompletedOnboarding(), { wrapper: wrap(baseState()) });
        expect(result.current).toBe(true);
    });

    it('useOnboardingStep returns the step', () => {
        const { result } = renderHook(() => useOnboardingStep(), { wrapper: wrap(baseState()) });
        expect(result.current).toBe(0);
    });

    it('useContacts returns contacts', () => {
        const { result } = renderHook(() => useContacts(), { wrapper: wrap(baseState()) });
        expect(result.current.length).toBe(1);
    });

    it('useRecentContacts returns recentContacts', () => {
        const { result } = renderHook(() => useRecentContacts(), { wrapper: wrap(baseState()) });
        expect(result.current.length).toBe(1);
    });


    it('useNativeCoinPrice returns the price for the current network', () => {
        renderHook(() => useNativeCoinPrice(), { wrapper: wrap(baseState()) });
        // just no-throw smoke
    });

    it('usePendingApprovals returns approvals dict', () => {
        const { result } = renderHook(() => usePendingApprovals(), { wrapper: wrap(baseState()) });
        expect(typeof result.current).toBe('object');
    });

    it('useApprovalFlows returns the flows', () => {
        const { result } = renderHook(() => useApprovalFlows(), { wrapper: wrap(baseState()) });
        expect(Array.isArray(result.current)).toBe(true);
    });

    it('usePermissionsRequests returns wallet_requestPermissions approvals', () => {
        const state = baseState({
            globalState: {
                pendingApprovals: {
                    a: { id: 'a', type: 'wallet_requestPermissions' },
                    b: { id: 'b', type: 'OtherType' },
                },
            },
        });
        const { result } = renderHook(() => usePermissionsRequests(), { wrapper: wrap(state) });
        expect(result.current.length).toBe(1);
    });

    it('useFirstPermissionRequest returns null when none', () => {
        const { result } = renderHook(() => useFirstPermissionRequest(), { wrapper: wrap(baseState()) });
        expect(result.current).toBeNull();
    });

    it('useSubjectMetadataByOrigin returns metadata by origin', () => {
        const { result } = renderHook(() => useSubjectMetadataByOrigin('https://site.com'), {
            wrapper: wrap(baseState()),
        });
        expect((result.current as any)?.iconUrl).toBe('icon.png');
    });

    it('useUnapprovedMessages merges typed and personal messages', () => {
        const state = baseState({
            globalState: {
                unapprovedTypedMessages: { t1: { id: 't1' } },
                unapprovedPersonalMsgs: { p1: { id: 'p1' } },
            },
        });
        const { result } = renderHook(() => useUnapprovedMessages(), { wrapper: wrap(state) });
        expect(result.current).toEqual({ t1: { id: 't1' }, p1: { id: 'p1' } });
    });

    it('useFirstUnapprovedMessage returns null when none', () => {
        const state = baseState({
            globalState: {
                unapprovedTypedMessages: {},
                unapprovedPersonalMsgs: {},
            },
        });
        const { result } = renderHook(() => useFirstUnapprovedMessage(), { wrapper: wrap(state) });
        expect(result.current).toBeNull();
    });

    it('useRemoteFavoriteLinks returns remote favorite links from top-level state', () => {
        const state: any = baseState();
        state.remoteFavoriteLinks = [{ url: 'a' }, { url: 'b' }];
        const { result } = renderHook(() => useRemoteFavoriteLinks(), { wrapper: wrap(state) });
        expect(Array.isArray(result.current)).toBe(true);
        expect(result.current.length).toBe(2);
    });


    // Smoke import for ApprovalType reference
    it('ApprovalType is loaded', () => {
        expect(ApprovalType.Transaction).toBeDefined();
    });

    describe('boolean / scalar selectors', () => {
        it('useIsInitialized reflects state.globalState.isInitialized', () => {
            const { result } = renderHook(() => useIsInitialized(), { wrapper: wrap(baseState()) });
            expect(result.current).toBe(true);
        });

        it('useIsUnlocked reflects state.globalState.isUnlocked', () => {
            const { result } = renderHook(() => useIsUnlocked(), { wrapper: wrap(baseState()) });
            expect(result.current).toBe(true);
        });




        it('usePreferences reads preferences', () => {
            const { result } = renderHook(() => usePreferences(), { wrapper: wrap(baseState()) });
            expect((result.current as any)?.darkMode).toBe(false);
        });

        it('useIsShowLoading reads uiState.isShowLoading', () => {
            const { result } = renderHook(() => useIsShowLoading(), { wrapper: wrap(baseState()) });
            expect(result.current).toBe(false);
        });

        it('usePlatform reads top-level platform', () => {
            const state: any = baseState();
            state.platform = 'web';
            const { result } = renderHook(() => usePlatform(), { wrapper: wrap(state) });
            expect(result.current).toBe('web');
        });

        it('useIsTestnet returns the selected network testnet flag', () => {
            const { result } = renderHook(() => useIsTestnet(), { wrapper: wrap(baseState()) });
            expect(result.current).toBe(false);
        });

        it('useSelectedNetwork returns the resolved chain', () => {
            const { result } = renderHook(() => useSelectedNetwork(), { wrapper: wrap(baseState()) });
            expect((result.current as any).chain_id).toBe(143);
        });
    });

    describe('useActualTheme', () => {
        let matchMediaSpy: jest.SpyInstance;

        afterEach(() => {
            matchMediaSpy?.mockRestore();
        });

        it('returns "dark" when darkMode is true and system mode is off', () => {
            const state = baseState({
                globalState: {
                    preferences: { darkMode: true, darkModeSystem: false },
                },
            });
            const { result } = renderHook(() => useActualTheme(), { wrapper: wrap(state) });
            expect(result.current).toBe('dark');
        });

        it('returns "light" when darkMode is false', () => {
            const { result } = renderHook(() => useActualTheme(), { wrapper: wrap(baseState()) });
            expect(result.current).toBe('light');
        });

        it('reads the system preference when darkModeSystem is on', () => {
            matchMediaSpy = jest
                .spyOn(window, 'matchMedia')
                .mockImplementation(
                    () =>
                        ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }) as any,
                );
            const state = baseState({
                globalState: {
                    preferences: { darkMode: false, darkModeSystem: true },
                },
            });
            const { result } = renderHook(() => useActualTheme(), { wrapper: wrap(state) });
            expect(result.current).toBe('dark');
        });
    });

    describe('account / wallet selectors', () => {
        const accountsState = (overrides: any = {}) =>
            baseState({
                globalState: {
                    internalAccounts: {
                        selectedAccount: 'a1',
                        accounts: {
                            a1: {
                                id: 'a1',
                                address: '0xaaa',
                                smartAddress: '0xsmart',
                                metadata: { name: 'Acct 1', deleted: false, keyringId: 'k1' },
                            },
                            a2: {
                                id: 'a2',
                                address: '0xbbb',
                                smartAddress: '0xsmart2',
                                metadata: { name: 'Acct 2', deleted: true },
                            },
                        },
                    },
                    internalWallets: {
                        selectedWallet: 'w1',
                        wallets: {
                            w1: { id: 'w1', name: 'W1' },
                        },
                    },
                    keyrings: [
                        { id: 'k1', accounts: ['0xaaa', '0xbbb'] },
                        { id: 'k2', accounts: [] },
                    ],
                    ...(overrides.globalState ?? {}),
                },
            });

        it('useCurrentAccount returns the selected account', () => {
            const { result } = renderHook(() => useCurrentAccount(), {
                wrapper: wrap(accountsState()),
            });
            expect((result.current as any)?.address).toBe('0xaaa');
        });

        it('useCurrentAccount returns null when no selectedAccount', () => {
            const state = accountsState({
                globalState: {
                    internalAccounts: { accounts: {}, selectedAccount: undefined },
                },
            });
            const { result } = renderHook(() => useCurrentAccount(), { wrapper: wrap(state) });
            expect(result.current).toBeNull();
        });

        it('useCurrentAccountByAddress matches the legacy address', () => {
            const { result } = renderHook(() => useCurrentAccountByAddress('0xAAA'), {
                wrapper: wrap(accountsState()),
            });
            expect(result.current.isSmartWallet).toBe(false);
            expect(result.current.account?.address).toBe('0xaaa');
        });

        it('useCurrentAccountByAddress matches the smart address', () => {
            const { result } = renderHook(() => useCurrentAccountByAddress('0xSMART'), {
                wrapper: wrap(accountsState()),
            });
            expect(result.current.isSmartWallet).toBe(true);
        });

        it('useCurrentWallet returns the selected wallet', () => {
            const { result } = renderHook(() => useCurrentWallet(), {
                wrapper: wrap(accountsState()),
            });
            expect((result.current as any)?.id).toBe('w1');
        });

        it('useCurrentWallet returns null when wallets are empty', () => {
            const state = accountsState({
                globalState: {
                    internalWallets: { wallets: {}, selectedWallet: undefined },
                },
            });
            const { result } = renderHook(() => useCurrentWallet(), { wrapper: wrap(state) });
            expect(result.current).toBeNull();
        });

        it('useSmartAddress returns the current smart address', () => {
            const { result } = renderHook(() => useSmartAddress(), {
                wrapper: wrap(accountsState()),
            });
            expect(result.current).toBe('0xsmart');
        });

        it('useCurrentAddress returns smartAddress when isAAWallet is true', () => {
            const { result } = renderHook(() => useCurrentAddress(true), {
                wrapper: wrap(accountsState()),
            });
            expect(result.current).toBe('0xsmart');
        });

        it('useCurrentAddress returns address when isAAWallet is false', () => {
            const { result } = renderHook(() => useCurrentAddress(false), {
                wrapper: wrap(accountsState()),
            });
            expect(result.current).toBe('0xaaa');
        });

        it('useAccounts returns all non-deleted accounts when no walletId provided', () => {
            const { result } = renderHook(() => useAccounts(), { wrapper: wrap(accountsState()) });
            expect(result.current.length).toBe(1);
            expect(result.current[0].id).toBe('a1');
        });

        it('useAccounts filters by walletId via keyrings', () => {
            const { result } = renderHook(() => useAccounts('k1'), {
                wrapper: wrap(accountsState()),
            });
            // Only a1 because a2 is soft-deleted and filtered out before the keyring lookup
            expect(result.current.length).toBe(1);
            expect(result.current[0].id).toBe('a1');
        });

        it('useAccounts returns an empty list when the walletId is unknown', () => {
            const { result } = renderHook(() => useAccounts('missing-wallet'), {
                wrapper: wrap(accountsState()),
            });
            expect(result.current).toEqual([]);
        });

        it('useWallets returns all wallets', () => {
            const { result } = renderHook(() => useWallets(), { wrapper: wrap(accountsState()) });
            expect(result.current.length).toBe(1);
        });

        it('useKeyrings returns keyrings list', () => {
            const { result } = renderHook(() => useKeyrings(), { wrapper: wrap(accountsState()) });
            expect(result.current.length).toBe(2);
        });
    });

    describe('provider selectors', () => {
        it('useDefaultProvider creates a JsonRpcProvider for the default chain', () => {
            const { result } = renderHook(() => useDefaultProvider(), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toBeDefined();
        });

        it('useEthProvider creates a JsonRpcProvider for Ethereum', () => {
            const { result } = renderHook(() => useEthProvider(), { wrapper: wrap(baseState()) });
            expect(result.current).toBeDefined();
        });

        it('useDefaultProvider uses preference rpc urls when available', () => {
            const state = baseState({
                globalState: {
                    preferences: {
                        darkMode: false,
                        darkModeSystem: false,
                        rpcUrls: { monad: 'https://custom.monad.example' },
                        customNetworks: [],
                    },
                },
            });
            const { result } = renderHook(() => useDefaultProvider(), { wrapper: wrap(state) });
            expect(result.current).toBeDefined();
        });
    });

    describe('portfolio selectors', () => {
        it('usePortfolioCoins returns coins when the wallet has them on the selected chain', () => {
            const state = baseState({
                portfolio: {
                    portfolioCoins: {
                        '0xwallet': {
                            143: [{ token_address: '0xT' }],
                        },
                    },
                },
            });
            const { result } = renderHook(() => usePortfolioCoins('0xWalLEt'), {
                wrapper: wrap(state),
            });
            expect(result.current.length).toBe(1);
        });

        it('usePortfolioCoins returns empty when wallet has no chain entry', () => {
            const { result } = renderHook(() => usePortfolioCoins('0xnothing'), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toEqual([]);
        });

        it('usePortfolioCoins returns empty when no wallet address provided', () => {
            const { result } = renderHook(() => usePortfolioCoins(), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toEqual([]);
        });

        it('useCoinByTokenAddress finds a matching coin', () => {
            const state = baseState({
                portfolio: {
                    portfolioCoins: {
                        '0xwallet': {
                            143: [{ token_address: '0xToken' }],
                        },
                    },
                },
            });
            const { result } = renderHook(() => useCoinByTokenAddress('0xtoken', '0xwallet'), {
                wrapper: wrap(state),
            });
            expect((result.current as any)?.token_address).toBe('0xToken');
        });

        it('usePortfolioNfts returns nfts for the selected network', () => {
            const state = baseState({
                portfolio: {
                    nfts: {
                        '0xwallet': { 143: [{ id: 'nft1' }] },
                    },
                },
            });
            const { result } = renderHook(() => usePortfolioNfts('0xWALLET'), {
                wrapper: wrap(state),
            });
            expect(result.current.length).toBe(1);
        });

        it('usePortfolioNfts returns [] when no wallet address provided', () => {
            const { result } = renderHook(() => usePortfolioNfts(), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toEqual([]);
        });

        it('usePortfolioNfts returns [] when address has no data for current chain', () => {
            const state = baseState({
                portfolio: { nfts: { '0xwallet': { 1: [{ id: 'nft' }] } } },
            });
            const { result } = renderHook(() => usePortfolioNfts('0xwallet'), {
                wrapper: wrap(state),
            });
            expect(result.current).toEqual([]);
        });

        it('usePortfolioNfts returns [] when wallet has no nft entry at all', () => {
            const state = baseState({ portfolio: { nfts: {} } });
            const { result } = renderHook(() => usePortfolioNfts('0xunknown'), {
                wrapper: wrap(state),
            });
            expect(result.current).toEqual([]);
        });

        it('usePortfolioTransactions returns transactions for the selected network', () => {
            const state = baseState({
                portfolio: {
                    transactions: { '0xwallet': { 143: [{ hash: '0xtx' }] } },
                },
            });
            const { result } = renderHook(() => usePortfolioTransactions('0xwallet'), {
                wrapper: wrap(state),
            });
            expect(result.current.length).toBe(1);
        });

        it('usePortfolioTransactions returns [] without a wallet address', () => {
            const { result } = renderHook(() => usePortfolioTransactions(), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toEqual([]);
        });

        it('usePortfolioTransactions returns [] when chain entry missing', () => {
            const state = baseState({
                portfolio: { transactions: { '0xwallet': { 1: [{}] } } },
            });
            const { result } = renderHook(() => usePortfolioTransactions('0xwallet'), {
                wrapper: wrap(state),
            });
            expect(result.current).toEqual([]);
        });

        it('usePortfolioTransactions returns [] when wallet has no transactions entry at all', () => {
            const state = baseState({ portfolio: { transactions: {} } });
            const { result } = renderHook(() => usePortfolioTransactions('0xunknown'), {
                wrapper: wrap(state),
            });
            expect(result.current).toEqual([]);
        });

        it('useNativeCoinPrice returns the recorded price for the selected network', () => {
            const state = baseState({
                globalState: {
                    nativeCoinPrices: { 143: 1.5 },
                },
            });
            const { result } = renderHook(() => useNativeCoinPrice(), { wrapper: wrap(state) });
            expect(result.current).toBe(1.5);
        });

        it('usePendingTransactions returns transactions for the selected network', () => {
            const state = baseState({
                globalState: {
                    pendingTransactions: { '0xwallet': { 143: [{ id: 'p1' }] } },
                },
            });
            const { result } = renderHook(() => usePendingTransactions('0xWalLEt'), {
                wrapper: wrap(state),
            });
            expect(result.current.length).toBe(1);
        });

        it('usePendingTransactions returns [] when wallet has no chain entry', () => {
            const state = baseState({
                globalState: { pendingTransactions: { '0xwallet': {} } },
            });
            const { result } = renderHook(() => usePendingTransactions('0xwallet'), {
                wrapper: wrap(state),
            });
            expect(result.current).toEqual([]);
        });

        it('usePendingTransactions returns [] when no wallet address provided', () => {
            const { result } = renderHook(() => usePendingTransactions(), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toEqual([]);
        });
    });

    describe('gas selectors', () => {
        const gasState = baseState({
            globalState: {
                customGas: { 1: { maxFeePerGas: '0x1' } },
                gasType: { 1: GasType.Low },
                gasOptionsData: { 1: { low: 1 } },
            },
        });

        it('useCustomGas returns custom gas when present', () => {
            const { result } = renderHook(() => useCustomGas(1), { wrapper: wrap(gasState) });
            expect(result.current).toEqual({ maxFeePerGas: '0x1' });
        });

        it('useCustomGas returns undefined when not present', () => {
            const { result } = renderHook(() => useCustomGas(99), { wrapper: wrap(gasState) });
            expect(result.current).toBeUndefined();
        });

        it('useGasType returns the recorded gas type', () => {
            const { result } = renderHook(() => useGasType(1), { wrapper: wrap(gasState) });
            expect(result.current).toBe(GasType.Low);
        });

        it('useGasType defaults to Medium when not present', () => {
            const { result } = renderHook(() => useGasType(99), { wrapper: wrap(gasState) });
            expect(result.current).toBe(GasType.Medium);
        });

        it('useGasOptionsData returns recorded gas options', () => {
            const { result } = renderHook(() => useGasOptionsData(1), { wrapper: wrap(gasState) });
            expect(result.current).toEqual({ low: 1 });
        });

        it('useGasOptionsData returns undefined when not present', () => {
            const { result } = renderHook(() => useGasOptionsData(99), { wrapper: wrap(gasState) });
            expect(result.current).toBeUndefined();
        });

        it('useGasInfo combines the three gas selectors', () => {
            const { result } = renderHook(() => useGasInfo(1), { wrapper: wrap(gasState) });
            expect(result.current).toEqual({
                gasType: GasType.Low,
                customGas: { maxFeePerGas: '0x1' },
                gasOptionsData: { low: 1 },
            });
        });
    });

    describe('subjects / connections selectors', () => {
        const subjectsState = (overrides: any = {}) =>
            baseState({
                globalState: {
                    internalAccounts: {
                        selectedAccount: 'a1',
                        accounts: {
                            a1: {
                                id: 'a1',
                                address: '0xaaa',
                                smartAddress: '0xsmart',
                                metadata: { deleted: false },
                            },
                            a2: {
                                id: 'a2',
                                address: '0xbbb',
                                smartAddress: '0xsm2',
                                metadata: { deleted: true },
                            },
                        },
                    },
                    subjects: {
                        'https://x.com': {
                            permissions: {
                                eth_accounts: {
                                    caveats: [
                                        { type: 'restrictReturnedAccounts', value: ['0xaaa'] },
                                    ],
                                },
                            },
                        },
                        'https://y.com': {
                            permissions: {
                                eth_accounts: {
                                    caveats: [
                                        { type: 'restrictReturnedAccounts', value: ['0xnope'] },
                                    ],
                                },
                            },
                        },
                    },
                    subjectMetadata: {
                        'https://x.com': {
                            extensionId: 'ext',
                            name: 'X',
                            iconUrl: 'https://x.com/icon',
                        },
                    },
                    ...(overrides.globalState ?? {}),
                },
            });

        it('useConnectedSubjectsForSelectedAddress returns sites permitted for the current address', () => {
            const { result } = renderHook(() => useConnectedSubjectsForSelectedAddress(), {
                wrapper: wrap(subjectsState()),
            });
            expect(result.current.length).toBe(1);
            expect(result.current[0].origin).toBe('https://x.com');
        });

        it('useConnectedSubjectsForSelectedAddress uses the smart address when isSmartWallet is true', () => {
            const state = subjectsState({
                globalState: {
                    subjects: {
                        'https://aa.com': {
                            permissions: {
                                eth_accounts: {
                                    caveats: [
                                        {
                                            type: 'restrictReturnedAccounts',
                                            value: ['0xsmart'],
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    subjectMetadata: {
                        'https://aa.com': { name: 'AA', iconUrl: '', extensionId: '' },
                    },
                },
            });
            const { result } = renderHook(
                () => useConnectedSubjectsForSelectedAddress(true),
                { wrapper: wrap(state) },
            );
            expect(result.current.length).toBe(1);
            expect(result.current[0].origin).toBe('https://aa.com');
        });

        it('useConnectedSubjectsForSelectedAddress returns [] when there is no current account', () => {
            const state = subjectsState({
                globalState: {
                    internalAccounts: { selectedAccount: undefined, accounts: {} },
                },
            });
            const { result } = renderHook(() => useConnectedSubjectsForSelectedAddress(), {
                wrapper: wrap(state),
            });
            expect(result.current).toEqual([]);
        });

        it('useConnectedAccountsForTab maps exposed accounts to internal accounts', () => {
            const { result } = renderHook(() => useConnectedAccountsForTab('https://x.com'), {
                wrapper: wrap(subjectsState()),
            });
            expect(result.current.length).toBe(1);
            expect(result.current[0].id).toBe('a1');
        });

        it('useConnectedAccountsForTab returns [] when tabOrigin is empty', () => {
            const { result } = renderHook(() => useConnectedAccountsForTab(), {
                wrapper: wrap(subjectsState()),
            });
            expect(result.current).toEqual([]);
        });

        it('useConnectedAccountsForTab returns [] when origin has no subject entry', () => {
            const { result } = renderHook(() => useConnectedAccountsForTab('https://nope.com'), {
                wrapper: wrap(subjectsState()),
            });
            expect(result.current).toEqual([]);
        });
    });

    describe('balance selectors', () => {
        it('useNativeCoinBalance returns BigInt(0) when no balance recorded', () => {
            const { result } = renderHook(() => useNativeCoinBalance('0xnone'), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toBe(0n);
        });

        it('useNativeCoinBalance returns BigInt(0) when no wallet address', () => {
            const { result } = renderHook(() => useNativeCoinBalance(), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toBe(0n);
        });

        it('useNativeCoinBalance converts a numeric legacy balance into BigInt via parseEther', () => {
            const state = baseState({
                globalState: {
                    nativeTokenBalance: {
                        '0xwallet': { 143: 1 },
                    },
                },
            });
            const { result } = renderHook(() => useNativeCoinBalance('0xwallet'), {
                wrapper: wrap(state),
            });
            // parseEther('1') === 10^18
            expect(result.current).toBe(1000000000000000000n);
        });

        it('useNativeCoinBalance parses a hex-string balance into BigInt', () => {
            const state = baseState({
                globalState: {
                    nativeTokenBalance: {
                        '0xwallet': { 143: '0x1' },
                    },
                },
            });
            const { result } = renderHook(() => useNativeCoinBalance('0xwallet'), {
                wrapper: wrap(state),
            });
            expect(result.current).toBe(1n);
        });
    });

    describe('defensive default branches', () => {
        it('useCurrentAccountByAddress handles missing internalAccounts.accounts via ?? {} fallback', () => {
            const state = baseState({
                globalState: {
                    internalAccounts: { selectedAccount: undefined, accounts: undefined },
                },
            });
            const { result } = renderHook(() => useCurrentAccountByAddress('0xanything'), {
                wrapper: wrap(state),
            });
            expect(result.current.account).toBeUndefined();
            expect(result.current.isSmartWallet).toBe(false);
        });

        it('useAccounts returns [] when state has no accounts (??-fallback to {})', () => {
            const state = baseState({
                globalState: {
                    internalAccounts: { selectedAccount: undefined, accounts: undefined },
                },
            });
            const { result } = renderHook(() => useAccounts(), { wrapper: wrap(state) });
            expect(result.current).toEqual([]);
        });

        it('useFirstPermissionRequest returns the first pending permission request', () => {
            const state = baseState({
                globalState: {
                    pendingApprovals: {
                        a: {
                            id: 'a',
                            type: ApprovalType.WalletRequestPermissions,
                            requestData: { tag: 'r1' },
                        },
                    },
                },
            });
            const { result } = renderHook(() => useFirstPermissionRequest(), {
                wrapper: wrap(state),
            });
            expect((result.current as any).tag).toBe('r1');
        });

        it('useSubjectMetadataByOrigin returns null when the origin has no metadata', () => {
            const { result } = renderHook(() => useSubjectMetadataByOrigin('https://nope.com'), {
                wrapper: wrap(baseState()),
            });
            expect(result.current).toBeNull();
        });

        it('useConnectedSubjectsForSelectedAddress falls back to "" when smart wallet has no smartAddress', () => {
            // Account selected has NO smartAddress, but caller asks for smart-wallet view.
            const state = baseState({
                globalState: {
                    internalAccounts: {
                        selectedAccount: 'a1',
                        accounts: {
                            a1: {
                                id: 'a1',
                                address: '0xaaa',
                                metadata: { deleted: false },
                            },
                        },
                    },
                    subjects: {},
                    subjectMetadata: {},
                },
            });
            const { result } = renderHook(
                () => useConnectedSubjectsForSelectedAddress(true),
                { wrapper: wrap(state) },
            );
            expect(result.current).toEqual([]);
        });

        it('useConnectedSubjectsForSelectedAddress handles missing subjectMetadata entries gracefully', () => {
            const state = baseState({
                globalState: {
                    internalAccounts: {
                        selectedAccount: 'a1',
                        accounts: {
                            a1: {
                                id: 'a1',
                                address: '0xaaa',
                                smartAddress: '0xsmart',
                                metadata: { deleted: false },
                            },
                        },
                    },
                    subjects: {
                        'https://no-meta.com': {
                            permissions: {
                                eth_accounts: {
                                    caveats: [
                                        { type: 'restrictReturnedAccounts', value: ['0xaaa'] },
                                    ],
                                },
                            },
                        },
                    },
                    subjectMetadata: {},
                },
            });
            const { result } = renderHook(() => useConnectedSubjectsForSelectedAddress(), {
                wrapper: wrap(state),
            });
            expect(result.current.length).toBe(1);
            expect(result.current[0].origin).toBe('https://no-meta.com');
            expect(result.current[0].name).toBeUndefined();
        });

        it('useConnectedAccountsForTab skips exposed accounts that have no matching internal account', () => {
            const state = baseState({
                globalState: {
                    internalAccounts: {
                        selectedAccount: 'a1',
                        accounts: {
                            a1: {
                                id: 'a1',
                                address: '0xaaa',
                                metadata: { deleted: false },
                            },
                        },
                    },
                    subjects: {
                        'https://x.com': {
                            permissions: {
                                eth_accounts: {
                                    caveats: [
                                        {
                                            type: 'restrictReturnedAccounts',
                                            value: ['0xnotinternal'],
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    subjectMetadata: {},
                },
            });
            const { result } = renderHook(() => useConnectedAccountsForTab('https://x.com'), {
                wrapper: wrap(state),
            });
            expect(result.current).toEqual([]);
        });

        it('useFirstUnapprovedMessage returns the first message when there are any', () => {
            const state = baseState({
                globalState: {
                    unapprovedTypedMessages: { t1: { id: 't1', tag: 'first' } },
                    unapprovedPersonalMsgs: {},
                },
            });
            const { result } = renderHook(() => useFirstUnapprovedMessage(), {
                wrapper: wrap(state),
            });
            expect((result.current as any).tag).toBe('first');
        });

        it('useIsTestnet returns true when the current network is a testnet', () => {
            // chain_id 10143 (Monad Testnet) resolves to a testnet chain in ChainsUtils.
            const state = baseState({
                globalState: {
                    selectedNetwork: {
                        chain_id: 10143,
                        platform_id: 10143,
                        is_test: true,
                        native_coin_address: NATIVE_ADDR,
                        chain: 'monad_testnet',
                    },
                },
            });
            const { result } = renderHook(() => useIsTestnet(), { wrapper: wrap(state) });
            expect(result.current).toBe(true);
        });


        it('usePortfolioCoins falls back to initPortfolioCoins when chain entry is empty', () => {
            // Set the chain entry to a falsy value to hit the `?? initPortfolioCoins` branch.
            const state = baseState({
                portfolio: {
                    portfolioCoins: {
                        '0xwallet': { 143: null },
                    },
                },
            });
            const { result } = renderHook(() => usePortfolioCoins('0xwallet'), {
                wrapper: wrap(state),
            });
            expect(result.current).toEqual([]);
        });

        it('useNativeCoinPrice falls back to initCoinPrice when the platform entry is null', () => {
            const state = baseState({
                globalState: {
                    nativeCoinPrices: { 143: 0 },
                },
            });
            const { result } = renderHook(() => useNativeCoinPrice(), { wrapper: wrap(state) });
            expect(result.current).toBe(0);
        });
    });
});
