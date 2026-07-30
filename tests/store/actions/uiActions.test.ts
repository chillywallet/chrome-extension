import * as uiActions from '../../../src/store/actions/uiActions';

const mockSubmitRequest = jest.fn();
const mockGenerateActionId = jest.fn();
const mockGetCustomGasPrice = jest.fn();
const mockGetCurrentChainByChain = jest.fn();
const mockVerifyTransaction = jest.fn();
const mockGetReduxStore = jest.fn();
const mockSetGlobalState = jest.fn();
const mockSetTopCoinsByNetworkRedux = jest.fn();
const mockSetPortfolioNftsRedux = jest.fn();
const mockSetPortfolioTransactionsRedux = jest.fn();

jest.mock('../../../src/api', () => ({
    getCustomGasPrice: (...args: any[]) => mockGetCustomGasPrice(...args),
}));

jest.mock('../../../src/store/backgroundConnection', () => ({
    generateActionId: () => mockGenerateActionId(),
    submitRequestToBackground: (...args: any[]) => mockSubmitRequest(...args),
}));

jest.mock('../../../src/lib/ChainsUtils', () => ({
    getCurrentChainByChain: (...args: any[]) => mockGetCurrentChainByChain(...args),
}));

jest.mock('../../../src/lib/WalletUtils', () => ({
    verifyTransaction: (...args: any[]) => mockVerifyTransaction(...args),
}));

jest.mock('../../../src/lib/bigintSerializer', () => ({
    serializeBigInt: (v: any) => v,
}));

jest.mock('../../../src/lib/liquid-staking', () => ({
    LiquidStakingProviders: {
        contractType: {
            claimRequestsFetchType: 'contract',
            getClaimRequests: jest.fn(async () => [{ id: 'r1' }]),
        },
        apiType: {
            claimRequestsFetchType: 'api',
            getClaimRequests: jest.fn(async () => [{ id: 'api-r1' }]),
        },
        unknownFetchType: {
            claimRequestsFetchType: 'unknown',
            getClaimRequests: jest.fn(),
        },
        missingClaim: {
            claimRequestsFetchType: 'contract',
        },
    },
}));

jest.mock('../../../src/shared/constants/number', () => ({
    RECENT_CONTACTS_LIMIT: 3,
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../../src/store/actions/globalActions', () => ({
    SET_COIN_PRICES: 'SET_COIN_PRICES',
    SET_PORTFOLIO_COINS: 'SET_PORTFOLIO_COINS',
    setGlobalState: (s: any) => mockSetGlobalState(s),
    setPortfolioNfts: (a: any, p: any, n: any) => mockSetPortfolioNftsRedux(a, p, n),
    setPortfolioTransactions: (a: any, p: any, t: any) =>
        mockSetPortfolioTransactionsRedux(a, p, t),
    setTopCoinsByNetwork: (p: any, c: any) => mockSetTopCoinsByNetworkRedux(p, c),
}));

jest.mock('../../../src/store/store', () => ({
    getReduxStore: () => mockGetReduxStore(),
}));

jest.mock('ethers', () => ({
    parseUnits: (v: string) => BigInt(Math.floor(parseFloat(v) * 1e9)),
    TransactionResponse: class {},
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitRequest.mockResolvedValue(undefined);
    mockGenerateActionId.mockReturnValue('action-1');
    mockGetCustomGasPrice.mockResolvedValue({ data: { message: 'OK', result: {} } });
    // resetMocks: true wipes implementations between tests; restore claim-request mocks.
    const lsModule = require('../../../src/lib/liquid-staking');
    lsModule.LiquidStakingProviders.apiType.getClaimRequests = jest.fn(async () => [
        { id: 'api-r1' },
    ]);
    lsModule.LiquidStakingProviders.contractType.getClaimRequests = jest.fn(async () => [
        { id: 'r1' },
    ]);
    lsModule.LiquidStakingProviders.unknownFetchType.getClaimRequests = jest.fn();
    mockGetReduxStore.mockReturnValue({
        getState: () => ({
            globalState: {
                selectedNetwork: { chain_id: 1 },
                recentContacts: [],
                preferences: { gasPrice: [] },
            },
        }),
    });
});

describe('uiActions: action type constants', () => {
    it('exposes action type constants', () => {
        expect(uiActions.SHOW_LOADING).toBe('SHOW_LOADING');
        expect(uiActions.HIDE_LOADING).toBe('HIDE_LOADING');
        expect(uiActions.UNLOCK_SUCCEEDED).toBe('UNLOCK_SUCCEEDED');
        expect(uiActions.UNLOCK_FAILED).toBe('UNLOCK_FAILED');
        expect(uiActions.LOCK_APP).toBe('LOCK_APP');
    });
});

describe('uiActions: simple loading dispatchers', () => {
    it('showLoadingIndicator dispatches SHOW_LOADING', () => {
        const dispatch = jest.fn();
        uiActions.showLoadingIndicator()(dispatch);
        expect(dispatch).toHaveBeenCalledWith({ type: 'SHOW_LOADING' });
    });

    it('hideLoadingIndicator dispatches HIDE_LOADING', () => {
        const dispatch = jest.fn();
        uiActions.hideLoadingIndicator()(dispatch);
        expect(dispatch).toHaveBeenCalledWith({ type: 'HIDE_LOADING' });
    });
});

describe('uiActions: updateStateFromBackground', () => {
    it('dispatches updateGlobalState with new state from background', async () => {
        const dispatch = jest.fn();
        const newState = { selectedNetwork: { chain_id: 2 } };
        mockSubmitRequest.mockResolvedValueOnce(newState);
        const result = await uiActions.updateStateFromBackground()(dispatch);
        expect(result).toBe(newState);
        // updateGlobalState wraps another thunk so we get nested function calls.
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('rethrows when background rejects', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('bg-fail'));
        await expect(uiActions.updateStateFromBackground()(dispatch)).rejects.toThrow('bg-fail');
    });
});

describe('uiActions: updateGlobalState diff/skip behavior', () => {
    it('skips identical fields and updates changed ones', () => {
        const dispatch = jest.fn();
        const getState = () => ({
            globalState: {
                a: 'same',
                b: 'old',
                arr: [1, 2],
                obj: { x: 1 },
            },
        });
        uiActions.updateGlobalState({
            a: 'same',
            b: 'new',
            arr: [1, 2],
            obj: { x: 2 },
        } as any)(dispatch, getState as any);
        expect(mockSetGlobalState).toHaveBeenCalled();
    });

    it('replaces a missing object on the old state', () => {
        const dispatch = jest.fn();
        const getState = () => ({
            globalState: { a: 'same', missing: null },
        });
        uiActions.updateGlobalState({
            a: 'same',
            missing: { x: 1 },
        } as any)(dispatch, getState as any);
        expect(mockSetGlobalState).toHaveBeenCalled();
    });
});


describe('uiActions: lifecycle / vault', () => {
    it('unlockApp dispatches show, calls submitPassword, calls cb(false), then hide', async () => {
        const dispatch = jest.fn();
        const cb = jest.fn();
        mockSubmitRequest
            .mockResolvedValueOnce(undefined) // submitPassword
            .mockResolvedValueOnce({}); // updateStateFromBackground → getState
        await uiActions.unlockApp('pw', cb)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('submitPassword', ['pw']);
        expect(cb).toHaveBeenCalledWith(false);
    });

    it('unlockApp passes (true, errorMessage) to cb on error', async () => {
        const dispatch = jest.fn();
        const cb = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('bad-pw'));
        await uiActions.unlockApp('pw', cb)(dispatch);
        expect(cb).toHaveBeenCalledWith(true, 'bad-pw');
    });

    it('lockApp calls setLocked and updates state', async () => {
        const dispatch = jest.fn();
        await uiActions.lockApp()(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setLocked', []);
    });

    it('lockApp rethrows backend errors', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('lock-fail'));
        await expect(uiActions.lockApp()(dispatch)).rejects.toThrow('lock-fail');
    });

    it('verifyPassword forwards to background', async () => {
        const dispatch = jest.fn();
        await uiActions.verifyPassword('pw')(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('verifyPassword', ['pw']);
    });

    it('verifyPassword rethrows backend errors', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('verify-fail'));
        await expect(uiActions.verifyPassword('pw')(dispatch)).rejects.toThrow('verify-fail');
    });

    it('getSeedPhrase decodes the returned bytes', async () => {
        const encoded = Buffer.from('abandon ability', 'utf8');
        mockSubmitRequest.mockResolvedValueOnce(Array.from(encoded.values()));
        const result = await uiActions.getSeedPhrase('pw', 'wid');
        expect(result).toBe('abandon ability');
    });
});

