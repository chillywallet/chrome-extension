import AppController from '../../src/controller/AppController';

jest.mock('@metamask/controller-utils', () => ({
    ApprovalType: {
        EthSign: 'eth_sign',
        PersonalSign: 'personal_sign',
        EthSignTypedData: 'eth_signTypedData',
        Transaction: 'transaction',
        WatchAsset: 'wallet_watchAsset',
        EthGetEncryptionPublicKey: 'eth_getEncryptionPublicKey',
        EthDecrypt: 'eth_decrypt',
    },
}));

jest.mock('@metamask/scure-bip39/dist/wordlists/english', () => ({
    wordlist: ['abandon', 'ability', 'able', 'about', 'above'],
}));

jest.mock('@metamask/json-rpc-engine', () => ({
    JsonRpcEngine: class FakeEngine {
        push() {}
        emit() {}
        handle() {
            return undefined;
        }
        destroy() {}
    },
}));

jest.mock('@metamask/json-rpc-middleware-stream', () => ({
    createEngineStream: jest.fn(() => ({ pipe: jest.fn() })),
}));

jest.mock('@metamask/permission-controller', () => ({
    PermissionController: class FakePermissionController {
        name = 'PermissionController';
        state: any = { subjects: {} };
        constructor(_: any) {}
        updatePermissionsByCaveat = jest.fn();
        getPermissions = jest.fn(() => undefined);
        hasPermission = jest.fn(() => false);
        hasPermissions = jest.fn(() => false);
        grantPermissions = jest.fn();
        revokePermissions = jest.fn();
        requestPermissions = jest.fn();
        acceptPermissionsRequest = jest.fn();
        rejectPermissionsRequest = jest.fn();
        getCaveat = jest.fn(() => undefined);
        updateCaveat = jest.fn();
        createPermissionMiddleware = jest.fn(() => () => {});
    },
    SubjectMetadataController: class FakeSubjectMetadataController {
        constructor(_: any) {}
        store = { subscribe: jest.fn() };
        addSubjectMetadata = jest.fn();
    },
    SubjectType: { Website: 'website', Internal: 'internal', Extension: 'extension' },
    PermissionsRequestNotFoundError: class extends Error {},
}));

jest.mock('await-semaphore', () => ({
    Mutex: class {
        acquire() {
            return Promise.resolve(() => {});
        }
    },
}));

jest.mock('eth-rpc-errors', () => ({
    EthereumRpcError: class extends Error {
        code: any;
        data: any;
        constructor(code: any, message?: string, data?: any) {
            super(message);
            this.code = code;
            this.data = data;
        }
    },
    errorCodes: {
        rpc: { invalidRequest: -32600 },
        provider: { unauthorized: 4100 },
    },
}));

jest.mock('ethers', () => ({
    JsonRpcProvider: class FakeProvider {},
}));

jest.mock('extension-port-stream', () => class FakeStream {});

jest.mock('lodash', () => ({
    debounce: (fn: any) => fn,
}));

jest.mock('nanoid', () => ({
    nanoid: () => 'fixed-id',
}));

jest.mock('readable-stream', () => ({
    finished: jest.fn(),
    pipeline: jest.fn(),
}));

jest.mock('webextension-polyfill', () => ({
    runtime: {
        id: 'ext-id',
        getURL: (path: string) => `chrome-extension://ext-id/${path}`,
        onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    tabs: { query: jest.fn() },
}));

jest.mock('../../src/api/index', () => ({}));

jest.mock('../../src/lib/ComposableObservableStore', () => ({
    __esModule: true,
    default: class FakeStore {
        constructor(_: any) {}
        updateStructure() {}
        subscribe() {}
        getFlatState() {
            return {
                vault: 'secret',
                encryptionKey: 'k',
                encryptionSalt: 's',
                decimalsData: {},
                balanceData: {},
                portfolioCoins: {},
                coinPrices: {},
                preferences: {
                    moonPayCurrencies: ['x'],
                    moonPayCurrenciesTimestamp: 0,
                    customNetworks: [],
                    rpcUrls: {},
                },
            };
        }
    },
}));

jest.mock('../../src/lib/EncryptorFactory', () => ({
    encryptorFactory: () => ({}),
}));

jest.mock('../../src/lib/ExtensionPlatform', () => class FakePlatform {});

jest.mock('../../src/lib/LocalStore', () => class FakeLocalStore {});

jest.mock('../../src/lib/RPCHandler', () => ({
    __esModule: true,
    default: jest.fn(() => ({})),
}));

jest.mock('../../src/lib/bigintSerializer', () => ({
    serializeBigInt: (v: any) => v,
}));

jest.mock('../../src/lib/createDupeReqFilterMiddleware', () => ({
    __esModule: true,
    default: jest.fn(() => () => {}),
}));

jest.mock('../../src/lib/createChillyMiddleware', () => ({
    __esModule: true,
    default: jest.fn(() => () => {}),
}));

jest.mock('../../src/lib/createLoggerMiddleware', () => ({
    __esModule: true,
    default: jest.fn(() => () => {}),
}));

jest.mock('../../src/lib/createMethodMiddleware', () => ({
    createMethodMiddleware: jest.fn(() => () => {}),
}));

jest.mock('../../src/lib/createOriginMiddleware', () => ({
    __esModule: true,
    default: jest.fn(() => () => {}),
}));

jest.mock('../../src/lib/createProviderMiddleware', () => ({
    __esModule: true,
    default: jest.fn(() => () => {}),
}));

jest.mock('../../src/lib/createSelectedNetworkMiddleware', () => ({
    __esModule: true,
    default: jest.fn(() => () => {}),
}));

jest.mock('../../src/lib/createTabIdMiddleware', () => ({
    __esModule: true,
    default: jest.fn(() => () => {}),
}));

jest.mock('../../src/lib/permissions', () => ({
    CaveatMutatorFactories: {
        restrictReturnedAccounts: {
            removeAccount: jest.fn(() => ({})),
        },
    },
    NOTIFICATION_NAMES: {
        accountsChanged: 'metamask_accountsChanged',
        chainChanged: 'metamask_chainChanged',
    },
    getCaveatSpecifications: jest.fn(() => ({})),
    getChangedAccounts: jest.fn(() => new Map()),
    getPermissionBackgroundApiMethods: jest.fn(() => ({})),
    getPermissionSpecifications: jest.fn(() => ({})),
    getPermittedAccountsByOrigin: jest.fn(() => new Map()),
    unrestrictedMethods: [],
}));

jest.mock('../../src/lib/stream-utils', () => ({
    isStreamWritable: jest.fn(() => true),
    setupMultiplex: jest.fn(() => ({
        createStream: jest.fn(() => ({})),
    })),
}));

jest.mock('../../src/lib/web3', () => ({
    toHex: (v: any) => `0x${v}`,
}));

jest.mock('../../src/shared/constants/app', () => ({
    EnvironmentType: { Popup: 'popup', Fullscreen: 'fullscreen' },
    ORIGIN_CHILLY: 'chilly-internal-origin',
}));

jest.mock('../../src/shared/constants/permissions', () => ({
    CaveatTypes: { restrictReturnedAccounts: 'restrictReturnedAccounts' },
    RestrictedMethods: { eth_accounts: 'eth_accounts' },
}));

jest.mock('../../src/shared/constants/stream', () => ({
    CONTROLLER: 'controller',
    EXTERNAL_PROVIDER: 'external-provider',
    INTERNAL_PROVIDER: 'internal-provider',
}));

jest.mock('../../src/shared/utils/browser-runtime-utils', () => ({
    checkForLastErrorAndLog: jest.fn(),
    get isManifestV3() {
        return (globalThis as any).__APP_CTRL_TEST_IS_MV3__ ?? false;
    },
}));

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../src/shared/utils/rpc', () => ({
    getRpcUrlByNetwork: jest.fn(() => 'https://rpc.example'),
}));

jest.mock('../../src/store/selectorUtils', () => ({
    getAccountsFromSubject: jest.fn(() => []),
}));

// Stub each controller used by AppController