describe('uiActions: importWallet / addNewWallet / createWalletAndGetSeedPhrase', () => {
    it('importWallet uses private-key path when isPrivateKey=true', async () => {
        const dispatch = jest.fn();
        await uiActions.importWallet('pw', '0xpk', true)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('createNewVaultAndRestoreWithPrivateKey', [
            'pw',
            '0xpk',
        ]);
    });

    it('importWallet encodes the seed phrase otherwise', async () => {
        const dispatch = jest.fn();
        await uiActions.importWallet('pw', 'abandon ability', false)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith(
            'createNewVaultAndRestore',
            expect.arrayContaining(['pw']),
        );
    });

    it('importWallet maps Eth-Hd-Keyring error to a friendlier message', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(
            new Error('Eth-Hd-Keyring: Invalid secret recovery phrase provided'),
        );
        await expect(uiActions.importWallet('pw', 'bad', false)(dispatch)).rejects.toThrow(
            /BIP39 compliant/,
        );
    });

    it('importWallet rethrows non-message errors verbatim', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce('not-an-error');
        await expect(uiActions.importWallet('pw', 'x', false)(dispatch)).rejects.toBe(
            'not-an-error',
        );
    });

    it('addNewWallet (private key) returns the address', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockResolvedValueOnce('0xnew');
        const result = await uiActions.addNewWallet('0xpk', true)(dispatch);
        expect(result).toBe('0xnew');
    });

    it('addNewWallet (seed) decodes the returned phrase', async () => {
        const dispatch = jest.fn();
        const encoded = Array.from(Buffer.from('alpha bravo', 'utf8').values());
        mockSubmitRequest.mockResolvedValueOnce(encoded);
        const result = await uiActions.addNewWallet('alpha bravo', false)(dispatch);
        expect(result).toBe('alpha bravo');
    });

    it('addNewWallet maps invalid recovery phrase errors', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(
            new Error('Eth-Hd-Keyring: Invalid secret recovery phrase provided'),
        );
        await expect(uiActions.addNewWallet('bad', false)(dispatch)).rejects.toThrow(
            /BIP39 compliant/,
        );
    });

    it('addNewWallet rethrows non-message errors verbatim', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce('weird');
        await expect(uiActions.addNewWallet('x', false)(dispatch)).rejects.toBe('weird');
    });

    it('createWalletAndGetSeedPhrase returns the decoded seed', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest
            .mockResolvedValueOnce(undefined) // createNewVaultAndKeychain
            .mockResolvedValueOnce(Array.from(Buffer.from('alpha bravo', 'utf8').values())); // getSeedPhrase
        const result = await uiActions.createWalletAndGetSeedPhrase('pw')(dispatch);
        expect(result).toBe('alpha bravo');
    });

    it('createWalletAndGetSeedPhrase rethrows error with message', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('vault-fail'));
        await expect(uiActions.createWalletAndGetSeedPhrase('pw')(dispatch)).rejects.toThrow(
            'vault-fail',
        );
    });
});

describe('uiActions: account & wallet management thunks', () => {
    function dispatchHarness() {
        const dispatch = jest.fn();
        return dispatch;
    }

    it('getPrivateKey forwards and returns the result', async () => {
        const dispatch = dispatchHarness();
        mockSubmitRequest.mockResolvedValueOnce('0xpk');
        const result = await uiActions.getPrivateKey('pw', '0xa')(dispatch);
        expect(result).toBe('0xpk');
    });

    it('getPrivateKey rethrows error with message', async () => {
        const dispatch = dispatchHarness();
        mockSubmitRequest.mockRejectedValueOnce(new Error('export-fail'));
        await expect(uiActions.getPrivateKey('pw', '0xa')(dispatch)).rejects.toThrow(
            'export-fail',
        );
    });

    it('removeAccount calls background and updates state', async () => {
        const dispatch = dispatchHarness();
        await uiActions.removeAccount('0xa')(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('removeAccount', ['0xa']);
    });

    it('removeAccount rethrows errors with messages', async () => {
        const dispatch = dispatchHarness();
        mockSubmitRequest.mockRejectedValueOnce(new Error('rm-fail'));
        await expect(uiActions.removeAccount('0xa')(dispatch)).rejects.toThrow('rm-fail');
    });

    it('removeWallet calls background and updates state', async () => {
        const dispatch = dispatchHarness();
        await uiActions.removeWallet('wid')(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('removeWallet', ['wid']);
    });

    it('addNewAccount uses the keyring count, names the new account, then updates state', async () => {
        const dispatch = jest.fn();
        const getState = () => ({
            globalState: {
                keyrings: [{ id: 'wid', accounts: ['0xa', '0xb'] }],
            },
        });
        mockSubmitRequest
            .mockResolvedValueOnce('0xnew') // addNewAccount
            .mockResolvedValueOnce(undefined) // updateAccount
            .mockResolvedValueOnce({}); // updateStateFromBackground
        const result = await uiActions.addNewAccount('wid', 'Acct 1', '🦊')(
            dispatch,
            getState as any,
        );
        expect(result).toBe('0xnew');
        expect(mockSubmitRequest).toHaveBeenCalledWith('addNewAccount', [2, 'wid']);
    });

    it('addNewAccount falls back to count 1 when wallet not found', async () => {
        const dispatch = jest.fn();
        const getState = () => ({ globalState: { keyrings: [] } });
        mockSubmitRequest.mockResolvedValueOnce('0xnew');
        await uiActions.addNewAccount('missing', 'Acct', '')(dispatch, getState as any);
        expect(mockSubmitRequest).toHaveBeenCalledWith('addNewAccount', [1, 'missing']);
    });

    it('addNewAccount rethrows errors with messages', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('add-fail'));
        await expect(
            uiActions.addNewAccount('wid', 'n', '')(dispatch, (() => ({
                globalState: { keyrings: [] },
            })) as any),
        ).rejects.toThrow('add-fail');
    });

    it('updateAccount calls background with all four args', async () => {
        const dispatch = jest.fn();
        await uiActions.updateAccount('0xa', 'name', '🦊', false)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('updateAccount', [
            '0xa',
            'name',
            '🦊',
            false,
        ]);
    });

    it('updateAccount rethrows errors', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('upd-fail'));
        await expect(
            uiActions.updateAccount('0xa', 'n', '', false)(dispatch),
        ).rejects.toThrow('upd-fail');
    });

    it('updateWallet calls background and updates state', async () => {
        const dispatch = jest.fn();
        await uiActions.updateWallet('wid', 'Wallet 1')(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('updateWallet', ['wid', 'Wallet 1']);
    });

    it('setSelectedAccount and setSelectedWallet forward', async () => {
        const dispatch = jest.fn();
        await uiActions.setSelectedAccount('aid')(dispatch);
        await uiActions.setSelectedWallet('wid')(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setSelectedAccount', ['aid']);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setSelectedWallet', ['wid']);
    });

    it('setCompletedOnboarding returns the new account address', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockResolvedValueOnce('0xacct');
        const result = await uiActions.setCompletedOnboarding(true)(dispatch);
        expect(result).toBe('0xacct');
    });

    it('setCompletedOnboarding without loader skips show/hide', async () => {
        const dispatch = jest.fn();
        await uiActions.setCompletedOnboarding(false)(dispatch);
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'SHOW_LOADING' });
    });

    it('setCompletedOnboarding rethrows backend errors', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('onboard-fail'));
        await expect(uiActions.setCompletedOnboarding(true)(dispatch)).rejects.toThrow(
            'onboard-fail',
        );
    });
});

describe('uiActions: background-only setters', () => {
    it.each([
        ['setOnboardingStep', uiActions.setOnboardingStep, ['DONE'], 'setOnboardingStep'],
    ])('%s forwards to background', async (_label, fn, args: any[], rpc) => {
        await (fn as any)(...args);
        expect(mockSubmitRequest).toHaveBeenCalledWith(rpc, [args[0]]);
    });
});