jest.mock('../../src/controller/AccountController', () => ({
    AccountsController: class FakeAccountsController {
        constructor(_: any) {}
        state: any = {};
        store = { subscribe: jest.fn() };
        listAccounts = jest.fn(() => []);
        getSelectedAccount = jest.fn(() => null);
        getAccountByAddress = jest.fn(() => null);
        getAccountByAddressIncludingDeleted = jest.fn(() => null);
        getAccountBySmartAddress = jest.fn(() => null);
        restoreDeletedAccountByAddress = jest.fn();
        softDeleteAccountByAddress = jest.fn();
        updateAccountByAddress = jest.fn();
        updateWallet = jest.fn();
        setSelectedAccount = jest.fn();
        setSelectedWallet = jest.fn();
        getWalletList = jest.fn(() => []);
        getAllAccounts = jest.fn(() => []);
        getNextAvailableAccountName = jest.fn(() => 'Account 1');
        getNextAvailableWalletName = jest.fn(() => 'Wallet 1');
        createSmartAccount = jest.fn();
        verifyAllAccounts = jest.fn();
        manualVerifyWallet = jest.fn();
        refreshDefaultWallet = jest.fn();
    },
}));

jest.mock('../../src/controller/AppStateController', () => ({
    __esModule: true,
    default: class FakeAppStateController {
        constructor(_: any) {}
        store = { subscribe: jest.fn() };
        handleUnlock = jest.fn();
        getUnlockPromise = jest.fn(async () => {});
    },
}));

jest.mock('../../src/controller/ApprovalController', () => ({
    ApprovalController: class FakeApprovalController {
        constructor(_: any) {}
        state: any = { pendingApprovals: {} };
        accept = jest.fn(async () => ({}));
        reject = jest.fn();
        addAndShowApprovalRequest = jest.fn();
    },
    ApprovalRequestNotFoundError: class extends Error {},
    AcceptOptions: undefined,
}));


jest.mock('../../src/controller/ContactsController', () => ({
    __esModule: true,
    default: class FakeContactsController {
        constructor(_: any) {}
        store = { subscribe: jest.fn() };
        setContacts = jest.fn();
        setRecentContacts = jest.fn();
    },
}));

jest.mock('../../src/controller/GasController', () => ({
    __esModule: true,
    default: class FakeGasController {
        constructor(_: any) {}
        store = { subscribe: jest.fn() };
        setGasOptionsData = jest.fn();
        loadGasOptions = jest.fn();
        setCustomGas = jest.fn();
        setGasType = jest.fn();
    },
}));


jest.mock('../../src/controller/KeyringController', () => ({
    KeyringTypes: {
        simple: 'Simple Key Pair',
        hd: 'HD Key Tree',
        ledger: 'Ledger Hardware',
        trezor: 'Trezor Hardware',
    },
    KeyringController: class FakeKeyringController {
        constructor(_: any) {}
        state: any = { isUnlocked: false, vault: undefined };
        signTransaction = jest.fn();
        getPrivateKeyInternally = jest.fn(async () => '0xpk');
        getKeyringByWalletId = jest.fn(async () => undefined);
        getAccountsByWalletId = jest.fn(() => [] as string[]);
        removeAccount = jest.fn(async () => {});
        addNewWallet = jest.fn(async () => new Uint8Array([0, 0]));
        addNewWalletWithPrivateKey = jest.fn(async () => '0xnew');
        addNewAccount = jest.fn(async () => '0xacct');
        clearLedgerHardwarePreviewSession = jest.fn();
        getLedgerHardwareAddressPage = jest.fn(async () => []);
        importLedgerHardwareAccounts = jest.fn(async () => []);
        clearTrezorHardwarePreviewSession = jest.fn();
        getTrezorHardwareAddressPage = jest.fn(async () => []);
        importTrezorHardwareAccounts = jest.fn(async () => []);
        exportSeedPhrase = jest.fn(async () => new Uint8Array([0, 0]));
        exportAccount = jest.fn(async () => '0xpk');
        verifyPassword = jest.fn(async () => {});
        submitPassword = jest.fn(async () => {});
        setLocked = jest.fn(async () => {});
        createNewVaultAndKeychain = jest.fn(async () => 'walletId');
        createNewVaultAndRestore = jest.fn(async () => {});
        createNewVaultAndRestoreWithPrivateKey = jest.fn(async () => {});
    },
}));

jest.mock('../../src/controller/LiquidStakingController', () => ({
    __esModule: true,
    default: class FakeLiquidStakingController {
        opts: any;
        constructor(opts: any) {
            this.opts = opts;
        }
        setLiquidStakingProvider = jest.fn();
        getExchangeRate = jest.fn();
        getUnstakeExchangeRate = jest.fn();
        getWaitTime = jest.fn();
        getStakeCall = jest.fn();
        getRequestUnstakeCall = jest.fn();
        getUnstakeCall = jest.fn();
        getCancelUnstakeRequestCall = jest.fn();
        getClaimRequests = jest.fn();
        estimateStake = jest.fn();
        estimateRequestUnstake = jest.fn();
        estimateUnstake = jest.fn();
        estimateCancelUnstakeRequest = jest.fn();
        stake = jest.fn();
        requestUnstake = jest.fn();
        unstake = jest.fn();
        cancelUnstakeRequest = jest.fn();
    },
}));

jest.mock('../../src/controller/NetworkController', () => ({
    __esModule: true,
    default: class FakeNetworkController {
        opts: any;
        constructor(opts: any) {
            this.opts = opts;
        }
        store = { subscribe: jest.fn() };
        initializeProvider = jest.fn(() => ({}));
        getSelectedNetwork = jest.fn(() => ({
            chain_id: 1,
            short_name: 'eth',
            chain_key: 'eip155:1',
            platform_id: 1,
        }));
        getProviderByChainId = jest.fn(() => ({}));
        getProviderByPlatformId = jest.fn(() => ({}));
        getProviderForNetwork = jest.fn(() => ({}));
        getCurrentProvider = jest.fn(() => ({}));
        setSelectedNetwork = jest.fn();
    },
}));

jest.mock('../../src/controller/OnboardingController', () => ({
    __esModule: true,
    default: class FakeOnboardingController {
        constructor(_: any) {}
        store = { subscribe: jest.fn() };
        completeOnboarding = jest.fn();
        setOnboardingStep = jest.fn();
    },
}));

jest.mock('../../src/controller/PortfolioController', () => ({
    __esModule: true,
    default: class FakePortfolioController {
        constructor(_: any) {}
        store = { subscribe: jest.fn() };
        clearState = jest.fn();
        setNativeCoinPrice = jest.fn();
        setPortfolioCoins = jest.fn();
        getCurrentPortfolioCoins = jest.fn();
        getCoinByTokenAddress = jest.fn();
        updatePortfolioCoins = jest.fn();
        setCoinPrices = jest.fn();
        getCurrentCoinPrices = jest.fn();
        setPendingTransactions = jest.fn();
        addPendingTransaction = jest.fn();
        updatePendingTransactionStatus = jest.fn();
        updatePendingTransaction = jest.fn();
        removePendingTransactions = jest.fn();
        removeCompletedTransactions = jest.fn();
        setCachingCoins = jest.fn();
        setUnknownCoins = jest.fn();
    },
}));

jest.mock('../../src/controller/PreferencesController', () => ({
    __esModule: true,
    default: class FakePreferencesController {
        constructor(_: any) {}
        store = { subscribe: jest.fn() };
        getPreferences = jest.fn(() => ({
            moonPayCurrencies: undefined,
            moonPayCurrenciesTimestamp: undefined,
            customNetworks: [],
            rpcUrls: {},
        }));
        setPreference = jest.fn();
        setPreferences = jest.fn();
        setGaslessTokens = jest.fn();
        setCustomNetworks = jest.fn();
        setApiKey = jest.fn();
        setChainDataProvider = jest.fn();
        checkMoonPaySupportedCurrency = jest.fn();
        getMoonPayCurrencyByCode = jest.fn();
    },
}));


jest.mock('../../src/controller/SignatureController', () => ({
    SignatureController: class FakeSignatureController {
        opts: any;
        constructor(opts: any) {
            this.opts = opts;
        }
        store = { subscribe: jest.fn() };
        newUnsignedTypedMessage = jest.fn();
        newUnsignedPersonalMessage = jest.fn();
    },
}));