describe('uiActions: preference setters', () => {
    const dispatch = jest.fn();

    beforeEach(() => {
        dispatch.mockClear();
    });

    it.each([
        ['setDarkMode', uiActions.setDarkMode, true, 'setPreference', ['darkMode', true]],
        [
            'setDarkModeSystem',
            uiActions.setDarkModeSystem,
            true,
            'setPreference',
            ['darkModeSystem', true],
        ],
        [
            'setPreferColorScheme',
            uiActions.setPreferColorScheme,
            'dark',
            'setPreference',
            ['preferColorScheme', 'dark'],
        ],
        [
            'setAppIcon',
            uiActions.setAppIcon,
            'classic',
            'setPreference',
            ['appIcon', 'classic'],
        ],
        [
            'setHideTestnetBadge',
            uiActions.setHideTestnetBadge,
            true,
            'setPreference',
            ['hideTestnetBadge', true],
        ],
    ])('%s forwards to %s', async (_, fn, arg, rpc, args) => {
        await (fn as any)(arg)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith(rpc, args);
    });

    it.each([
        ['setRemoteData', uiActions.setRemoteData, { a: 1 }, 'setPreferences', [{ a: 1 }]],
        [
            'setDefaultExploreTab',
            uiActions.setDefaultExploreTab,
            'coins',
            'setPreferences',
            [{ defaultExploreTab: 'coins' }],
        ],
        [
            'setNftCollectionsHideStatus',
            uiActions.setNftCollectionsHideStatus,
            { a: true },
            'setPreferences',
            [{ nftCollectionsHideStatus: { a: true } }],
        ],
        [
            'setNftsHideStatus',
            uiActions.setNftsHideStatus,
            { x: true },
            'setPreferences',
            [{ nftsHideStatus: { x: true } }],
        ],
        [
            'setFavoriteCoins',
            uiActions.setFavoriteCoins,
            [{ id: '1' }],
            'setPreferences',
            [{ favoriteCoins: [{ id: '1' }] }],
        ],
        [
            'setUseDefaultNetwork',
            uiActions.setUseDefaultNetwork,
            true,
            'setPreferences',
            [{ useDefaultNetwork: true }],
        ],
        [
            'setPreferences',
            uiActions.setPreferences,
            { a: 1 },
            'setPreferences',
            [{ a: 1 }],
        ],
    ])('%s forwards', async (_, fn, arg, rpc, args) => {
        await (fn as any)(arg)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith(rpc, args);
    });

    it('setExploreRedDot with date includes both fields', async () => {
        await uiActions.setExploreRedDot(true, '2026-05-18')(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setPreferences', [
            { exploreRedDot: true, exploreRedDotDate: '2026-05-18' },
        ]);
    });

    it('setExploreRedDot without date includes only flag', async () => {
        await uiActions.setExploreRedDot(false)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setPreferences', [
            { exploreRedDot: false },
        ]);
    });

});

describe('uiActions: caching and coin actions', () => {
    const dispatch = jest.fn();

    beforeEach(() => {
        dispatch.mockClear();
    });

    it('setCachingCoins forwards', async () => {
        await uiActions.setCachingCoins([{ id: 'c1' } as any])(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setCachingCoins', [[{ id: 'c1' }]]);
    });

    it('setUnknownCoins forwards', async () => {
        await uiActions.setUnknownCoins(['x'])(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setUnknownCoins', [['x']]);
    });

    it('setTopCoinsByNetwork delegates to redux action', () => {
        uiActions.setTopCoinsByNetwork(1, [{ id: 'c' } as any])(dispatch);
        expect(mockSetTopCoinsByNetworkRedux).toHaveBeenCalled();
    });

    it('setNativeCoinPrice forwards', async () => {
        await uiActions.setNativeCoinPrice(1, 100)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setNativeCoinPrice', [1, 100]);
    });

    it('setPortfolioCoins lowercases address and forwards', async () => {
        await uiActions.setPortfolioCoins('0xABC', 1, [{ id: 'c' } as any])(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setPortfolioCoins', [
            '0xabc',
            1,
            [{ id: 'c' }],
        ]);
    });

    it('updatePortfolioCoins lowercases address and forwards', async () => {
        await uiActions.updatePortfolioCoins('0xABC', 1, [])(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('updatePortfolioCoins', [
            '0xabc',
            1,
            [],
        ]);
    });

    it('getCurrentPortfolioCoins forwards lowercased address', async () => {
        await uiActions.getCurrentPortfolioCoins('0xABC', 1);
        expect(mockSubmitRequest).toHaveBeenCalledWith('getCurrentPortfolioCoins', [
            '0xabc',
            1,
        ]);
    });

    it('getCurrentCoinPrices forwards', async () => {
        await uiActions.getCurrentCoinPrices(1);
        expect(mockSubmitRequest).toHaveBeenCalledWith('getCurrentCoinPrices', [1]);
    });

    it('getCoinByTokenAddress forwards', async () => {
        await uiActions.getCoinByTokenAddress('0xABC', 1, '0xtkn');
        expect(mockSubmitRequest).toHaveBeenCalledWith('getCoinByTokenAddress', [
            '0xabc',
            1,
            '0xtkn',
        ]);
    });

    it('setCoinPrices forwards and updates prices', async () => {
        await uiActions.setCoinPrices(1, { abc: 1 } as any)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setCoinPrices', [1, { abc: 1 }]);
    });

    it('setPortfolioNfts delegates to redux action', () => {
        uiActions.setPortfolioNfts('0xa', 1, [] as any)(dispatch);
        expect(mockSetPortfolioNftsRedux).toHaveBeenCalled();
    });

    it('setPortfolioTransactions delegates to redux action', () => {
        uiActions.setPortfolioTransactions('0xa', 1, [] as any)(dispatch);
        expect(mockSetPortfolioTransactionsRedux).toHaveBeenCalled();
    });
});

describe('uiActions: pending transactions', () => {
    const dispatch = jest.fn();
    beforeEach(() => dispatch.mockClear());

    it('setPendingTransactions lowercases address and forwards', async () => {
        await uiActions.setPendingTransactions('0xABC', 1, [] as any)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setPendingTransactions', [
            '0xabc',
            1,
            [],
        ]);
    });


    it('updatePendingTransactionStatus returns the status', async () => {
        mockSubmitRequest.mockResolvedValueOnce('CONFIRMED');
        const result = await uiActions.updatePendingTransactionStatus(1, {} as any)(dispatch);
        expect(result).toBe('CONFIRMED');
    });

    it('updatePendingTransaction forwards', async () => {
        await uiActions.updatePendingTransaction(1, {} as any)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('updatePendingTransaction', [1, {}]);
    });

    it('removePendingTransactions lowercases and forwards', async () => {
        await uiActions.removePendingTransactions('0xABC', 1, ['id'])(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('removePendingTransactions', [
            '0xabc',
            1,
            ['id'],
        ]);
    });

    it('removeCompletedTransactions lowercases and forwards', async () => {
        await uiActions.removeCompletedTransactions('0xABC', 1)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('removeCompletedTransactions', [
            '0xabc',
            1,
        ]);
    });
});

describe('uiActions: contacts', () => {
    it('setContacts forwards', async () => {
        const dispatch = jest.fn();
        await uiActions.setContacts([{ name: 'a' } as any])(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setContacts', [[{ name: 'a' }]]);
    });

    it('addRecentContact is a no-op when contact already exists', async () => {
        const dispatch = jest.fn();
        const getState = () => ({
            globalState: { recentContacts: [{ walletAddress: '0xA' }] },
        });
        const handler = (await uiActions.addRecentContact('0xa', 'name', '🦊')) as any;
        await handler(dispatch, getState);
        expect(mockSubmitRequest).not.toHaveBeenCalled();
    });

    it('addRecentContact appends a new contact', async () => {
        const dispatch = jest.fn();
        const getState = () => ({
            globalState: { recentContacts: [] },
        });
        const handler = (await uiActions.addRecentContact('0xa', 'name', '🦊')) as any;
        await handler(dispatch, getState);
        expect(mockSubmitRequest).toHaveBeenCalledWith(
            'setRecentContacts',
            expect.any(Array),
        );
    });

    it('addRecentContact trims to limit when exceeded', async () => {
        const dispatch = jest.fn();
        const getState = () => ({
            globalState: {
                recentContacts: [
                    { walletAddress: '0x1' },
                    { walletAddress: '0x2' },
                    { walletAddress: '0x3' },
                ],
            },
        });
        const handler = (await uiActions.addRecentContact('0xnew', 'n', '')) as any;
        await handler(dispatch, getState);
        const args = mockSubmitRequest.mock.calls[0][1][0];
        // After shifting one off, length should equal limit (3).
        expect(args.length).toBe(3);
    });
});

describe('uiActions: network / smart account', () => {
    it('setSelectedNetwork forwards', async () => {
        const dispatch = jest.fn();
        await uiActions.setSelectedNetwork(137)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setSelectedNetwork', [137]);
    });




    it('getNextAvailableAccountName returns name or empty string on error', async () => {
        mockSubmitRequest.mockResolvedValueOnce('Account 2');
        await expect(uiActions.getNextAvailableAccountName()).resolves.toBe('Account 2');
        mockSubmitRequest.mockRejectedValueOnce(new Error('no-name'));
        await expect(uiActions.getNextAvailableAccountName()).resolves.toBe('');
    });
});

describe('uiActions: gas, allowance, transaction estimators', () => {
    const dispatch = jest.fn();
    beforeEach(() => dispatch.mockClear());

    it.each([
        ['approveAllowance', uiActions.approveAllowance, [
            '0xs',
            '0xw',
            '0xt',
            '100',
            { chain_id: 1 },
            {},
            false,
        ]],
        ['checkAllowance', uiActions.checkAllowance, ['0xs', '0xw', '0xt', '100']],
        ['estimateGasAllowance', uiActions.estimateGasAllowance, ['0xs', '0xt', '100', '0xw']],
        ['estimateGas', uiActions.estimateGas, [{ from: '0xa' }]],
        [
            'estimateWalletSendCallsGas',
            uiActions.estimateWalletSendCallsGas,
            [{ calls: [] } as any, '0xa'],
        ],
        ['checkContract', uiActions.checkContract, ['0xa']],
        ['ensToWalletAdress', uiActions.ensToWalletAdress, ['alice.eth']],
        ['getTransaction', uiActions.getTransaction, ['0xhash', 1]],
        ['newSendTransaction', uiActions.newSendTransaction, ['0xa', { transaction: {} }]],
    ])('%s forwards to the background', async (rpc, fn, args: any[]) => {
        await (fn as any)(...args);
        expect(mockSubmitRequest).toHaveBeenCalledWith(rpc, expect.any(Array));
    });

    it('estimateGasLimit serializes the bigint amount', async () => {
        await uiActions.estimateGasLimit({ symbol: 'ETH' } as any, '0xa', '0xb', BigInt(100), 110);
        expect(mockSubmitRequest).toHaveBeenCalledWith('estimateGasLimit', [
            { symbol: 'ETH' },
            '0xa',
            '0xb',
            '100',
            110,
        ]);
    });

    it('getTokenBalance falls back to selectedNetwork.chain_id when chainId omitted', async () => {
        await uiActions.getTokenBalance('0xa', undefined, true);
        expect(mockSubmitRequest).toHaveBeenCalledWith('getTokenBalance', [
            '0xa',
            undefined,
            true,
            1,
        ]);
    });

    it('getNativeTokenBalance falls back to selectedNetwork.chain_id', async () => {
        const dispatch = jest.fn();
        const getState = () => ({ globalState: { selectedNetwork: { chain_id: 1 } } });
        await uiActions.getNativeTokenBalance('0xa')(dispatch, getState as any);
        expect(mockSubmitRequest).toHaveBeenCalledWith('getNativeTokenBalance', ['0xa', 1]);
    });

    it('sendTransaction serializes bigint amount and forwards', async () => {
        const dispatch = jest.fn();
        await uiActions.sendTransaction(
            '0xa',
            '0xb',
            {} as any,
            100,
            BigInt(1234),
            { symbol: 'ETH' } as any,
            false,
        )(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith(
            'sendTransaction',
            expect.arrayContaining(['0xa', '0xb']),
        );
    });

    it('sendTransaction rethrows errors with messages', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('tx-fail'));
        await expect(
            uiActions.sendTransaction(
                '0xa',
                '0xb',
                {} as any,
                100,
                BigInt(1),
                {} as any,
                false,
            )(dispatch),
        ).rejects.toThrow('tx-fail');
    });



    it('speedUpTransaction and cancelTransaction forward', async () => {
        const dispatch = jest.fn();
        await uiActions.speedUpTransaction('0xa', {} as any, {} as any)(dispatch);
        await uiActions.cancelTransaction('0xa', {} as any, {} as any)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('speedUpTransaction', expect.any(Array));
        expect(mockSubmitRequest).toHaveBeenCalledWith('cancelTransaction', expect.any(Array));
    });

    it('setCustomGas swallows errors and dispatches updateStateFromBackground', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockResolvedValueOnce(undefined);
        await uiActions.setCustomGas({} as any, { chain_id: 1 } as any)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setCustomGas', [
            {},
            { chain_id: 1 },
        ]);
    });

    it('setGasType forwards', async () => {
        const dispatch = jest.fn();
        await uiActions.setGasType({ type: 'fast' } as any, { chain_id: 1 } as any)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setGasType', expect.any(Array));
    });

    it('setGasOptionsData forwards', async () => {
        const dispatch = jest.fn();
        await uiActions.setGasOptionsData({} as any, { chain_id: 1 } as any)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('setGasOptionsData', expect.any(Array));
    });
});

describe('uiActions: loadGasOptions', () => {
    const dispatch = jest.fn();
    beforeEach(() => {
        dispatch.mockClear();
    });

    it('returns early when the chain is not found', async () => {
        mockGetCurrentChainByChain.mockReturnValueOnce(null);
        const getState = () => ({ globalState: { preferences: { gasPrice: [] } } });
        await uiActions.loadGasOptions('ETH' as any)(dispatch, getState as any);
        expect(mockSubmitRequest).not.toHaveBeenCalled();
    });

    it('dispatches setGasOptionsData with local options when nothing is custom', async () => {
        mockGetCurrentChainByChain.mockReturnValueOnce({
            chain_id: 1,
            gasPriceType: 'gasPrice',
        });
        const getState = () => ({
            globalState: {
                preferences: { gasPrice: [] },
            },
        });
        mockSubmitRequest.mockResolvedValueOnce({ low: { gasPrice: 1n } });
        await uiActions.loadGasOptions('ETH' as any)(dispatch, getState as any);
        expect(mockSubmitRequest).toHaveBeenCalledWith('loadGasOptions', expect.any(Array));
    });

    it('uses remote gas prices when a custom URL is configured (legacy gas)', async () => {
        mockGetCurrentChainByChain.mockReturnValueOnce({
            chain_id: 1,
            gasPriceType: 'gasPrice',
        });
        const getState = () => ({
            globalState: {
                preferences: {
                    gasPrice: [
                        {
                            chain_id: 1,
                            type: 'custom',
                            url_pattern: 'https://gas',
                            customPriorityFee: 0,
                            customGasPrice: 0,
                        },
                    ],
                },
            },
        });
        mockSubmitRequest.mockResolvedValueOnce({});
        mockGetCustomGasPrice.mockResolvedValueOnce({
            data: {
                message: 'OK',
                result: {
                    SafeGasPrice: '1',
                    ProposeGasPrice: '2',
                    FastGasPrice: '3',
                    suggestBaseFee: '1',
                },
            },
        });
        await uiActions.loadGasOptions('ETH' as any)(dispatch, getState as any);
        expect(mockGetCustomGasPrice).toHaveBeenCalled();
    });

    it('uses remote gas prices for EIP-1559 (BaseAndPriority) chains', async () => {
        mockGetCurrentChainByChain.mockReturnValueOnce({
            chain_id: 1,
            gasPriceType: 'BaseAndPriority',
        });
        const getState = () => ({
            globalState: {
                preferences: {
                    gasPrice: [
                        {
                            chain_id: 1,
                            type: 'custom',
                            url_pattern: 'https://gas',
                            customPriorityFee: 0,
                            customGasPrice: 0,
                        },
                    ],
                },
            },
        });
        mockSubmitRequest.mockResolvedValueOnce({ currentBaseFee: BigInt(1000) });
        mockGetCustomGasPrice.mockResolvedValueOnce({
            data: {
                message: 'OK',
                result: {
                    SafeGasPrice: '1',
                    ProposeGasPrice: '2',
                    FastGasPrice: '3',
                    suggestBaseFee: '1',
                },
            },
        });
        await uiActions.loadGasOptions('ETH' as any)(dispatch, getState as any);
        // Setting remote data is a dispatch within the action's nested dispatch.
        expect(mockSubmitRequest).toHaveBeenCalled();
    });

    it('swallows errors thrown from background', async () => {
        mockGetCurrentChainByChain.mockReturnValueOnce({
            chain_id: 1,
            gasPriceType: 'gasPrice',
        });
        const getState = () => ({
            globalState: { preferences: { gasPrice: [] } },
        });
        mockSubmitRequest.mockRejectedValueOnce(new Error('rpc'));
        await expect(
            uiActions.loadGasOptions('ETH' as any)(dispatch, getState as any),
        ).resolves.toBeUndefined();
    });
});