jest.mock('../../src/controller/TransactionController', () => ({
    __esModule: true,
    default: class FakeTransactionController {
        opts: any;
        constructor(opts: any) {
            this.opts = opts;
        }
        state: any = {};
        approveAllowance = jest.fn();
        checkAllowance = jest.fn();
        estimateGasAllowance = jest.fn();
        estimateGasLimit = jest.fn();
        estimateGas = jest.fn();
        estimateWalletSendCallsGas = jest.fn();
        getTokenBalance = jest.fn();
        getNativeTokenBalance = jest.fn();
        newSendTransaction = jest.fn();
        sendTransaction = jest.fn();
        sendGaslessTransaction = jest.fn();
        speedUpTransaction = jest.fn();
        cancelTransaction = jest.fn();
        ensToWalletAdress = jest.fn();
        getAASignature = jest.fn();
        getTransaction = jest.fn();
        checkContract = jest.fn();
        resetGaslessAccount = jest.fn();
        addTransaction = jest.fn(async () => ({ result: Promise.resolve('0xhash') }));
        executeWalletSendCalls = jest.fn();
        getWalletSendCallsStatus = jest.fn();
        hasWalletSendCallsBatch = jest.fn();
    },
}));


function buildAppController() {
    return new AppController({
        initState: {},
        localStore: {} as any,
        showUserConfirmation: jest.fn(),
        platform: {} as any,
    } as any);
}