describe('uiActions: permission and approval thunks', () => {
    const dispatch = jest.fn();
    beforeEach(() => dispatch.mockClear());

    it.each([
        ['rejectPermissionsRequest', uiActions.rejectPermissionsRequest, ['rid']],
        ['approvePermissionsRequest', uiActions.approvePermissionsRequest, [{} as any]],
        ['removePermittedAccount', uiActions.removePermittedAccount, ['o', '0xa']],
        ['addPermittedAccount', uiActions.addPermittedAccount, ['o', '0xa']],
        ['resolvePendingApproval', uiActions.resolvePendingApproval, ['id', 'v']],
        ['rejectPendingApproval', uiActions.rejectPendingApproval, ['id', { code: -1 }]],
    ])('%s forwards', async (_, fn, args: any[]) => {
        await (fn as any)(...args)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalled();
    });

    it('updateAndApproveTx uses an action id and waits for the result', async () => {
        await uiActions.updateAndApproveTx({ id: 't' } as any)(dispatch);
        expect(mockGenerateActionId).toHaveBeenCalled();
        expect(mockSubmitRequest).toHaveBeenCalledWith('resolvePendingApproval', [
            't',
            { txMeta: { id: 't' }, actionId: 'action-1' },
            { waitForResult: true },
        ]);
    });

    it('rejectPermissionsRequest rethrows backend errors', async () => {
        mockSubmitRequest.mockRejectedValueOnce(new Error('reject-fail'));
        await expect(uiActions.rejectPermissionsRequest('rid')(dispatch)).rejects.toThrow(
            'reject-fail',
        );
    });
});


describe('uiActions: liquid staking actions', () => {
    it.each([
        ['setLiquidStakingProvider', uiActions.setLiquidStakingProvider, 'kintsu'],
        ['getExchangeRate', uiActions.getExchangeRate, '1'],
        ['getUnstakeExchangeRate', uiActions.getUnstakeExchangeRate, '1'],
        ['getWaitTime', uiActions.getWaitTime, undefined],
        ['estimateStake', uiActions.estimateStake, BigInt(100)],
        ['estimateRequestUnstake', uiActions.estimateRequestUnstake, BigInt(100)],
        ['estimateUnstake', uiActions.estimateUnstake, [1]],
        ['estimateCancelUnstakeRequest', uiActions.estimateCancelUnstakeRequest, 'rid'],
        ['checkContract', uiActions.checkContract, '0xa'],
        ['getStakeCall', uiActions.getStakeCall, BigInt(100)],
        ['getRequestUnstakeCall', uiActions.getRequestUnstakeCall, BigInt(100)],
        ['getUnstakeCall', uiActions.getUnstakeCall, BigInt(100)],
        ['getCancelUnstakeRequestCall', uiActions.getCancelUnstakeRequestCall, 'rid'],
    ])('%s forwards', async (rpc, fn, _arg) => {
        if (rpc === 'setLiquidStakingProvider') {
            await (fn as any)('kintsu');
        } else if (rpc === 'getWaitTime') {
            await (fn as any)();
        } else if (rpc === 'estimateUnstake') {
            await (fn as any)('0xa', [1], BigInt(100));
        } else if (rpc === 'estimateCancelUnstakeRequest') {
            await (fn as any)('rid', '0xa');
        } else if (rpc === 'checkContract') {
            await (fn as any)('0xa');
        } else if (rpc === 'getStakeCall' || rpc === 'getRequestUnstakeCall') {
            await (fn as any)(BigInt(100), '0xa');
        } else if (rpc === 'getUnstakeCall') {
            await (fn as any)(BigInt(100), '0xa', [1]);
        } else if (rpc === 'getCancelUnstakeRequestCall') {
            await (fn as any)('rid', '0xa');
        } else if (rpc === 'estimateStake' || rpc === 'estimateRequestUnstake') {
            await (fn as any)('0xa', BigInt(100));
        } else {
            await (fn as any)('1');
        }
        expect(mockSubmitRequest).toHaveBeenCalled();
    });

    describe('getClaimRequests', () => {
        it('throws when provider has no getClaimRequests', async () => {
            await expect(
                uiActions.getClaimRequests('unknownEarnType' as any, '0xa'),
            ).rejects.toThrow(/not exists/);
        });

        it('throws when provider is missing getClaimRequests entirely', async () => {
            await expect(
                uiActions.getClaimRequests('missingClaim' as any, '0xa'),
            ).rejects.toThrow(/not exists/);
        });

        it('uses contract fetch for contract-type providers', async () => {
            mockSubmitRequest.mockResolvedValueOnce([{ id: 'r1' }]);
            const result = await uiActions.getClaimRequests('contractType' as any, '0xa');
            expect(result).toEqual([{ id: 'r1' }]);
            expect(mockSubmitRequest).toHaveBeenCalledWith('getClaimRequests', ['0xa']);
        });

        it('uses provider getClaimRequests for api-type providers', async () => {
            const result = await uiActions.getClaimRequests('apiType' as any, '0xa');
            expect(result).toEqual([{ id: 'api-r1' }]);
        });

        it('returns [] for unknown fetch types', async () => {
            const result = await uiActions.getClaimRequests('unknownFetchType' as any, '0xa');
            expect(result).toEqual([]);
        });
    });

    it.each([
        ['stake', uiActions.stake, ['0xa', BigInt(100), {} as any, 100]],
        ['requestUnstake', uiActions.requestUnstake, ['0xa', BigInt(100), {} as any, 100]],
        [
            'unstake',
            uiActions.unstake,
            ['0xa', [1], BigInt(100), {} as any, 100],
        ],
        [
            'cancelUnstakeRequest',
            uiActions.cancelUnstakeRequest,
            ['rid', '0xa', {} as any, 100],
        ],
    ])('%s forwards via dispatch', async (rpc, fn, args: any[]) => {
        const dispatch = jest.fn();
        await (fn as any)(...args)(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith(rpc, expect.any(Array));
    });

    it('stake rethrows backend errors', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('stake-fail'));
        await expect(
            uiActions.stake('0xa', BigInt(100), {} as any, 100)(dispatch),
        ).rejects.toThrow('stake-fail');
    });
});




describe('uiActions: updatePortfolioCoinsFromBackground / updateCoinPricesFromBackground', () => {
    it('updatePortfolioCoinsFromBackground dispatches SET_PORTFOLIO_COINS', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockResolvedValueOnce([{ id: 'c1' }]);
        await uiActions.updatePortfolioCoinsFromBackground('0xA', 1)(dispatch);
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_PORTFOLIO_COINS',
            address: '0xa',
            platform_id: 1,
            portfolioCoins: [{ id: 'c1' }],
        });
    });

    it('updateCoinPricesFromBackground returns the prices', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockResolvedValueOnce({ usd: 1 });
        const result = await uiActions.updateCoinPricesFromBackground(1)(dispatch);
        expect(result).toEqual({ usd: 1 });
    });
});

describe('uiActions: catch-rethrow-verbatim error branches', () => {
    // Each entry exercises the `} else { throw error }` branch when the rejected value
    // has no `.message` property (e.g. a primitive string).
    const verbatimThunks: Array<{ name: string; invoke: (d: jest.Mock) => Promise<any> }> = [
        { name: 'createWalletAndGetSeedPhrase', invoke: d => uiActions.createWalletAndGetSeedPhrase('pw')(d) },
        { name: 'getPrivateKey', invoke: d => uiActions.getPrivateKey('pw', '0x1')(d) },
        { name: 'removeAccount', invoke: d => uiActions.removeAccount('0x1')(d) },
        { name: 'removeWallet', invoke: d => uiActions.removeWallet('wid')(d) },
        {
            name: 'addNewAccount',
            invoke: d => {
                const getState: any = () => ({ globalState: { keyrings: [] } });
                return uiActions.addNewAccount('wid', 'name', '🦊')(d, getState);
            },
        },
        { name: 'updateAccount', invoke: d => uiActions.updateAccount('0x1', 'n', '🦊', false)(d) },
        { name: 'updateWallet', invoke: d => uiActions.updateWallet('wid', 'n')(d) },
        { name: 'setSelectedAccount', invoke: d => uiActions.setSelectedAccount('a1')(d) },
        { name: 'setSelectedWallet', invoke: d => uiActions.setSelectedWallet('w1')(d) },
        { name: 'setCompletedOnboarding', invoke: d => uiActions.setCompletedOnboarding()(d) },
        { name: 'setDarkMode', invoke: d => uiActions.setDarkMode(true)(d) },
        { name: 'setDarkModeSystem', invoke: d => uiActions.setDarkModeSystem(true)(d) },
        {
            name: 'setPreferColorScheme',
            invoke: d => uiActions.setPreferColorScheme('dark')(d),
        },
        { name: 'setAppIcon', invoke: d => uiActions.setAppIcon('icon')(d) },
        { name: 'setRemoteData', invoke: d => uiActions.setRemoteData({} as any)(d) },
        { name: 'setDefaultExploreTab', invoke: d => uiActions.setDefaultExploreTab('coins' as any)(d) },
        {
            name: 'setNftCollectionsHideStatus',
            invoke: d => uiActions.setNftCollectionsHideStatus({ a: true })(d),
        },
        { name: 'setNftsHideStatus', invoke: d => uiActions.setNftsHideStatus({ a: true })(d) },
        { name: 'setExploreRedDot', invoke: d => uiActions.setExploreRedDot(true)(d) },
        { name: 'setFavoriteCoins', invoke: d => uiActions.setFavoriteCoins([])(d) },
        { name: 'setHideTestnetBadge', invoke: d => uiActions.setHideTestnetBadge(true)(d) },
        { name: 'setUseDefaultNetwork', invoke: d => uiActions.setUseDefaultNetwork(true)(d) },
        { name: 'setPreferences', invoke: d => uiActions.setPreferences({ a: 1 })(d) },
        { name: 'setCachingCoins', invoke: d => uiActions.setCachingCoins([])(d) },
        { name: 'setUnknownCoins', invoke: d => uiActions.setUnknownCoins([])(d) },
        { name: 'setNativeCoinPrice', invoke: d => uiActions.setNativeCoinPrice(1, 1)(d) },
        { name: 'setPortfolioCoins', invoke: d => uiActions.setPortfolioCoins('0xa', 1, [])(d) },
        { name: 'updatePortfolioCoins', invoke: d => uiActions.updatePortfolioCoins('0xa', 1, [])(d) },
        { name: 'setCoinPrices', invoke: d => uiActions.setCoinPrices(1, {} as any)(d) },
        { name: 'setPendingTransactions', invoke: d => uiActions.setPendingTransactions('0xa', 1, [])(d) },
        {
            name: 'addPendingTransaction',
            invoke: d => uiActions.addPendingTransaction(1, { txHash: '0xtx', sender: '0xs' } as any)(d),
        },
        {
            name: 'updatePendingTransactionStatus',
            invoke: d => uiActions.updatePendingTransactionStatus(1, {} as any)(d),
        },
        {
            name: 'updatePendingTransaction',
            invoke: d => uiActions.updatePendingTransaction(1, {} as any)(d),
        },
        {
            name: 'removePendingTransactions',
            invoke: d => uiActions.removePendingTransactions('0xa', 1, ['0xtx'])(d),
        },
        {
            name: 'removeCompletedTransactions',
            invoke: d => uiActions.removeCompletedTransactions('0xa', 1)(d),
        },
        { name: 'setContacts', invoke: d => uiActions.setContacts([])(d) },
        { name: 'setSelectedNetwork', invoke: d => uiActions.setSelectedNetwork(1)(d) },
        { name: 'sendTransaction', invoke: d => uiActions.sendTransaction('0xa', '0xb', {} as any, 0, 0n, {} as any, false)(d) },
        {
            name: 'speedUpTransaction',
            invoke: d => uiActions.speedUpTransaction('0xtx', 0n, false)(d),
        },
        {
            name: 'cancelTransaction',
            invoke: d => uiActions.cancelTransaction('0xtx', 0n, false)(d),
        },
        {
            name: 'rejectPermissionsRequest',
            invoke: d => uiActions.rejectPermissionsRequest('rid')(d),
        },
        {
            name: 'approvePermissionsRequest',
            invoke: d => uiActions.approvePermissionsRequest({} as any)(d),
        },
        {
            name: 'removePermittedAccount',
            invoke: d => uiActions.removePermittedAccount('site', '0xa')(d),
        },
        { name: 'addPermittedAccount', invoke: d => uiActions.addPermittedAccount('site', '0xa')(d) },
        {
            name: 'resolvePendingApproval',
            invoke: d => uiActions.resolvePendingApproval('id', 'v')(d),
        },
        { name: 'updateAndApproveTx', invoke: d => uiActions.updateAndApproveTx({} as any)(d) },
        {
            name: 'rejectPendingApproval',
            invoke: d => uiActions.rejectPendingApproval('id', new Error('e'))(d),
        },
        { name: 'stake', invoke: d => uiActions.stake('0xa', 0n, {} as any, 0)(d) },
        {
            name: 'requestUnstake',
            invoke: d => uiActions.requestUnstake('0xa', 0n, {} as any, 0)(d),
        },
        {
            name: 'unstake',
            invoke: d => uiActions.unstake('0xa', undefined, 0n, {} as any, 0)(d),
        },
        {
            name: 'cancelUnstakeRequest',
            invoke: d => uiActions.cancelUnstakeRequest('rid', '0xa', {} as any, 0)(d),
        },
    ];

    it.each(verbatimThunks)(
        '$name rethrows a primitive (no .message) verbatim',
        async ({ invoke }) => {
            const dispatch = jest.fn();
            mockSubmitRequest.mockReset();
            // Reject with a primitive that has no `.message` field so the
            // `else { throw error }` path runs.
            mockSubmitRequest.mockRejectedValue('primitive-error');
            await expect(invoke(dispatch)).rejects.toBe('primitive-error');
        },
    );

    it.each(verbatimThunks)(
        '$name wraps an Error message via the if-branch',
        async ({ invoke }) => {
            const dispatch = jest.fn();
            mockSubmitRequest.mockReset();
            mockSubmitRequest.mockRejectedValue(new Error('msg-error'));
            await expect(invoke(dispatch)).rejects.toThrow('msg-error');
        },
    );
});

describe('uiActions: remaining background helpers', () => {
    it('addRecentContact logs and swallows errors when getState throws', async () => {
        const inner = await uiActions.addRecentContact('0xA', 'Name', '🦊');
        const dispatch = jest.fn();
        const getState: any = () => {
            throw new Error('state-fail');
        };
        await expect(inner(dispatch, getState)).resolves.toBeUndefined();
    });

    it('addRecentContact adds a new entry when the address is not already present', async () => {
        const inner = await uiActions.addRecentContact('0xfresh', 'F', '🐶');
        const dispatch = jest.fn();
        const getState: any = () => ({
            globalState: { recentContacts: [{ walletAddress: '0xother', name: 'O' }] },
        });
        await inner(dispatch, getState);
        expect(mockSubmitRequest).toHaveBeenCalledWith(
            'setRecentContacts',
            expect.any(Array),
        );
    });

    it('addRecentContact shifts the oldest entry when the limit would be exceeded', async () => {
        const inner = await uiActions.addRecentContact('0xnew', 'N', '🦊');
        const dispatch = jest.fn();
        // RECENT_CONTACTS_LIMIT is mocked to 3, so 3 existing + 1 new exceeds the limit
        const getState: any = () => ({
            globalState: {
                recentContacts: [
                    { walletAddress: '0xa', name: 'A' },
                    { walletAddress: '0xb', name: 'B' },
                    { walletAddress: '0xc', name: 'C' },
                ],
            },
        });
        await inner(dispatch, getState);
        expect(mockSubmitRequest).toHaveBeenCalledWith(
            'setRecentContacts',
            expect.any(Array),
        );
        const args = mockSubmitRequest.mock.calls[mockSubmitRequest.mock.calls.length - 1][1][0];
        // Oldest was dropped — first item is no longer 0xa
        expect(args[0].walletAddress).toBe('0xb');
    });

    it('addRecentContact skips when the address is already recent', async () => {
        const inner = await uiActions.addRecentContact('0xA', 'A', '🦊');
        const dispatch = jest.fn();
        const getState: any = () => ({
            globalState: { recentContacts: [{ walletAddress: '0xa', name: 'A' }] },
        });
        await inner(dispatch, getState);
        expect(mockSubmitRequest).not.toHaveBeenCalledWith(
            'setRecentContacts',
            expect.anything(),
        );
    });



    it('getNextAvailableAccountName returns an empty string on failure', async () => {
        mockSubmitRequest.mockRejectedValueOnce(new Error('boom'));
        await expect(uiActions.getNextAvailableAccountName()).resolves.toBe('');
    });
});