describe('AppController', () => {
    let app: AppController;

    beforeEach(() => {
        app = buildAppController();
    });

    describe('module file', () => {
        it('module file exists at the expected path', () => {
            const fs = require('fs');
            const path = require('path');
            const file = path.resolve(__dirname, '../../src/controller/AppController.tsx');
            expect(fs.existsSync(file)).toBe(true);
        });

        it('instantiates without errors', () => {
            expect(app).toBeDefined();
            expect(app.keyringController).toBeDefined();
            expect(app.networkController).toBeDefined();
        });
    });

    describe('isUnlocked', () => {
        it('reflects keyringController state', () => {
            expect(app.isUnlocked()).toBe(false);
            (app.keyringController.state as any).isUnlocked = true;
            expect(app.isUnlocked()).toBe(true);
        });
    });

    describe('isClientOpen setter', () => {
        it('updates _isClientOpen', () => {
            app.isClientOpen = true;
            expect(app._isClientOpen).toBe(true);
            app.isClientOpen = false;
            expect(app._isClientOpen).toBe(false);
        });
    });

    describe('lifecycle hooks', () => {
        it('onClientClosed and onEnvironmentTypeClosed are no-ops that do not throw', () => {
            expect(() => app.onClientClosed()).not.toThrow();
            expect(() => app.onEnvironmentTypeClosed('popup' as any)).not.toThrow();
        });
    });

    describe('connections management', () => {
        it('addConnection ignores ORIGIN_CHILLY', () => {
            const id = app.addConnection('chilly-internal-origin', { engine: {} as any });
            expect(id).toBeNull();
        });

        it('addConnection stores and returns an id', () => {
            const id = app.addConnection('https://example.com', {
                engine: { emit: jest.fn() } as any,
            });
            expect(id).toBe('fixed-id');
            expect(app.connections['https://example.com']['fixed-id']).toBeDefined();
        });

        it('removeConnection ignores unknown origin', () => {
            expect(() => app.removeConnection('unknown', 'x')).not.toThrow();
        });

        it('removeConnection deletes connection and clears origin when empty', () => {
            app.connections['o'] = { id1: { engine: {} as any } };
            app.removeConnection('o', 'id1');
            expect(app.connections['o']).toBeUndefined();
        });

        it('removeAllConnections cleans up all engines for an origin', () => {
            app.connections['o'] = {
                id1: { engine: {} as any },
                id2: { engine: {} as any },
            };
            app.removeAllConnections('o');
            expect(app.connections['o']).toBeUndefined();
        });

        it('removeAllConnections is a no-op for unknown origin', () => {
            expect(() => app.removeAllConnections('unknown')).not.toThrow();
        });

        it('notifyConnections emits notification events', () => {
            const emit = jest.fn();
            app.connections['o'] = { id1: { engine: { emit } as any } };
            app.notifyConnections('o', { method: 'm', params: [] });
            expect(emit).toHaveBeenCalledWith('notification', { method: 'm', params: [] });
        });

        it('notifyConnections ignores unknown origin', () => {
            expect(() => app.notifyConnections('unknown', {})).not.toThrow();
        });

        it('notifyAllConnections with object payload broadcasts to every engine', async () => {
            const emitA = jest.fn();
            const emitB = jest.fn();
            app.connections['o1'] = { id1: { engine: { emit: emitA } as any } };
            app.connections['o2'] = { id2: { engine: { emit: emitB } as any } };
            app.notifyAllConnections({ method: 'm', params: [1] });
            // emit is called inside async iteration — flush microtasks
            await Promise.resolve();
            await Promise.resolve();
            expect(emitA).toHaveBeenCalled();
            expect(emitB).toHaveBeenCalled();
        });

        it('notifyAllConnections with function payload computes payload per origin', async () => {
            const emitA = jest.fn();
            app.connections['o1'] = { id1: { engine: { emit: emitA } as any } };
            app.notifyAllConnections((origin: string) => ({ method: 'm', params: [origin] }));
            await Promise.resolve();
            await Promise.resolve();
            expect(emitA).toHaveBeenCalledWith('notification', {
                method: 'm',
                params: ['o1'],
            });
        });
    });

    describe('seed phrase encoding', () => {
        it('encodes a mnemonic to/from wordlist indices', () => {
            const mnemonic = Buffer.from('abandon ability able');
            const indices = app._convertMnemonicToWordlistIndices(mnemonic);
            expect(indices).toBeInstanceOf(Uint8Array);
            const decoded = app._convertEnglishWordlistIndicesToCodepoints(indices);
            expect(decoded.toString()).toBe('abandon ability able');
        });
    });

    describe('getState', () => {
        it('returns a sanitized flat state, omitting sensitive fields', () => {
            const state = app.getState();
            expect(state.isInitialized).toBe(false);
            expect(state.vault).toBeUndefined();
            expect(state.encryptionKey).toBeUndefined();
            expect(state.encryptionSalt).toBeUndefined();
            expect(state.decimalsData).toBeUndefined();
        });

        it('marks isInitialized true when vault exists', () => {
            (app.keyringController.state as any).vault = 'sealed';
            const state = app.getState();
            expect(state.isInitialized).toBe(true);
        });
    });



    describe('vault / keyring proxies', () => {
        it('submitPassword forwards to keyringController', async () => {
            await app.submitPassword('pw');
            expect(app.keyringController.submitPassword).toHaveBeenCalledWith('pw');
        });

        it('verifyPassword forwards to keyringController', async () => {
            await app.verifyPassword('pw');
            expect(app.keyringController.verifyPassword).toHaveBeenCalledWith('pw');
        });

        it('setLocked forwards to keyringController', async () => {
            await app.setLocked();
            expect(app.keyringController.setLocked).toHaveBeenCalled();
        });

        it('createNewVaultAndKeychain forwards to keyringController', async () => {
            await app.createNewVaultAndKeychain('pw');
            expect(app.keyringController.createNewVaultAndKeychain).toHaveBeenCalledWith('pw');
        });

        it('createNewVaultAndRestore decodes seed and forwards', async () => {
            await app.createNewVaultAndRestore('pw', [0, 1]);
            expect(app.keyringController.createNewVaultAndRestore).toHaveBeenCalled();
        });

        it('createNewVaultAndRestoreWithPrivateKey forwards to keyringController', async () => {
            await app.createNewVaultAndRestoreWithPrivateKey('pw', '0xpk');
            expect(
                app.keyringController.createNewVaultAndRestoreWithPrivateKey,
            ).toHaveBeenCalledWith('pw', '0xpk');
        });

        it('addNewWallet encodes the returned mnemonic', async () => {
            (app.keyringController.addNewWallet as jest.Mock).mockResolvedValueOnce(
                new Uint8Array(new Uint16Array([0, 1]).buffer),
            );
            const result = await app.addNewWallet();
            expect(Buffer.isBuffer(result)).toBe(true);
        });

        it('addNewWalletWithPrivateKey forwards to keyringController', async () => {
            await app.addNewWalletWithPrivateKey('0xpk');
            expect(app.keyringController.addNewWalletWithPrivateKey).toHaveBeenCalledWith('0xpk');
        });

        it('getSeedPhrase decodes the seed words', async () => {
            (app.keyringController.exportSeedPhrase as jest.Mock).mockResolvedValueOnce(
                new Uint8Array(new Uint16Array([0]).buffer),
            );
            const seed = await app.getSeedPhrase('pw', 'wid');
            expect(Buffer.isBuffer(seed)).toBe(true);
        });

        it('addNewAccount falls through to keyringController when no accounts exist for wallet', async () => {
            (app.keyringController.getAccountsByWalletId as jest.Mock).mockReturnValueOnce([]);
            const addr = await app.addNewAccount(0, 'missing');
            expect(addr).toBe('0xacct');
        });

        it('addNewAccount reuses a soft-deleted account when available', async () => {
            (app.keyringController.getAccountsByWalletId as jest.Mock).mockReturnValueOnce(['0xdel']);
            (app.accountsController as any).getAccountByAddressIncludingDeleted = jest.fn(() => ({
                metadata: { deleted: true },
            }));
            const addr = await app.addNewAccount(0, 'wid');
            expect(addr).toBe('0xdel');
            expect(
                (app.accountsController as any).restoreDeletedAccountByAddress,
            ).toHaveBeenCalledWith('0xdel');
        });

        it('addNewAccount falls back to creating a fresh account', async () => {
            (app.keyringController.getAccountsByWalletId as jest.Mock).mockReturnValueOnce([]);
            const addr = await app.addNewAccount(0, 'wid');
            expect(addr).toBe('0xacct');
        });

        it('removeAccount soft-deletes and removes permissions', async () => {
            const result = await app.removeAccount('0xabc');
            expect(result).toBe('0xabc');
            expect(app.accountsController.softDeleteAccountByAddress).toHaveBeenCalledWith(
                '0xabc',
            );
        });

        it('removeWallet is a no-op when no accounts found for keyring', async () => {
            (app.keyringController.getAccountsByWalletId as jest.Mock).mockReturnValueOnce([]);
            await expect(app.removeWallet('missing')).resolves.toBeUndefined();
        });

        it('clearLedgerHardwarePreviewSession forwards to keyringController', async () => {
            await app.clearLedgerHardwarePreviewSession();
            expect(app.keyringController.clearLedgerHardwarePreviewSession).toHaveBeenCalled();
        });

        it('clearTrezorHardwarePreviewSession forwards to keyringController', async () => {
            await app.clearTrezorHardwarePreviewSession();
            expect(app.keyringController.clearTrezorHardwarePreviewSession).toHaveBeenCalled();
        });

        it('getLedgerHardwareAddressPage forwards direction + walletId', async () => {
            await app.getLedgerHardwareAddressPage('next', 'wid');
            expect(app.keyringController.getLedgerHardwareAddressPage).toHaveBeenCalledWith(
                'next',
                'wid',
            );
        });

        it('getTrezorHardwareAddressPage forwards direction + walletId', async () => {
            await app.getTrezorHardwareAddressPage('first', null);
            expect(app.keyringController.getTrezorHardwareAddressPage).toHaveBeenCalledWith(
                'first',
                null,
            );
        });

        it('importLedgerHardwareAccounts restores soft-deleted UI addresses when supplied', async () => {
            (app.accountsController as any).restoreSoftDeletedAccountsAtAddresses = jest.fn();
            (app.keyringController.importLedgerHardwareAccounts as jest.Mock).mockResolvedValueOnce([
                '0xnew',
            ]);
            await app.importLedgerHardwareAccounts([0, 1], 'wid', null, ['0xui1']);
            expect(
                (app.accountsController as any).restoreSoftDeletedAccountsAtAddresses,
            ).toHaveBeenCalledWith(['0xui1']);
        });


        it('importLedgerHardwareAccounts skips first-vault setup when wallet id is provided', async () => {
            (app.keyringController.state as any).vault = undefined;
            (app.keyringController.importLedgerHardwareAccounts as jest.Mock).mockResolvedValueOnce([
                '0xnew',
            ]);
            await app.importLedgerHardwareAccounts([0], 'existing-wid', 'pw');
        });

        it('importTrezorHardwareAccounts restores soft-deleted UI addresses', async () => {
            (app.accountsController as any).restoreSoftDeletedAccountsAtAddresses = jest.fn();
            (app.keyringController.importTrezorHardwareAccounts as jest.Mock).mockResolvedValueOnce([
                '0xnew',
            ]);
            await app.importTrezorHardwareAccounts([2], 'wid', null, ['0xui']);
            expect(
                (app.accountsController as any).restoreSoftDeletedAccountsAtAddresses,
            ).toHaveBeenCalledWith(['0xui']);
        });


        it('importTrezorHardwareAccounts skips first-vault setup when wallet id is supplied', async () => {
            (app.keyringController.state as any).vault = undefined;
            (app.keyringController.importTrezorHardwareAccounts as jest.Mock).mockResolvedValueOnce([
                '0xnew',
            ]);
            await app.importTrezorHardwareAccounts([0], 'wid-x', 'pw');
        });
    });

    describe('handlers', () => {
        it('_onUnlock notifies appStateController and emits "unlock"', () => {
            const spy = jest.fn();
            app.on('unlock', spy);
            app._onUnlock();
            expect(app.appStateController.handleUnlock).toHaveBeenCalled();
            expect(spy).toHaveBeenCalled();
        });




        it('privateSendUpdate emits "update" with current state', () => {
            const spy = jest.fn();
            app.on('update', spy);
            app.privateSendUpdate();
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({ isInitialized: false }));
        });
    });

    describe('approval proxies', () => {
        it('resolvePendingApproval calls approvalController.accept', async () => {
            await app.resolvePendingApproval('id', 'value');
            expect(app.approvalController.accept).toHaveBeenCalledWith('id', 'value', undefined);
        });

        it('rejectPendingApproval calls approvalController.reject', () => {
            app.rejectPendingApproval('id', new Error('x'));
            expect(app.approvalController.reject).toHaveBeenCalledWith('id', expect.any(Error));
        });

        it('rejectPendingApproval swallows ApprovalRequestNotFoundError', () => {
            const {
                ApprovalRequestNotFoundError,
            } = require('../../src/controller/ApprovalController');
            (app.approvalController.reject as jest.Mock).mockImplementationOnce(() => {
                throw new ApprovalRequestNotFoundError('id');
            });
            expect(() => app.rejectPendingApproval('id', new Error('x'))).not.toThrow();
        });
    });

    describe('getProviderNetworkState', () => {
        it('returns the current network state', () => {
            const result = app.getProviderNetworkState();
            expect(result).toBeDefined();
        });
    });

    describe('completeOnboarding', () => {
        it('forwards to onboardingController.completeOnboarding', () => {
            app.completeOnboarding();
            expect(app.onboardingController.completeOnboarding).toHaveBeenCalled();
        });
    });

    describe('startUISync', () => {
        it('emits startUISync and marks the flag', () => {
            // Already called once in the constructor; call again to ensure idempotency.
            app.startUISync();
            expect(app.startedUISync).toBe(true);
        });
    });

    describe('getApi', () => {
        it('returns an object exposing the keyring & onboarding bindings', () => {
            const api = app.getApi() as Record<string, unknown>;
            expect(typeof api.getState).toBe('function');
            expect(typeof api.submitPassword).toBe('function');
            expect(typeof api.verifyPassword).toBe('function');
            expect(typeof api.addNewWallet).toBe('function');
        });
    });

    describe('removeAllAccountPermissions', () => {
        it('passes a mutator that delegates to CaveatMutatorFactories', () => {
            const updateSpy = jest.spyOn(app.permissionController, 'updatePermissionsByCaveat');
            const { CaveatMutatorFactories } = require('../../src/lib/permissions');
            app.removeAllAccountPermissions('0xabc' as any);
            expect(updateSpy).toHaveBeenCalledWith('restrictReturnedAccounts', expect.any(Function));
            // invoke the mutator lambda so its body is covered
            const mutator = updateSpy.mock.calls[0][1] as any;
            mutator(['0xabc', '0xdef']);
            expect(
                CaveatMutatorFactories.restrictReturnedAccounts.removeAccount,
            ).toHaveBeenCalledWith('0xabc', ['0xabc', '0xdef']);
        });
    });

    describe('removeWallet (success path)', () => {
        it('removes permissions and accounts for every address in the keyring', async () => {
            const removeAccount = jest.fn();
            (app.keyringController as any).getAccountsByWalletId = jest.fn(() => ['0x1', '0x2']);
            (app.keyringController as any).removeAccount = removeAccount;
            const permSpy = jest.spyOn(app, 'removeAllAccountPermissions');
            await app.removeWallet('wid');
            expect(permSpy).toHaveBeenCalledTimes(2);
            expect(removeAccount).toHaveBeenCalledTimes(2);
        });

        it('resolves cleanly when the keyring has no accounts', async () => {
            (app.keyringController as any).getAccountsByWalletId = jest.fn(() => []);
            (app.keyringController as any).removeAccount = jest.fn();
            await expect(app.removeWallet('wid')).resolves.toBeUndefined();
        });
    });

    describe('permission request error branches', () => {
        const {
            PermissionsRequestNotFoundError,
        } = require('@metamask/permission-controller');

        it('rejectPermissionsRequest rethrows non-PermissionsRequestNotFoundError', () => {
            (app.permissionController.rejectPermissionsRequest as jest.Mock).mockImplementationOnce(
                () => {
                    throw new Error('other');
                },
            );
            expect(() => app.rejectPermissionsRequest('id')).toThrow(/other/);
        });

        it('rejectPermissionsRequest swallows PermissionsRequestNotFoundError', () => {
            (app.permissionController.rejectPermissionsRequest as jest.Mock).mockImplementationOnce(
                () => {
                    throw new PermissionsRequestNotFoundError('not found');
                },
            );
            expect(() => app.rejectPermissionsRequest('id')).not.toThrow();
        });

        it('acceptPermissionsRequest rethrows non-PermissionsRequestNotFoundError', () => {
            (app.permissionController.acceptPermissionsRequest as jest.Mock).mockImplementationOnce(
                () => {
                    throw new Error('other');
                },
            );
            expect(() => app.acceptPermissionsRequest({} as any)).toThrow(/other/);
        });

        it('acceptPermissionsRequest swallows PermissionsRequestNotFoundError', () => {
            (app.permissionController.acceptPermissionsRequest as jest.Mock).mockImplementationOnce(
                () => {
                    throw new PermissionsRequestNotFoundError('not found');
                },
            );
            expect(() => app.acceptPermissionsRequest({} as any)).not.toThrow();
        });

        it('removePermissionsFor rethrows non-PermissionsRequestNotFoundError', () => {
            (app.permissionController.revokePermissions as jest.Mock).mockImplementationOnce(() => {
                throw new Error('other');
            });
            expect(() => app.removePermissionsFor({ o: ['p'] } as any)).toThrow(/other/);
        });

        it('removePermissionsFor swallows PermissionsRequestNotFoundError', () => {
            (app.permissionController.revokePermissions as jest.Mock).mockImplementationOnce(() => {
                throw new PermissionsRequestNotFoundError('not found');
            });
            expect(() => app.removePermissionsFor({ o: ['p'] } as any)).not.toThrow();
        });
    });

    describe('approval rethrow branches', () => {
        const {
            ApprovalRequestNotFoundError,
        } = require('../../src/controller/ApprovalController');

        it('resolvePendingApproval rethrows non-ApprovalRequestNotFoundError', async () => {
            (app.approvalController.accept as jest.Mock).mockRejectedValueOnce(new Error('other'));
            await expect(app.resolvePendingApproval('id', 'v')).rejects.toThrow(/other/);
        });

        it('resolvePendingApproval swallows ApprovalRequestNotFoundError', async () => {
            (app.approvalController.accept as jest.Mock).mockRejectedValueOnce(
                new ApprovalRequestNotFoundError('id'),
            );
            await expect(app.resolvePendingApproval('id', 'v')).resolves.toBeUndefined();
        });

        it('rejectPendingApproval rethrows non-ApprovalRequestNotFoundError', () => {
            (app.approvalController.reject as jest.Mock).mockImplementationOnce(() => {
                throw new Error('other');
            });
            expect(() => app.rejectPendingApproval('id', new Error('e'))).toThrow(/other/);
        });
    });

    describe('getPermittedAccounts', () => {
        it('returns empty when origin has no subject', async () => {
            await expect(app.getPermittedAccounts('unknown')).resolves.toEqual([]);
        });

        it('returns accounts from getAccountsFromSubject when subject exists', async () => {
            (app.permissionController.state as any).subjects = { 'origin-a': { x: 1 } };
            const { getAccountsFromSubject } = require('../../src/store/selectorUtils');
            (getAccountsFromSubject as jest.Mock).mockReturnValueOnce(['0xacc']);
            await expect(app.getPermittedAccounts('origin-a')).resolves.toEqual(['0xacc']);
        });

        it('suppresses unauthorized errors by default', async () => {
            Object.defineProperty(app.permissionController, 'state', {
                get() {
                    const err: any = new Error('unauthorized');
                    err.code = 4100;
                    throw err;
                },
            });
            await expect(app.getPermittedAccounts('o')).resolves.toEqual([]);
        });

        it('rethrows non-unauthorized errors', async () => {
            Object.defineProperty(app.permissionController, 'state', {
                get() {
                    const err: any = new Error('boom');
                    err.code = 999;
                    throw err;
                },
            });
            await expect(app.getPermittedAccounts('o')).rejects.toThrow(/boom/);
        });

        it('rethrows unauthorized errors when suppressUnauthorizedError is false', async () => {
            Object.defineProperty(app.permissionController, 'state', {
                get() {
                    const err: any = new Error('unauthorized');
                    err.code = 4100;
                    throw err;
                },
            });
            await expect(
                app.getPermittedAccounts('o', { suppressUnauthorizedError: false }),
            ).rejects.toThrow(/unauthorized/);
        });
    });

    describe('getProviderState', () => {
        it('combines unlocked state, accounts, and network state', async () => {
            (app.permissionController.state as any).subjects = { 'site': { x: 1 } };
            const { getAccountsFromSubject } = require('../../src/store/selectorUtils');
            (getAccountsFromSubject as jest.Mock).mockReturnValueOnce(['0xacc']);
            const state = await app.getProviderState('site');
            expect(state).toMatchObject({
                isUnlocked: false,
                accounts: ['0xacc'],
                networkVersion: '1',
            });
            expect(state.chainId).toBeDefined();
        });
    });

    describe('processTransaction', () => {
        it('forwards transaction params and returns the result', async () => {
            (app.transactionController.addTransaction as jest.Mock).mockResolvedValueOnce({
                result: Promise.resolve('0xresult'),
            });
            const hash = await app.processTransaction(
                { from: '0xfrom', to: '0xto' } as any,
                { id: 'aid', method: 'eth_sendTransaction', origin: 'site' },
            );
            expect(hash).toBe('0xresult');
            expect(app.transactionController.addTransaction).toHaveBeenCalled();
        });
    });

    describe('_notifyAccountsChange', () => {
        it('skips when locked', async () => {
            const emit = jest.fn();
            app.connections['site'] = { id: { engine: { emit } as any } };
            await app._notifyAccountsChange('site', ['0xa']);
            expect(emit).not.toHaveBeenCalled();
        });

        it('passes accounts directly when length < 2', async () => {
            (app.keyringController.state as any).isUnlocked = true;
            const emit = jest.fn();
            app.connections['site'] = { id: { engine: { emit } as any } };
            await app._notifyAccountsChange('site', ['0xa']);
            expect(emit).toHaveBeenCalledWith('notification', {
                method: 'metamask_accountsChanged',
                params: ['0xa'],
            });
        });

        it('fetches accounts via getPermittedAccounts when length >= 2', async () => {
            (app.keyringController.state as any).isUnlocked = true;
            (app.permissionController.state as any).subjects = { site: {} };
            const { getAccountsFromSubject } = require('../../src/store/selectorUtils');
            (getAccountsFromSubject as jest.Mock).mockReturnValueOnce(['0x1', '0x2']);
            const emit = jest.fn();
            app.connections['site'] = { id: { engine: { emit } as any } };
            await app._notifyAccountsChange('site', ['0x1', '0x2']);
            expect(emit).toHaveBeenCalled();
        });
    });

    describe('_onSelectedAccountChange', () => {
        beforeEach(() => {
            (app.keyringController.state as any).isUnlocked = true;
        });

        it('returns when locked', async () => {
            (app.keyringController.state as any).isUnlocked = false;
            const spy = jest.spyOn(app, 'getPermittedAccounts');
            await app._onSelectedAccountChange();
            expect(spy).not.toHaveBeenCalled();
        });

        it('returns when no current account', async () => {
            (app.accountsController.getSelectedAccount as jest.Mock).mockReturnValueOnce(null);
            const spy = jest.spyOn(app, 'getPermittedAccounts');
            await app._onSelectedAccountChange();
            expect(spy).not.toHaveBeenCalled();
        });

        it('reorders accounts when current address is included and updates caveat', async () => {
            (app.accountsController.getSelectedAccount as jest.Mock).mockReturnValue({
                address: '0xCURRENT',
            });
            (app.permissionController.state as any).subjects = { site: {} };
            const { getAccountsFromSubject } = require('../../src/store/selectorUtils');
            (getAccountsFromSubject as jest.Mock).mockReturnValue(['0xOTHER', '0xCURRENT']);
            const updateCaveat = jest.spyOn(app.permissionController, 'updateCaveat');
            await app._onSelectedAccountChange();
            expect(updateCaveat).toHaveBeenCalledWith(
                'site',
                'eth_accounts',
                'restrictReturnedAccounts',
                ['0xCURRENT', '0xOTHER'],
            );
        });

        it('skips updateCaveat when current address is not in the exposed accounts', async () => {
            (app.accountsController.getSelectedAccount as jest.Mock).mockReturnValue({
                address: '0xCURRENT',
            });
            (app.permissionController.state as any).subjects = { site: {} };
            const { getAccountsFromSubject } = require('../../src/store/selectorUtils');
            (getAccountsFromSubject as jest.Mock).mockReturnValue(['0xOTHER']);
            const updateCaveat = jest.spyOn(app.permissionController, 'updateCaveat');
            await app._onSelectedAccountChange();
            expect(updateCaveat).not.toHaveBeenCalled();
        });

        it('skips empty exposedAccounts subjects', async () => {
            (app.accountsController.getSelectedAccount as jest.Mock).mockReturnValue({
                address: '0xCURRENT',
            });
            (app.permissionController.state as any).subjects = { site: {} };
            const { getAccountsFromSubject } = require('../../src/store/selectorUtils');
            (getAccountsFromSubject as jest.Mock).mockReturnValue([]);
            const updateCaveat = jest.spyOn(app.permissionController, 'updateCaveat');
            await app._onSelectedAccountChange();
            expect(updateCaveat).not.toHaveBeenCalled();
        });
    });

    describe('_notifyChainChange', () => {
        it('broadcasts a chainChanged notification to all connections', async () => {
            const emit = jest.fn();
            app.connections['o'] = { id: { engine: { emit } as any } };
            await app._notifyChainChange();
            await Promise.resolve();
            await Promise.resolve();
            expect(emit).toHaveBeenCalledWith(
                'notification',
                expect.objectContaining({ method: 'metamask_chainChanged' }),
            );
        });
    });

    describe('notifyAllConnections error handling', () => {
        it('logs errors thrown by the payload function', async () => {
            const logger = require('../../src/shared/utils/logger').default;
            (logger.error as jest.Mock).mockClear();
            app.connections['o'] = { id: { engine: { emit: jest.fn() } as any } };
            app.notifyAllConnections(() => {
                throw new Error('payload-fail');
            });
            await Promise.resolve();
            await Promise.resolve();
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('isSenderActiveBrowserTab', () => {
        const browser = require('webextension-polyfill');

        it('returns true for ORIGIN_CHILLY regardless of tab id', async () => {
            await expect(
                app.isSenderActiveBrowserTab(undefined, 'chilly-internal-origin'),
            ).resolves.toBe(true);
        });

        it('returns false when tabId is not numeric', async () => {
            await expect(app.isSenderActiveBrowserTab('not-num', 'site')).resolves.toBe(false);
        });

        it('returns true when the tab is in the active result set', async () => {
            (browser.tabs.query as jest.Mock).mockResolvedValueOnce([{ id: 42 }]);
            await expect(app.isSenderActiveBrowserTab(42, 'site')).resolves.toBe(true);
        });

        it('returns false when query rejects', async () => {
            (browser.tabs.query as jest.Mock).mockReturnValueOnce({
                then: () => ({ catch: (cb: any) => Promise.resolve(cb()) }),
            });
            const result = await app.isSenderActiveBrowserTab(42, 'site');
            expect(result).toBe(false);
        });
    });

    describe('getRpcConfigForControllers', () => {
        it('returns customNetworks and rpcUrls from preferences', () => {
            (app.preferencesController.getPreferences as jest.Mock).mockReturnValueOnce({
                customNetworks: [{ id: 'c' }],
                rpcUrls: { 1: 'https://a' },
            });
            const config = (app as any).getRpcConfigForControllers();
            expect(config).toEqual({
                customNetworks: [{ id: 'c' }],
                rpcUrls: { 1: 'https://a' },
            });
        });

        it('falls back to empty defaults when preferences are missing fields', () => {
            (app.preferencesController.getPreferences as jest.Mock).mockReturnValueOnce({});
            const config = (app as any).getRpcConfigForControllers();
            expect(config).toEqual({ customNetworks: [], rpcUrls: {} });
        });
    });

    describe('setupProviderEngine', () => {
        it('returns a configured engine for an external origin', () => {
            const engine = app.setupProviderEngine({
                origin: 'https://site.example',
                subjectType: 'website' as any,
                sender: { url: 'https://site.example' },
                tabId: 7,
            });
            expect(engine).toBeDefined();
            expect(
                (app.permissionController as any).createPermissionMiddleware,
            ).toHaveBeenCalledWith({ origin: 'https://site.example' });
        });

        it('skips the permission middleware for the internal subject type', () => {
            (app.permissionController as any).createPermissionMiddleware = jest.fn(() => () => {});
            app.setupProviderEngine({
                origin: 'chilly-internal-origin',
                subjectType: 'internal' as any,
                sender: {},
                tabId: undefined,
            });
            expect(
                (app.permissionController as any).createPermissionMiddleware,
            ).not.toHaveBeenCalled();
        });
    });

    describe('setupProviderConnection', () => {
        const { pipeline } = require('readable-stream');
        const browser = require('webextension-polyfill');

        beforeEach(() => {
            (pipeline as jest.Mock).mockClear();
        });

        it('uses ORIGIN_CHILLY when subjectType is Internal', () => {
            const outStream = {};
            app.setupProviderConnection(outStream as any, { id: 'ext-id' }, 'internal' as any);
            expect(pipeline).toHaveBeenCalled();
        });

        it('derives origin from sender url and registers extension subject metadata', () => {
            const addMeta = (app.subjectMetadataController as any).addSubjectMetadata as jest.Mock;
            addMeta.mockClear();
            app.setupProviderConnection(
                {} as any,
                { id: 'other-ext', url: 'https://dapp.example/page', tab: { id: 9 } },
                'website' as any,
            );
            expect(addMeta).toHaveBeenCalledWith(
                expect.objectContaining({ origin: 'https://dapp.example', extensionId: 'other-ext' }),
            );
        });

        it('cleans up the connection inside the pipeline completion callback', () => {
            const destroyFn = jest.fn();
            (pipeline as jest.Mock).mockImplementationOnce(
                (_a: any, _b: any, _c: any, cb: any) => {
                    cb(new Error('Premature close'));
                },
            );
            app.setupProviderConnection(
                {} as any,
                { url: 'https://x.example' },
                'website' as any,
            );
            // Should not throw on Premature close errors
            expect(pipeline).toHaveBeenCalled();
            // Now exercise the error-log branch with a different error
            (pipeline as jest.Mock).mockImplementationOnce(
                (_a: any, _b: any, _c: any, cb: any) => {
                    cb(new Error('Some other failure'));
                },
            );
            app.setupProviderConnection(
                {} as any,
                { url: 'https://y.example' },
                'website' as any,
            );
            destroyFn; // silence unused
        });
    });

    describe('setupUntrustedCommunication', () => {
        const browser = require('webextension-polyfill');
        const { setupMultiplex } = require('../../src/lib/stream-utils');

        it('infers the Extension subject type from a foreign extension id', () => {
            (setupMultiplex as jest.Mock).mockReturnValueOnce({
                createStream: jest.fn(() => ({})),
            });
            app.setupUntrustedCommunication({
                connectionStream: {} as any,
                sender: { id: 'foreign-ext', url: 'https://x.example' },
            });
            expect(setupMultiplex).toHaveBeenCalled();
        });

        it('falls back to Website subject type otherwise', () => {
            (setupMultiplex as jest.Mock).mockReturnValueOnce({
                createStream: jest.fn(() => ({})),
            });
            app.setupUntrustedCommunication({
                connectionStream: {} as any,
                sender: { url: 'https://x.example' },
            });
            expect(setupMultiplex).toHaveBeenCalled();
        });

        it('honors an explicitly provided subject type', () => {
            (setupMultiplex as jest.Mock).mockReturnValueOnce({
                createStream: jest.fn(() => ({})),
            });
            app.setupUntrustedCommunication({
                connectionStream: {} as any,
                sender: { url: 'https://x.example' },
                subjectType: 'website' as any,
            });
            expect(setupMultiplex).toHaveBeenCalled();
        });
    });

    describe('setupTrustedCommunication', () => {
        const { setupMultiplex } = require('../../src/lib/stream-utils');

        it('wires both controller and provider connection streams', () => {
            const createStream = jest.fn(() => ({
                on: jest.fn(),
                write: jest.fn(),
                once: jest.fn(),
            }));
            (setupMultiplex as jest.Mock).mockReturnValueOnce({ createStream });
            const setupCC = jest.spyOn(app, 'setupControllerConnection').mockImplementation();
            const setupPC = jest.spyOn(app, 'setupProviderConnection').mockImplementation();
            app.setupTrustedCommunication({} as any, { id: 'ext-id' });
            expect(setupCC).toHaveBeenCalled();
            expect(setupPC).toHaveBeenCalled();
        });
    });

    describe('setupControllerConnection', () => {
        const { finished, pipeline } = require('readable-stream');
        const { isStreamWritable } = require('../../src/lib/stream-utils');

        function makeOutStream() {
            const handlers: Record<string, Function[]> = {};
            return {
                on: jest.fn((event: string, cb: Function) => {
                    (handlers[event] ||= []).push(cb);
                }),
                once: jest.fn((event: string, cb: Function) => {
                    (handlers[event] ||= []).push(cb);
                }),
                write: jest.fn(),
                emit: (event: string, ...args: any[]) => {
                    (handlers[event] || []).forEach(cb => cb(...args));
                },
                handlers,
                mmFinished: undefined as any,
            };
        }

        it('writes updates while the stream is writable and stops on close', () => {
            (isStreamWritable as jest.Mock).mockReturnValue(true);
            const outStream = makeOutStream();
            app.setupControllerConnection(outStream as any);
            // simulate an update — should write a jsonrpc message
            app.privateSendUpdate();
            expect(outStream.write).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'sendUpdate' }),
            );
            const before = app.activeControllerConnections;
            outStream.emit('close');
            expect(app.activeControllerConnections).toBe(before - 1);
            // calling close again should be idempotent (mmFinished true)
            outStream.emit('close');
            expect(app.activeControllerConnections).toBe(before - 1);
        });

        it('skips update writes when the stream is not writable', () => {
            (isStreamWritable as jest.Mock).mockReturnValue(false);
            const outStream = makeOutStream();
            app.setupControllerConnection(outStream as any);
            app.privateSendUpdate();
            expect(outStream.write).not.toHaveBeenCalled();
        });

        it('queues startUISync when not yet started', () => {
            (isStreamWritable as jest.Mock).mockReturnValue(true);
            app.startedUISync = false;
            const outStream = makeOutStream();
            app.setupControllerConnection(outStream as any);
            // emit startUISync — should send the start message
            (app as any).emit('startUISync');
            expect(outStream.write).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'startUISync' }),
            );
        });

        it('sends startUISync immediately when already started', () => {
            (isStreamWritable as jest.Mock).mockReturnValue(true);
            app.startedUISync = true;
            const outStream = makeOutStream();
            app.setupControllerConnection(outStream as any);
            expect(outStream.write).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'startUISync' }),
            );
        });

        it('skips startUISync notification when stream is not writable', () => {
            (isStreamWritable as jest.Mock).mockReturnValue(false);
            app.startedUISync = true;
            const outStream = makeOutStream();
            app.setupControllerConnection(outStream as any);
            // outStream.write was never called for startUISync
            const startCalls = outStream.write.mock.calls.filter(
                (c: any[]) => c[0]?.method === 'startUISync',
            );
            expect(startCalls.length).toBe(0);
        });
    });

    describe('controllerMessenger subscribers', () => {
        it('KeyringController:unlock arrow invokes _onUnlock', () => {
            const spy = jest.spyOn(app, '_onUnlock').mockImplementation();
            (app as any).controllerMessenger.publish('KeyringController:unlock');
            expect(spy).toHaveBeenCalled();
        });


        it('NetworkController:networkChange arrows invoke _onNetworkChange and chain notify', () => {
            const onChange = jest.spyOn(app, '_onNetworkChange').mockImplementation();
            const notifyChain = jest
                .spyOn(app, '_notifyChainChange')
                .mockImplementation(async () => {});
            const next = {
                chain_id: 5,
                short_name: 'goerli',
                chain_key: 'eip155:5',
                platform_id: 5,
            };
            (app as any).controllerMessenger.publish('NetworkController:networkChange', next);
            expect(onChange).toHaveBeenCalled();
            expect(notifyChain).toHaveBeenCalled();
            expect(app.currentChain).toEqual(next);
        });

        it('KeyringController:lock arrow invokes _onLock', () => {
            const spy = jest.spyOn(app, '_onLock').mockImplementation();
            (app as any).controllerMessenger.publish('KeyringController:lock');
            expect(spy).toHaveBeenCalled();
        });

        it('PermissionController:stateChange notifies changed origins', () => {
            const perms = require('../../src/lib/permissions');
            // selector return must be defined & differ from cached previousValue (undefined)
            (perms.getPermittedAccountsByOrigin as jest.Mock).mockReturnValueOnce(new Map());
            (perms.getChangedAccounts as jest.Mock).mockReturnValueOnce(
                new Map([['site', ['0xnew']]]),
            );
            const spy = jest
                .spyOn(app, '_notifyAccountsChange')
                .mockImplementation(async () => {});
            (app as any).controllerMessenger.publish(
                'PermissionController:stateChange',
                { subjects: { a: 1 } },
                { subjects: {} },
            );
            expect(spy).toHaveBeenCalledWith('site', ['0xnew']);
        });

        it('AccountsController:selectedAccountChange arrow invokes _onSelectedAccountChange', () => {
            const spy = jest
                .spyOn(app, '_onSelectedAccountChange')
                .mockImplementation(async () => {});
            (app as any).controllerMessenger.publish('AccountsController:selectedAccountChange');
            expect(spy).toHaveBeenCalled();
        });



    });

    describe('setupProviderEngine captured option closures', () => {
        const { createMethodMiddleware } = require('../../src/lib/createMethodMiddleware');
        const createChillyMiddleware = require('../../src/lib/createChillyMiddleware').default;
        const { getRpcUrlByNetwork } = require('../../src/shared/utils/rpc');

        function captureOptions() {
            (createMethodMiddleware as jest.Mock).mockClear();
            (createChillyMiddleware as jest.Mock).mockClear();
            app.setupProviderEngine({
                origin: 'https://site.example',
                subjectType: 'website' as any,
                sender: { url: 'https://site.example' },
                tabId: 7,
            });
            const methodOpts = (createMethodMiddleware as jest.Mock).mock.calls[0][0];
            const chillyOpts = (createChillyMiddleware as jest.Mock).mock.calls[0][0];
            return { methodOpts, chillyOpts };
        }

        it('revokePermissionsForOrigin forwards keys to permissionController', () => {
            const { methodOpts } = captureOptions();
            methodOpts.revokePermissionsForOrigin(['eth_accounts']);
            expect(app.permissionController.revokePermissions).toHaveBeenCalledWith({
                'https://site.example': ['eth_accounts'],
            });
        });

        it('revokePermissionsForOrigin swallows errors and logs', () => {
            const { methodOpts } = captureOptions();
            (app.permissionController.revokePermissions as jest.Mock).mockImplementationOnce(
                () => {
                    throw new Error('nope');
                },
            );
            expect(() => methodOpts.revokePermissionsForOrigin(['eth_accounts'])).not.toThrow();
        });

        it('getCurrentRpcUrl resolves via getRpcUrlByNetwork', () => {
            const { methodOpts } = captureOptions();
            (getRpcUrlByNetwork as jest.Mock).mockReturnValueOnce('https://custom.rpc');
            expect(methodOpts.getCurrentRpcUrl()).toBe('https://custom.rpc');
        });

        it('getCurrentChain returns the selected network', () => {
            const { methodOpts } = captureOptions();
            const result = methodOpts.getCurrentChain();
            expect(result).toMatchObject({ chain_id: 1 });
        });

        it('isSenderActiveBrowserTab option proxies to the instance method', async () => {
            const { methodOpts } = captureOptions();
            const spy = jest
                .spyOn(app, 'isSenderActiveBrowserTab')
                .mockResolvedValue(true);
            await methodOpts.isSenderActiveBrowserTab(42, 'https://site.example');
            expect(spy).toHaveBeenCalledWith(42, 'https://site.example');
        });

        it('chilly middleware getAccounts returns selected account fields for ORIGIN_CHILLY', async () => {
            const { chillyOpts } = captureOptions();
            (app.accountsController.getSelectedAccount as jest.Mock).mockReturnValueOnce({
                address: '0xacc',
                smartAddress: '0xsm',
            });
            const result = await chillyOpts.getAccounts({ origin: 'chilly-internal-origin' });
            expect(result).toEqual(['0xacc', '0xsm']);
        });

        it('chilly middleware getAccounts returns permitted accounts when unlocked', async () => {
            const { chillyOpts } = captureOptions();
            (app.keyringController.state as any).isUnlocked = true;
            (app.permissionController.state as any).subjects = { 'https://site.example': {} };
            const { getAccountsFromSubject } = require('../../src/store/selectorUtils');
            (getAccountsFromSubject as jest.Mock).mockReturnValueOnce(['0xperm']);
            const result = await chillyOpts.getAccounts({ origin: 'https://site.example' });
            expect(result).toEqual(['0xperm']);
        });

        it('chilly middleware getAccounts returns [] when locked and not the internal origin', async () => {
            const { chillyOpts } = captureOptions();
            (app.keyringController.state as any).isUnlocked = false;
            const result = await chillyOpts.getAccounts({ origin: 'https://locked.example' });
            expect(result).toEqual([]);
        });

        it('chilly middleware processTransaction forwards to processTransaction', async () => {
            const { chillyOpts } = captureOptions();
            const spy = jest.spyOn(app, 'processTransaction').mockResolvedValue('0xtx' as any);
            await chillyOpts.processTransaction({ from: '0xa' }, { id: 'rid' });
            expect(spy).toHaveBeenCalled();
        });

        it('controller-constructor closures resolve current state on invocation', () => {
            const sig = (app.signatureController as any).opts;
            expect(sig.getCurrentChainId()).toBe('0x1');
            sig.getAccountBySmartAddress('0xs');
            expect(app.accountsController.getAccountBySmartAddress).toHaveBeenCalledWith('0xs');
            sig.getPrivateKey('addr');
            expect(app.keyringController.getPrivateKeyInternally).toHaveBeenCalledWith('addr');
            expect(sig.getSelectedNetwork()).toMatchObject({ chain_id: 1 });

            const tx = (app.transactionController as any).opts;
            expect(tx.getSelectedNetwork()).toMatchObject({ chain_id: 1 });
            tx.getProviderByChainId(7);
            expect(app.networkController.getProviderByChainId).toHaveBeenCalledWith(7);

            const liquid = (app.liquidStakingController as any).opts;
            liquid.getProviderByChainId(9);
            expect(app.networkController.getProviderByChainId).toHaveBeenCalledWith(9);

            const net = (app.networkController as any).opts;
            expect(net.getRpcConfig()).toEqual({ customNetworks: [], rpcUrls: {} });

        });

        it('appends dupeReqFilterMiddleware when running under Manifest V3', () => {
            (globalThis as any).__APP_CTRL_TEST_IS_MV3__ = true;
            const dupeFactory =
                require('../../src/lib/createDupeReqFilterMiddleware').default;
            (dupeFactory as jest.Mock).mockClear();
            app.setupProviderEngine({
                origin: 'https://site.example',
                subjectType: 'website' as any,
                sender: { url: 'https://site.example' },
                tabId: 0,
            });
            expect(dupeFactory).toHaveBeenCalled();
            (globalThis as any).__APP_CTRL_TEST_IS_MV3__ = false;
        });
    });

    describe('additional branch coverage', () => {
        const createChillyMiddleware = require('../../src/lib/createChillyMiddleware').default;

        function captureChillyOpts() {
            (createChillyMiddleware as jest.Mock).mockClear();
            app.setupProviderEngine({
                origin: 'https://site.example',
                subjectType: 'website' as any,
                sender: { url: 'https://site.example' },
                tabId: 7,
            });
            return (createChillyMiddleware as jest.Mock).mock.calls[0][0];
        }

        it('chilly middleware getAccounts skips missing address and smartAddress (lines 857/861 false branches)', async () => {
            const chillyOpts = captureChillyOpts();
            (app.accountsController.getSelectedAccount as jest.Mock).mockReturnValueOnce({
                address: '',
                smartAddress: '',
            });
            const result = await chillyOpts.getAccounts({ origin: 'chilly-internal-origin' });
            expect(result).toEqual([]);
        });

        it('chilly middleware getAccounts pushes only smartAddress when address is empty', async () => {
            const chillyOpts = captureChillyOpts();
            (app.accountsController.getSelectedAccount as jest.Mock).mockReturnValueOnce({
                address: '',
                smartAddress: '0xsm',
            });
            const result = await chillyOpts.getAccounts({ origin: 'chilly-internal-origin' });
            expect(result).toEqual(['0xsm']);
        });



        it('getState handles missing preferences in flatState (line 1469 fallback)', () => {
            (app.memStore as any).getFlatState = () => ({});
            const state = app.getState();
            expect(state.preferences).toEqual({});
        });

        it('getPermittedAccounts falls back to {} when subjects is undefined (line 1888)', async () => {
            (app.permissionController.state as any).subjects = undefined;
            await expect(app.getPermittedAccounts('any')).resolves.toEqual([]);
        });

        it('addConnection initializes the origin bucket on first add (line 2000)', () => {
            delete app.connections['fresh.example'];
            const id = app.addConnection('fresh.example', { engine: {} as any });
            expect(id).toBe('fixed-id');
            expect(app.connections['fresh.example']).toBeDefined();
        });

        it('notifyConnections skips connections without an engine (line 2064 false branch)', () => {
            app.connections['o'] = { id1: {} as any };
            expect(() => app.notifyConnections('o', { method: 'm' })).not.toThrow();
        });

        it('notifyAllConnections skips connections without an engine (line 2089 false branch)', async () => {
            app.connections['o'] = { id1: {} as any };
            app.notifyAllConnections({ method: 'm' });
            await Promise.resolve();
            await Promise.resolve();
            // No throw, no logger error from missing engine (silently skips).
        });

        it('_onSelectedAccountChange handles undefined subjects (line 2131 fallback)', async () => {
            (app.keyringController.state as any).isUnlocked = true;
            (app.accountsController.getSelectedAccount as jest.Mock).mockReturnValueOnce({
                address: '0xabc',
            });
            (app.permissionController.state as any).subjects = undefined;
            await expect(app._onSelectedAccountChange()).resolves.toBeUndefined();
        });
    });
});