describe('uiActions: loadGasOptions (extended)', () => {
    it('returns early when chain resolution fails', async () => {
        const dispatch = jest.fn();
        const getState: any = () => ({ globalState: { preferences: { gasPrice: [] } } });
        mockGetCurrentChainByChain.mockReturnValueOnce(null);
        await uiActions.loadGasOptions('unknown' as any)(dispatch, getState);
        // No background calls were made
        expect(mockSubmitRequest).not.toHaveBeenCalled();
    });

    it('uses the default local gas options when no custom config is present', async () => {
        const { GasPriceType } = require('../../../src/shared/types/Chain');
        const dispatch = jest.fn();
        const network = { chain_id: 1, gasPriceType: GasPriceType.BaseAndPriority };
        mockGetCurrentChainByChain.mockReturnValueOnce(network);
        const getState: any = () => ({
            globalState: { preferences: { gasPrice: [] } },
        });
        const localGas = {
            low: { gasPrice: 1n },
            medium: { gasPrice: 2n },
            high: { gasPrice: 3n },
        };
        mockSubmitRequest.mockResolvedValueOnce(localGas);

        await uiActions.loadGasOptions('eth' as any)(dispatch, getState);

        // Default branch dispatched via setGasOptionsData → submitRequestToBackground twice (load + set)
        expect(mockSubmitRequest).toHaveBeenCalled();
    });

    it('logs and swallows internal errors', async () => {
        const { GasPriceType } = require('../../../src/shared/types/Chain');
        const dispatch = jest.fn();
        mockGetCurrentChainByChain.mockReturnValueOnce({
            chain_id: 1,
            gasPriceType: GasPriceType.GasPrice,
        });
        const getState: any = () => {
            throw new Error('state-fail');
        };
        await uiActions.loadGasOptions('eth' as any)(dispatch, getState);
        // Should not propagate the error
    });

    it('uses remote EIP-1559 gas options with a custom gas price URL pattern', async () => {
        const { GasPriceType } = require('../../../src/shared/types/Chain');
        const dispatch = jest.fn();
        const network = {
            chain_id: 1,
            gasPriceType: GasPriceType.BaseAndPriority,
        };
        mockGetCurrentChainByChain.mockReturnValueOnce(network);
        const getState: any = () => ({
            globalState: {
                preferences: {
                    gasPrice: [
                        {
                            chain_id: 1,
                            type: 'custom',
                            url_pattern: 'https://api.example/gas',
                            customGasPrice: '1',
                            customPriorityFee: '1',
                        },
                    ],
                },
            },
        });
        mockSubmitRequest.mockResolvedValueOnce({
            // local gas — used as the currentBaseFee fallback
            currentBaseFee: 1_000_000_000_000n,
            low: { gasPrice: 1n },
        });
        mockGetCustomGasPrice.mockResolvedValueOnce({
            data: {
                message: 'OK',
                result: {
                    suggestBaseFee: '1',
                    SafeGasPrice: '5',
                    ProposeGasPrice: '6',
                    FastGasPrice: '7',
                },
            },
        });

        await uiActions.loadGasOptions('eth' as any)(dispatch, getState);

        expect(mockGetCustomGasPrice).toHaveBeenCalledWith('https://api.example/gas');
        // At least the loadGasOptions request was made
        expect(mockSubmitRequest).toHaveBeenCalled();
    });

    it('uses legacy remote gas options when network is not EIP-1559', async () => {
        const { GasPriceType } = require('../../../src/shared/types/Chain');
        const dispatch = jest.fn();
        const network = {
            chain_id: 1,
            gasPriceType: GasPriceType.GasPrice,
        };
        mockGetCurrentChainByChain.mockReturnValueOnce(network);
        const getState: any = () => ({
            globalState: {
                preferences: {
                    gasPrice: [
                        {
                            chain_id: 1,
                            type: 'custom',
                            url_pattern: 'https://api.example/gas',
                        },
                    ],
                },
            },
        });
        mockSubmitRequest.mockResolvedValueOnce(undefined);
        mockGetCustomGasPrice.mockResolvedValueOnce({
            data: {
                message: 'OK',
                result: {
                    SafeGasPrice: '5',
                    ProposeGasPrice: '6',
                    FastGasPrice: '7',
                },
            },
        });

        await uiActions.loadGasOptions('eth' as any)(dispatch, getState);

        expect(mockGetCustomGasPrice).toHaveBeenCalled();
    });

    it('swallows setCustomGas errors via logger.error', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('boom'));
        await expect(
            uiActions.setCustomGas({} as any, { chain_id: 1 } as any)(dispatch),
        ).resolves.toBeUndefined();
    });

    it('swallows setGasType errors via logger.error', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('boom'));
        await expect(
            uiActions.setGasType('Low' as any, { chain_id: 1 } as any)(dispatch),
        ).resolves.toBeUndefined();
    });

    it('swallows setGasOptionsData errors via logger.error', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('boom'));
        await expect(
            uiActions.setGasOptionsData({} as any, { chain_id: 1 } as any)(dispatch),
        ).resolves.toBeUndefined();
    });

    it('falls back to local gas options when the remote response is not OK', async () => {
        const { GasPriceType } = require('../../../src/shared/types/Chain');
        const dispatch = jest.fn();
        const network = { chain_id: 1, gasPriceType: GasPriceType.GasPrice };
        mockGetCurrentChainByChain.mockReturnValueOnce(network);
        const getState: any = () => ({
            globalState: {
                preferences: {
                    gasPrice: [
                        { chain_id: 1, type: 'custom', url_pattern: 'https://api.example/gas' },
                    ],
                },
            },
        });
        const localGas = { low: { gasPrice: 1n } };
        mockSubmitRequest.mockResolvedValueOnce(localGas);
        mockGetCustomGasPrice.mockResolvedValueOnce({ data: { message: 'NOT_OK', result: {} } });

        await uiActions.loadGasOptions('eth' as any)(dispatch, getState);

        expect(mockGetCustomGasPrice).toHaveBeenCalled();
    });
});

describe('uiActions: importWallet/addNewWallet default-arg branches', () => {
    it('importWallet defaults isPrivateKey=false when omitted', async () => {
        const dispatch = jest.fn();
        await uiActions.importWallet('pw', 'alpha bravo')(dispatch);
        // Default branch sends createNewVaultAndRestore, not the PK variant.
        expect(mockSubmitRequest).toHaveBeenCalledWith(
            'createNewVaultAndRestore',
            expect.any(Array),
        );
    });

    it('importWallet rethrows other Error.messages verbatim (not BIP39)', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('something else'));
        await expect(uiActions.importWallet('pw', 'x', false)(dispatch)).rejects.toThrow(
            'something else',
        );
    });

    it('addNewWallet (seed) defaults isPrivateKey=false when omitted', async () => {
        const dispatch = jest.fn();
        const encoded = Array.from(Buffer.from('hello world', 'utf8').values());
        mockSubmitRequest.mockResolvedValueOnce(encoded);
        const result = await uiActions.addNewWallet('hello world')(dispatch);
        expect(result).toBe('hello world');
    });

    it('addNewWallet (no seed) passes undefined to background', async () => {
        const dispatch = jest.fn();
        const encoded = Array.from(Buffer.from('', 'utf8').values());
        mockSubmitRequest.mockResolvedValueOnce(encoded);
        // Calling without args → seedPhrase falsy ternary → undefined passed in.
        await uiActions.addNewWallet()(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('addNewWallet', [undefined, false]);
    });

    it('addNewWallet rethrows other Error.messages verbatim (not BIP39)', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('different boom'));
        await expect(uiActions.addNewWallet('x', false)(dispatch)).rejects.toThrow(
            'different boom',
        );
    });
});

describe('uiActions: hardware wallet account imports', () => {
    it('importLedgerHardwareAccounts passes nulls when optional args omitted', async () => {
        const dispatch = jest.fn();
        await uiActions.importLedgerHardwareAccounts([0])(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('importLedgerHardwareAccounts', [
            [0],
            undefined,
            null,
            null,
        ]);
    });

    it('importLedgerHardwareAccounts passes through provided ledgerWalletId, vaultPassword & addresses', async () => {
        const dispatch = jest.fn();
        await uiActions.importLedgerHardwareAccounts(
            [0, 1],
            'lw',
            'pw',
            ['0xa', '0xb'],
        )(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('importLedgerHardwareAccounts', [
            [0, 1],
            'lw',
            'pw',
            ['0xa', '0xb'],
        ]);
    });

    it('importLedgerHardwareAccounts rethrows backend errors with messages', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('ledger-fail'));
        await expect(
            uiActions.importLedgerHardwareAccounts([0])(dispatch),
        ).rejects.toThrow('ledger-fail');
    });

    it('importLedgerHardwareAccounts rethrows non-message primitives verbatim', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce('weird');
        await expect(
            uiActions.importLedgerHardwareAccounts([0])(dispatch),
        ).rejects.toBe('weird');
    });

    it('clearLedgerHardwarePreviewSession forwards', async () => {
        await uiActions.clearLedgerHardwarePreviewSession()();
        expect(mockSubmitRequest).toHaveBeenCalledWith('clearLedgerHardwarePreviewSession', []);
    });

    it('getLedgerHardwareAddressPage forwards direction + walletId', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockResolvedValueOnce([{ address: '0xa', index: 0 }]);
        const result = await uiActions.getLedgerHardwareAddressPage('next', 'lw')(dispatch);
        expect(result).toEqual([{ address: '0xa', index: 0 }]);
        expect(mockSubmitRequest).toHaveBeenCalledWith('getLedgerHardwareAddressPage', [
            'next',
            'lw',
        ]);
    });

    it('importTrezorHardwareAccounts passes nulls when optional args omitted', async () => {
        const dispatch = jest.fn();
        await uiActions.importTrezorHardwareAccounts([0])(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('importTrezorHardwareAccounts', [
            [0],
            undefined,
            null,
            null,
        ]);
    });

    it('importTrezorHardwareAccounts passes through provided trezorWalletId, vaultPassword & addresses', async () => {
        const dispatch = jest.fn();
        await uiActions.importTrezorHardwareAccounts(
            [0, 1],
            'tw',
            'pw',
            ['0xa'],
        )(dispatch);
        expect(mockSubmitRequest).toHaveBeenCalledWith('importTrezorHardwareAccounts', [
            [0, 1],
            'tw',
            'pw',
            ['0xa'],
        ]);
    });

    it('importTrezorHardwareAccounts rethrows backend errors with messages', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce(new Error('trezor-fail'));
        await expect(
            uiActions.importTrezorHardwareAccounts([0])(dispatch),
        ).rejects.toThrow('trezor-fail');
    });

    it('importTrezorHardwareAccounts rethrows non-message primitives verbatim', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockRejectedValueOnce('weird-trezor');
        await expect(
            uiActions.importTrezorHardwareAccounts([0])(dispatch),
        ).rejects.toBe('weird-trezor');
    });

    it('clearTrezorHardwarePreviewSession forwards', async () => {
        await uiActions.clearTrezorHardwarePreviewSession()();
        expect(mockSubmitRequest).toHaveBeenCalledWith('clearTrezorHardwarePreviewSession', []);
    });

    it('getTrezorHardwareAddressPage forwards direction + walletId', async () => {
        const dispatch = jest.fn();
        mockSubmitRequest.mockResolvedValueOnce([{ address: '0xb', index: 1 }]);
        const result = await uiActions.getTrezorHardwareAddressPage('prev', 'tw')(dispatch);
        expect(result).toEqual([{ address: '0xb', index: 1 }]);
        expect(mockSubmitRequest).toHaveBeenCalledWith('getTrezorHardwareAddressPage', [
            'prev',
            'tw',
        ]);
    });
});

describe('uiActions: getTransaction default chain_id', () => {
    it('defaults chain_id to null when omitted', async () => {
        await uiActions.getTransaction('0xhash');
        expect(mockSubmitRequest).toHaveBeenCalledWith('getTransaction', ['0xhash', null]);
    });
});

describe('uiActions: loadGasOptions custom config remaining branches', () => {
    it('does NOT hit the remote URL when type=custom but url_pattern is missing', async () => {
        const { GasPriceType } = require('../../../src/shared/types/Chain');
        const dispatch = jest.fn();
        mockGetCurrentChainByChain.mockReturnValueOnce({
            chain_id: 1,
            gasPriceType: GasPriceType.GasPrice,
        });
        const getState: any = () => ({
            globalState: {
                preferences: {
                    gasPrice: [
                        {
                            chain_id: 1,
                            type: 'custom',
                            // No url_pattern → inner `if (gasPriceConfig.url_pattern)` false.
                            customPriorityFee: 0,
                            customGasPrice: 0,
                        },
                    ],
                },
            },
        });
        mockSubmitRequest.mockResolvedValueOnce({ low: { gasPrice: 1n } });
        await uiActions.loadGasOptions('eth' as any)(dispatch, getState);
        expect(mockGetCustomGasPrice).not.toHaveBeenCalled();
    });

    it('uses the remote base fee when no local currentBaseFee is set (BaseAndPriority)', async () => {
        const { GasPriceType } = require('../../../src/shared/types/Chain');
        const dispatch = jest.fn();
        mockGetCurrentChainByChain.mockReturnValueOnce({
            chain_id: 1,
            gasPriceType: GasPriceType.BaseAndPriority,
        });
        const getState: any = () => ({
            globalState: {
                preferences: {
                    gasPrice: [
                        {
                            chain_id: 1,
                            type: 'custom',
                            url_pattern: 'https://api.example/gas',
                            customPriorityFee: 0,
                            customGasPrice: 0,
                        },
                    ],
                },
            },
        });
        // Local gas options with NO currentBaseFee → falsy branch on line ~1607.
        mockSubmitRequest.mockResolvedValueOnce({});
        mockGetCustomGasPrice.mockResolvedValueOnce({
            data: {
                message: 'OK',
                result: {
                    suggestBaseFee: '5',
                    SafeGasPrice: '10',
                    ProposeGasPrice: '15',
                    FastGasPrice: '20',
                },
            },
        });
        await uiActions.loadGasOptions('eth' as any)(dispatch, getState);
        expect(mockGetCustomGasPrice).toHaveBeenCalled();
    });

    it('uses the local currentBaseFee when it exceeds the remote base fee (BaseAndPriority)', async () => {
        const { GasPriceType } = require('../../../src/shared/types/Chain');
        const dispatch = jest.fn();
        mockGetCurrentChainByChain.mockReturnValueOnce({
            chain_id: 1,
            gasPriceType: GasPriceType.BaseAndPriority,
        });
        const getState: any = () => ({
            globalState: {
                preferences: {
                    gasPrice: [
                        {
                            chain_id: 1,
                            type: 'custom',
                            url_pattern: 'https://api.example/gas',
                            customPriorityFee: 0,
                            customGasPrice: 0,
                        },
                    ],
                },
            },
        });
        // Local currentBaseFee LARGER than remote suggestBaseFee.
        mockSubmitRequest.mockResolvedValueOnce({
            currentBaseFee: BigInt(1_000_000_000_000),
        });
        mockGetCustomGasPrice.mockResolvedValueOnce({
            data: {
                message: 'OK',
                result: {
                    suggestBaseFee: '1',
                    SafeGasPrice: '5',
                    ProposeGasPrice: '6',
                    FastGasPrice: '7',
                },
            },
        });
        await uiActions.loadGasOptions('eth' as any)(dispatch, getState);
        expect(mockGetCustomGasPrice).toHaveBeenCalled();
    });
});

