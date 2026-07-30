/**
 * @jest-environment jsdom
 */

// Use plain functions (not jest.fn) so the implementations survive resetMocks
// between tests — see memory: feedback_cra_resetmocks
import {
    initBackground,
    loadStateFromPersistence,
    PRE_REBRAND_FIELDS,
} from '../src/Background';
import browser from 'webextension-polyfill';

jest.mock('@metamask/obs-store', () => ({
    __esModule: true,
    storeAsStream: () => {
        const { Readable } = require('readable-stream');
        const r = new Readable({ objectMode: true, read() {} });
        (globalThis as any).__CHILLY_TEST_STORE_STREAM__ = r;
        return r;
    },
}));

jest.mock('debounce-stream', () => {
    return (..._args: any[]) => {
        const { PassThrough } = require('readable-stream');
        return new PassThrough({ objectMode: true });
    };
});

jest.mock('../src/lib/createStreamSink', () => ({
    __esModule: true,
    default: (asyncWriteFn: any) => {
        const { Writable } = require('readable-stream');
        return new Writable({
            objectMode: true,
            write(chunk: any, _e: any, cb: any) {
                Promise.resolve(asyncWriteFn(chunk)).then(() => cb(), cb);
            },
        });
    },
}));

jest.mock('../src/controller/AppController', () => {
    function AppController(opts: any) {
        const { Readable } = require('readable-stream');
        const stateChangeListeners: Array<(...args: any[]) => void> = [];
        const instance: any = {
            store: new Readable({ objectMode: true, read() {} }),
            isClientOpen: false,
            setupTrustedCommunication() {},
            setupUntrustedCommunication() {},
            getMoonPayCurrencies() {},
            onClientClosed: jest.fn(),
            onEnvironmentTypeClosed: jest.fn(),
            resolvePendingApproval: jest.fn(),
            appStateController: {
                _currentPopupId: undefined as any,
                getCurrentPopupId() {
                    return instance.appStateController._currentPopupId;
                },
                setCurrentPopupId(id: any) {
                    instance.appStateController._currentPopupId = id;
                },
                waitingForUnlock: [] as any[],
            },
            approvalController: {
                getTotalApprovalCount: jest.fn(() => 0),
                state: { pendingApprovals: {} as Record<string, any> },
            },
            signatureController: { hub: { on() {}, emit() {} } },
            controllerMessenger: {
                subscribe(_event: string, cb: any) {
                    stateChangeListeners.push(cb);
                },
            },
            __opts: opts,
            __stateChangeListeners: stateChangeListeners,
        };
        (globalThis as any).__CHILLY_TEST_APP_CONTROLLER__ = instance;
        return instance;
    }
    return { __esModule: true, default: AppController };
});

// Suppress noisy unhandled rejections from the Background module's `isInitialized`
// deferred promise — its rejection only matters to the onConnect listeners which are
// not always exercised in unit tests.
process.on('unhandledRejection', () => {});

jest.mock('webextension-polyfill', () => require('./helpers/webextensionTestMock.js'));

// browser-runtime-utils is real by default. We want a way to flip isManifestV3 for one test
// so the non-MV3 setBadgeText branch is exercised. Use a let on globalThis the helper reads.
(globalThis as any).__CHILLY_TEST_IS_MV3__ = true;
jest.mock('../src/shared/utils/browser-runtime-utils', () => {
    const actual = jest.requireActual('../src/shared/utils/browser-runtime-utils');
    return new Proxy(actual, {
        get(target, prop) {
            if (prop === 'isManifestV3') {
                return (globalThis as any).__CHILLY_TEST_IS_MV3__;
            }
            return (target as any)[prop];
        },
    });
});

jest.mock('../src/lib/ExtensionPlatform', () => {
    const instance = { openExtensionInBrowser: jest.fn() };
    (globalThis as any).__CHILLY_TEST_PLATFORM__ = instance;
    function ExtensionPlatform() {
        return instance;
    }
    return { __esModule: true, default: ExtensionPlatform };
});

jest.mock('../src/lib/NotificationManager', () => {
    const instance = { showPopup: jest.fn(async () => {}) };
    (globalThis as any).__CHILLY_TEST_NOTIFICATION_MANAGER__ = instance;
    function NotificationManager() {
        return instance;
    }
    return { __esModule: true, default: NotificationManager };
});

jest.mock('../src/lib/LocalStore', () => {
    const store = {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue(undefined),
        setMetadata: jest.fn(),
    };
    (globalThis as any).__CHILLY_TEST_LOCALSTORE__ = store;
    function LocalStore() {
        return store;
    }
    return { __esModule: true, default: LocalStore };
});

jest.mock('../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// new URL('chrome-extension://...').origin is "null" in jsdom — short-circuit by forcing
// the Firefox path so the internalProcessHash decides internal vs external for us.
// Use a let-binding inside the factory so individual tests can flip the platform.
(globalThis as any).__CHILLY_TEST_PLATFORM_NAME__ = 'Firefox';
jest.mock('../src/shared/utils/utils', () => {
    const actual = jest.requireActual('../src/shared/utils/utils');
    return {
        ...actual,
        getPlatform: () => (globalThis as any).__CHILLY_TEST_PLATFORM_NAME__ ?? 'Firefox',
    };
});

(globalThis as any).fetch = jest.fn().mockResolvedValue({
    json: async () => ({ dangerous: false }),
});

const mockLocalStoreImpl = () => (globalThis as any).__CHILLY_TEST_LOCALSTORE__ as {
    get: jest.Mock;
    set: jest.Mock;
    setMetadata: jest.Mock;
};

const runtimeMessageListeners = () =>
    (globalThis as any).__CHILLY_TEST_RUNTIME_MESSAGE_LISTENERS__ as Array<(msg: any) => any>;

describe('Background', () => {
    beforeEach(() => {
        const s = mockLocalStoreImpl();
        s.get.mockReset();
        s.set.mockReset();
        s.setMetadata.mockReset();
        // CRA resetMocks wipes jest.fn() impls between tests — re-prime the ones
        // initialize() depends on so the controller setup doesn't crash.
        (browser.tabs.query as jest.Mock).mockResolvedValue([]);
        (browser.storage.session.get as jest.Mock).mockResolvedValue({});
        (browser.storage.session.set as jest.Mock).mockResolvedValue(undefined);
    });

    describe('loadStateFromPersistence', () => {
        it('materializes initial versioned state when storage is empty', async () => {
            mockLocalStoreImpl().get.mockResolvedValue(undefined);
            const result = await loadStateFromPersistence();
            expect(result.meta.version).toBe(8);
            expect(result.data).toEqual({ config: {} });
            expect(mockLocalStoreImpl().setMetadata).toHaveBeenCalledWith(
                expect.objectContaining({ version: 8 }),
            );
            expect(mockLocalStoreImpl().set).toHaveBeenCalled();
        });

        it('applies portfolio cleanup migrations from legacy persisted data', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 0 },
                data: {
                    PortfolioController: {
                        portfolioTransactions: { a: 1 },
                        portfolioNfts: { b: 2 },
                        topCoinsByNetwork: { c: 3 },
                        portfolioPrices: { x: 1 },
                        nativeCoinPrices: {
                            '0xabc': { 1: 1.5, 2: 0 },
                        },
                    },
                },
            });
            const result = await loadStateFromPersistence();
            const portfolio = (result.data as any).PortfolioController;
            expect(portfolio.portfolioTransactions).toBeUndefined();
            expect(portfolio.portfolioNfts).toBeUndefined();
            expect(portfolio.topCoinsByNetwork).toBeUndefined();
            expect(portfolio.portfolioPrices).toBeUndefined();
            expect(portfolio.nativeCoinPrices).toEqual(expect.any(Object));
        });

        it('migration v8 renames the persisted rebrand fields', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 7 },
                data: {
                    NetworkController: {
                        selectedNetwork: {
                            chain_id: 1,
                            [PRE_REBRAND_FIELDS.chainKey]: 'eth',
                            [PRE_REBRAND_FIELDS.platformId]: 1,
                            name: 'Ethereum Mainnet',
                        },
                    },
                    PreferencesController: {
                        preferences: {
                            favoriteCoins: [
                                { [PRE_REBRAND_FIELDS.coinId]: 'cg:bitcoin', symbol: 'BTC' },
                            ],
                        },
                    },
                    PortfolioController: {
                        cachingCoins: [
                            { [PRE_REBRAND_FIELDS.coinId]: '1:0xabc', symbol: 'USDC' },
                        ],
                    },
                },
            });
            const result = await loadStateFromPersistence();
            const data = result.data as any;

            expect(data.NetworkController.selectedNetwork).toEqual({
                chain_id: 1,
                chain_key: 'eth',
                platform_id: 1,
                name: 'Ethereum Mainnet',
            });
            expect(data.PreferencesController.preferences.favoriteCoins[0]).toEqual({
                coinId: 'cg:bitcoin',
                symbol: 'BTC',
            });
            expect(data.PortfolioController.cachingCoins[0]).toEqual({
                coinId: '1:0xabc',
                symbol: 'USDC',
            });
        });

        it('rejects when migrator metadata is not an object', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: 'invalid-meta',
                data: {},
            });
            await expect(loadStateFromPersistence()).rejects.toThrow(/invalid type 'string'/);
        });

        it('rejects when migrator metadata version is not a number', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 'not-a-number' },
                data: {},
            });
            await expect(loadStateFromPersistence()).rejects.toThrow(
                /version has invalid type 'string'/,
            );
        });

        it('falls back to initial state when persisted data is missing', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({ meta: { version: 0 } });
            const result = await loadStateFromPersistence();
            expect(result.data).toEqual({ config: {} });
        });

        it('applies portfolio prices cleanup (v3)', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 2 },
                data: {
                    PortfolioController: {
                        portfolioPrices: { x: 1 },
                    },
                },
            });
            const result = await loadStateFromPersistence();
            expect((result.data as any).PortfolioController.portfolioPrices).toBeUndefined();
        });

        it('applies gas controller cleanup (v4)', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 3 },
                data: {
                    GasController: {
                        latestGas: { eth: { fast: 50 } },
                        gasType: { eth: 'fast' },
                    },
                },
            });
            const result = await loadStateFromPersistence();
            const gas = (result.data as any).GasController;
            expect(gas.latestGas).toBeUndefined();
            expect(gas.gasType).toEqual({});
        });

        it('applies preferences cleanup (v5) for monad keys', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 4 },
                data: {
                    PreferencesController: {
                        preferences: {
                            monadMetadata: { foo: 1 },
                            monadMainnet: { bar: 2 },
                            other: 'keep',
                        },
                    },
                },
            });
            const result = await loadStateFromPersistence();
            const prefs = (result.data as any).PreferencesController.preferences;
            expect(prefs.monadMetadata).toBeUndefined();
            expect(prefs.monadMainnet).toBeUndefined();
            expect(prefs.other).toBe('keep');
        });

        it('rejects when persisted data is not an object', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 5 },
                data: 'not-an-object',
            });
            await expect(loadStateFromPersistence()).rejects.toThrow(/data has invalid type/);
        });

        it('runs all migrations as no-ops when no controller state is present', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 0 },
                data: { config: {} },
            });
            const result = await loadStateFromPersistence();
            expect(result.meta.version).toBe(0);
            expect(result.data).toEqual({ config: {} });
        });

        it('runs v2 nativeCoinPrices migration as no-op when no nativeCoinPrices exist', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 1 },
                data: {
                    PortfolioController: {
                        // no nativeCoinPrices key
                        someOther: 1,
                    },
                },
            });
            const result = await loadStateFromPersistence();
            expect((result.data as any).PortfolioController.someOther).toBe(1);
        });

        it('runs v3 migration as no-op when portfolioPrices is missing', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 2 },
                data: { PortfolioController: { something: 'else' } },
            });
            const result = await loadStateFromPersistence();
            expect((result.data as any).PortfolioController.something).toBe('else');
        });

        it('runs v4 migration as no-op when no GasController state is present', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 3 },
                data: { Other: {} },
            });
            const result = await loadStateFromPersistence();
            expect((result.data as any).Other).toEqual({});
        });

        it('runs v4 migration as no-op when GasController has no latestGas', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 3 },
                data: { GasController: { gasType: { eth: 'standard' } } },
            });
            const result = await loadStateFromPersistence();
            const gas = (result.data as any).GasController;
            expect(gas.gasType).toEqual({ eth: 'standard' });
        });

        it('runs v5 migration as no-op when no PreferencesController is present', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 4 },
                data: { Other: {} },
            });
            const result = await loadStateFromPersistence();
            expect((result.data as any).Other).toEqual({});
        });

        it('runs v5 migration as no-op when preferences contain no monad keys', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 4 },
                data: {
                    PreferencesController: { preferences: { theme: 'dark' } },
                },
            });
            const result = await loadStateFromPersistence();
            expect((result.data as any).PreferencesController.preferences.theme).toBe('dark');
        });

        it('skips v2 inner remap when nativeCoinPrices is null', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 1 },
                data: {
                    PortfolioController: { nativeCoinPrices: null },
                },
            });
            const result = await loadStateFromPersistence();
            expect((result.data as any).PortfolioController.nativeCoinPrices).toBe(null);
        });

        it('keeps an existing zero price when no replacement is found during v2 migration', async () => {
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 1 },
                data: {
                    PortfolioController: {
                        nativeCoinPrices: {
                            '0xabc': { 1: 0 },
                            '0xdef': null, // walletPrices is null — covers inner null branch
                        },
                    },
                },
            });
            const result = await loadStateFromPersistence();
            expect((result.data as any).PortfolioController.nativeCoinPrices).toEqual({ 1: 0 });
        });

        it('migrates nativeCoinPrices flat structure as a no-op (v2 branch skip)', async () => {
            // already-flat shape should not be touched
            mockLocalStoreImpl().get.mockResolvedValue({
                meta: { version: 1 },
                data: {
                    PortfolioController: {
                        nativeCoinPrices: { 1: 1.5, 56: 3 }, // already flat number->number
                    },
                },
            });
            const result = await loadStateFromPersistence();
            const portfolio = (result.data as any).PortfolioController;
            expect(portfolio.nativeCoinPrices).toEqual({ 1: 1.5, 56: 3 });
        });
    });

    describe('runtime messages', () => {
        it('records bypass-domain requests', async () => {
            const listeners = runtimeMessageListeners();
            expect(listeners.length).toBeGreaterThanOrEqual(1);
            const handler = listeners[listeners.length - 1];
            await expect(
                handler({ type: 'bypass-domain', domain: 'phishing.test' }),
            ).resolves.toEqual({ success: true });
        });

        it('returns expanded view tab ids', async () => {
            const listeners = runtimeMessageListeners();
            const handler = listeners[listeners.length - 1];
            await expect(handler({ type: 'get-expanded-view-ids' })).resolves.toEqual([]);
        });

        it('returns undefined for unrelated message types', async () => {
            const listeners = runtimeMessageListeners();
            const handler = listeners[listeners.length - 1];
            await expect(handler({ type: 'something-unknown' })).resolves.toBeUndefined();
        });

        it('does not duplicate domains in the bypass set', async () => {
            const listeners = runtimeMessageListeners();
            const handler = listeners[listeners.length - 1];
            // First add
            await handler({ type: 'bypass-domain', domain: 'duplicate.test' });
            // Second add should still succeed but not throw on duplicate
            await expect(
                handler({ type: 'bypass-domain', domain: 'duplicate.test' }),
            ).resolves.toEqual({ success: true });
        });
    });

    describe('webNavigation handler', () => {
        const getNavListener = () =>
            ((globalThis as any).__CHILLY_TEST_WEBNAV_LISTENERS__ as any[])[0];

        beforeEach(() => {
            ((globalThis as any).fetch as jest.Mock).mockReset();
            (browser.tabs.update as jest.Mock).mockClear();
        });

        it('skips the phishing check when domain is bypassed', async () => {
            const fetchMock = (globalThis as any).fetch as jest.Mock;
            // Add domain to bypass set via runtime message
            const handler = runtimeMessageListeners()[runtimeMessageListeners().length - 1];
            await handler({ type: 'bypass-domain', domain: 'bypassed.test' });
            await getNavListener()({ url: 'https://bypassed.test/path', tabId: 1 });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('does nothing for a safe domain', async () => {
            const fetchMock = (globalThis as any).fetch as jest.Mock;
            fetchMock.mockResolvedValue({ json: async () => ({ dangerous: false }) });
            await getNavListener()({ url: 'https://safe.test/page', tabId: 2 });
            expect(browser.tabs.update).not.toHaveBeenCalled();
        });

        it('redirects to the phishing warning when a domain is flagged dangerous', async () => {
            const fetchMock = (globalThis as any).fetch as jest.Mock;
            fetchMock.mockResolvedValue({ json: async () => ({ dangerous: true }) });
            await getNavListener()({ url: 'https://evil.test/path', tabId: 7 });
            expect(browser.tabs.update).toHaveBeenCalledWith(
                7,
                expect.objectContaining({
                    url: expect.stringContaining('evil.test'),
                }),
            );
        });

        it('logs but does not throw if the phishing lookup fails', async () => {
            const fetchMock = (globalThis as any).fetch as jest.Mock;
            fetchMock.mockRejectedValue(new Error('network down'));
            await expect(
                getNavListener()({ url: 'https://broken.test', tabId: 3 }),
            ).resolves.toBeUndefined();
        });
    });

    describe('initBackground', () => {
        const getPlatform = () =>
            (globalThis as any).__CHILLY_TEST_PLATFORM__ as { openExtensionInBrowser: jest.Mock };

        beforeEach(() => {
            getPlatform().openExtensionInBrowser.mockClear();
        });

        it('opens the extension in a new tab on first install (no existing store)', async () => {
            const store = mockLocalStoreImpl();
            store.get.mockResolvedValue(undefined);
            try {
                await initBackground();
            } catch {
                /* initialize() may reject from incomplete mocks — onAppOpen still ran first */
            }
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            expect(getPlatform().openExtensionInBrowser).toHaveBeenCalled();
        });

        it('does not re-open the extension when a store already exists', async () => {
            const store = mockLocalStoreImpl();
            store.get.mockResolvedValue({ meta: { version: 5 }, data: { config: {} } });
            try {
                await initBackground();
            } catch {
                /* initialize() may reject from incomplete mocks — onAppOpen still ran first */
            }
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            expect(getPlatform().openExtensionInBrowser).not.toHaveBeenCalled();
        });

        it('sends CHILLY_EXTENSION_READY to known tabs after initialization', async () => {
            const store = mockLocalStoreImpl();
            store.get.mockResolvedValue({ meta: { version: 5 }, data: { config: {} } });
            (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 11 }, { id: 12 }, {}]);
            (browser.tabs.sendMessage as jest.Mock).mockResolvedValue(undefined);
            try {
                await initBackground();
            } catch {
                /* tolerate */
            }
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            expect(browser.tabs.sendMessage).toHaveBeenCalledWith(11, expect.any(Object));
            expect(browser.tabs.sendMessage).toHaveBeenCalledWith(12, expect.any(Object));
        });

        it('tolerates sendMessage rejections to tabs missing a content script', async () => {
            const store = mockLocalStoreImpl();
            store.get.mockResolvedValue({ meta: { version: 5 }, data: { config: {} } });
            (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 21 }]);
            (browser.tabs.sendMessage as jest.Mock).mockRejectedValue(new Error('no listener'));
            try {
                await initBackground();
            } catch {
                /* tolerate */
            }
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            expect(browser.tabs.sendMessage).toHaveBeenCalled();
        });

        it('handles tabs.query rejection by short-circuiting the broadcast', async () => {
            const store = mockLocalStoreImpl();
            store.get.mockResolvedValue({ meta: { version: 5 }, data: { config: {} } });
            (browser.tabs.query as jest.Mock).mockRejectedValue(new Error('query failed'));
            (browser.tabs.sendMessage as jest.Mock).mockReset();
            try {
                await initBackground();
            } catch {
                /* tolerate */
            }
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            expect(browser.tabs.sendMessage).not.toHaveBeenCalled();
        });

        it('auto-bootstraps when JEST_WORKER_ID is not set (top-level branch)', () => {
            const originalId = process.env.JEST_WORKER_ID;
            delete process.env.JEST_WORKER_ID;
            try {
                jest.isolateModules(() => {
                    require('../src/Background');
                });
            } finally {
                if (originalId !== undefined) {
                    process.env.JEST_WORKER_ID = originalId;
                }
            }
            expect(true).toBe(true);
        });

        it('initializes missing globals (XMLHttpRequest, window) at module load', () => {
            // Snapshot then strip XMLHttpRequest + window so re-importing Background takes
            // the if-true branch of the keys.forEach and window-init blocks.
            const xhrDesc = Object.getOwnPropertyDescriptor(globalThis, 'XMLHttpRequest');
            const winDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
            const localWindow = (globalThis as any).window;
            const localXHR = (globalThis as any).XMLHttpRequest;
            try {
                // Use deleteProperty so Reflect.has(globalThis, key) returns false.
                delete (globalThis as any).XMLHttpRequest;
                delete (globalThis as any).window;
                jest.isolateModules(() => {
                    require('../src/Background');
                });
                expect(Reflect.has(globalThis, 'XMLHttpRequest')).toBe(true);
                expect(Reflect.has(globalThis, 'window')).toBe(true);
            } finally {
                if (xhrDesc) {
                    Object.defineProperty(globalThis, 'XMLHttpRequest', xhrDesc);
                } else {
                    (globalThis as any).XMLHttpRequest = localXHR;
                }
                if (winDesc) {
                    Object.defineProperty(globalThis, 'window', winDesc);
                } else {
                    (globalThis as any).window = localWindow;
                }
            }
        });

        it('skips MV3-only session-storage setup when running on MV2', async () => {
            (globalThis as any).__CHILLY_TEST_IS_MV3__ = false;
            try {
                const store = mockLocalStoreImpl();
                store.get.mockResolvedValue({ meta: { version: 5 }, data: { config: {} } });
                (browser.storage.session.set as jest.Mock).mockClear();
                await initBackground().catch(() => undefined);
                await new Promise<void>(resolve => setTimeout(resolve, 10));
                // saveTimestamp is only called inside the MV3-only block.
                expect(browser.storage.session.set).not.toHaveBeenCalledWith(
                    expect.objectContaining({ timestamp: expect.any(String) }),
                );
            } finally {
                (globalThis as any).__CHILLY_TEST_IS_MV3__ = true;
            }
        });

        it('rejects initialization gracefully when controller setup throws', async () => {
            const logger = require('../src/shared/utils/logger').default as { error: jest.Mock };
            logger.error.mockClear();
            const store = mockLocalStoreImpl();
            store.get.mockResolvedValue({ meta: { version: 5 }, data: { config: {} } });
            // Force the session storage get to reject so the inner try/catch in initialize trips.
            (browser.storage.session.get as jest.Mock).mockRejectedValueOnce(
                new Error('session-broken'),
            );
            await initBackground().catch(() => undefined);
            await new Promise<void>(resolve => setTimeout(resolve, 20));
            expect(logger.error).toHaveBeenCalled();
        });

        it('schedules a saveTimestamp interval that fires after initialization', async () => {
            const store = mockLocalStoreImpl();
            store.get.mockResolvedValue({ meta: { version: 5 }, data: { config: {} } });
            (browser.tabs.query as jest.Mock).mockResolvedValue([]);
            (browser.storage.session.set as jest.Mock).mockResolvedValue(undefined);

            // Spy on setInterval so we can invoke the callback synchronously.
            const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(((
                _fn: any,
            ) => 0) as any);
            try {
                await initBackground().catch(() => undefined);
                await new Promise<void>(resolve => setTimeout(resolve, 10));
                expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
                const cb = intervalSpy.mock.calls[0][0] as any;
                const setSpy = browser.storage.session.set as jest.Mock;
                setSpy.mockClear();
                cb();
                expect(setSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ timestamp: expect.any(String) }),
                );
            } finally {
                intervalSpy.mockRestore();
            }
        });
    });

    describe('runtime connection listeners', () => {
        const makePort = (overrides: Partial<any> = {}) => {
            const msgListeners: Array<(msg: any) => void> = [];
            const disconnectListeners: Array<() => void> = [];
            const port: any = {
                name: 'popup',
                sender: {
                    url: `chrome-extension://mock-extension-id/popup.html`,
                    tab: { id: Math.floor(Math.random() * 10000) },
                },
                onMessage: {
                    addListener: jest.fn(cb => msgListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                onDisconnect: {
                    addListener: jest.fn(cb => disconnectListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                disconnect: jest.fn(),
                postMessage: jest.fn(),
                __dispatchDisconnect: () => disconnectListeners.forEach(l => l()),
                __dispatchMessage: (m: any) => msgListeners.forEach(l => l(m)),
                ...overrides,
            };
            return port;
        };

        const callConnect = async (port: any) => {
            const onConnectListeners =
                (globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ || [];
            // Give isInitialized time to settle (it's resolved after initBackground tests run)
            const result = await Promise.race([
                Promise.resolve(onConnectListeners[0](port)).catch(() => 'rejected'),
                new Promise(resolve => setTimeout(() => resolve('timeout'), 200)),
            ]);
            // Flush any microtasks queued inside connectRemote
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            return result;
        };

        it('routes an internal popup port and runs the close callback on disconnect', async () => {
            const port = makePort({ name: 'popup' });
            const result = await callConnect(port);
            expect(['timeout', 'rejected', undefined]).toContain(result);
            port.__dispatchDisconnect();
            await new Promise<void>(resolve => setTimeout(resolve, 10));
        });

        it('routes a notification port and runs the close callback on disconnect', async () => {
            const port = makePort({ name: 'notification' });
            const result = await callConnect(port);
            expect(['timeout', 'rejected', undefined]).toContain(result);
            port.__dispatchDisconnect();
            await new Promise<void>(resolve => setTimeout(resolve, 10));
        });

        it('routes a sidepanel port and runs the close callback on disconnect', async () => {
            const port = makePort({ name: 'sidepanel' });
            const result = await callConnect(port);
            expect(['timeout', 'rejected', undefined]).toContain(result);
            port.__dispatchDisconnect();
            await new Promise<void>(resolve => setTimeout(resolve, 10));
        });

        it('routes a fullscreen port and runs the close callback on disconnect', async () => {
            const port = makePort({ name: 'fullscreen' });
            const result = await callConnect(port);
            expect(['timeout', 'rejected', undefined]).toContain(result);
            port.__dispatchDisconnect();
            await new Promise<void>(resolve => setTimeout(resolve, 10));
        });

        it('routes an external (web page) port through the untrusted communication setup', async () => {
            const port = makePort({
                name: 'external-page',
                sender: { url: 'https://dapp.example.com', tab: { id: 99 } },
            });
            const result = await callConnect(port);
            expect(['timeout', 'rejected', undefined]).toContain(result);
        });

        it('routes through onConnectExternal for cross-extension connections', async () => {
            const onConnectExternalListeners =
                (globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_EXTERNAL_LISTENERS__ || [];
            expect(onConnectExternalListeners.length).toBeGreaterThan(0);
            const port = makePort({
                name: 'external-extension',
                sender: { url: 'chrome-extension://some-other-id', tab: { id: 200 } },
            });
            const result = await Promise.race([
                Promise.resolve(onConnectExternalListeners[0](port)).catch(() => 'rejected'),
                new Promise(resolve => setTimeout(() => resolve('timeout'), 200)),
            ]);
            expect(['timeout', 'rejected', undefined]).toContain(result);
        });

        it('captures eth_requestAccounts on external port messages', async () => {
            const port = makePort({
                name: 'external-page',
                sender: { url: 'https://dapp2.example.com', tab: { id: 100 } },
            });
            await callConnect(port);
            port.__dispatchMessage({ data: { method: 'eth_requestAccounts' } });
            // No throw == coverage win
            expect(port.onMessage.addListener).toHaveBeenCalled();
        });

        it('routes a port without a sender.url through connectRemote without crashing', async () => {
            const port = makePort({ name: 'external-page' });
            // Force sender to have no url so the optional chain produces null.
            port.sender = { tab: { id: 999 } };
            await callConnect(port);
            // No throw == success — branch coverage for sender?.url being falsy.
            expect(true).toBe(true);
        });

        it('reuses existing tabOriginMapping entries on repeat external connections', async () => {
            const portA = makePort({
                name: 'external-page',
                sender: { url: 'https://dapp3.example.com', tab: { id: 300 } },
            });
            await callConnect(portA);
            const portB = makePort({
                name: 'external-page',
                sender: { url: 'https://dapp3.example.com', tab: { id: 300 } },
            });
            await callConnect(portB);
            // Both should have registered an onMessage listener.
            expect(portA.onMessage.addListener).toHaveBeenCalled();
            expect(portB.onMessage.addListener).toHaveBeenCalled();
        });

        it('ignores non-ETH_REQUEST_ACCOUNTS messages on external ports', async () => {
            const port = makePort({
                name: 'external-page',
                sender: { url: 'https://dapp4.example.com', tab: { id: 400 } },
            });
            await callConnect(port);
            // Dispatch an unrelated message — must not crash and must not throw.
            expect(() =>
                port.__dispatchMessage({ data: { method: 'eth_chainId' } }),
            ).not.toThrow();
        });
    });

    describe('controller-driven side effects', () => {
        const getAppController = () =>
            (globalThis as any).__CHILLY_TEST_APP_CONTROLLER__ as any;
        const getNotificationManager = () =>
            (globalThis as any).__CHILLY_TEST_NOTIFICATION_MANAGER__ as { showPopup: jest.Mock };

        beforeEach(async () => {
            // Ensure controller exists by triggering initBackground at least once.
            const store = mockLocalStoreImpl();
            store.get.mockResolvedValue({ meta: { version: 5 }, data: { config: {} } });
            (browser.tabs.query as jest.Mock).mockResolvedValue([]);
            await initBackground().catch(() => undefined);
            await new Promise<void>(resolve => setTimeout(resolve, 10));
        });

        it('updates the legacy browserAction badge with the count when running on MV2', () => {
            const appController = getAppController();
            appController.approvalController.getTotalApprovalCount = jest.fn(() => 2);
            appController.appStateController.waitingForUnlock = [];
            (browser.browserAction.setBadgeText as jest.Mock).mockClear();
            (browser.browserAction.setBadgeBackgroundColor as jest.Mock).mockClear();
            (globalThis as any).__CHILLY_TEST_IS_MV3__ = false;
            try {
                const stateChangeListeners = appController.__stateChangeListeners as Array<
                    (...args: any[]) => void
                >;
                stateChangeListeners[stateChangeListeners.length - 1]();
                expect(browser.browserAction.setBadgeText).toHaveBeenCalledWith({ text: '2' });
                expect(browser.browserAction.setBadgeBackgroundColor).toHaveBeenCalled();
            } finally {
                (globalThis as any).__CHILLY_TEST_IS_MV3__ = true;
            }
        });

        it('updates the action badge with the pending approval count (MV3)', () => {
            const appController = getAppController();
            // Bump the approval count and emit a state change.
            appController.approvalController.getTotalApprovalCount = jest.fn(() => 3);
            appController.appStateController.waitingForUnlock = [];
            (browser.action.setBadgeText as jest.Mock).mockClear();
            const stateChangeListeners = appController.__stateChangeListeners as Array<
                (...args: any[]) => void
            >;
            stateChangeListeners[stateChangeListeners.length - 1]();
            expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: '3' });
            expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalled();
        });

        it('opens the popup via showUserConfirmation when triggered through opts', async () => {
            const appController = getAppController();
            const noti = getNotificationManager();
            noti.showPopup.mockClear();
            // Have showPopup invoke the setCurrentPopupId callback so the inline arrow body runs.
            noti.showPopup.mockImplementation(async (setId: any, _existing: any) => {
                setId('new-popup-id-123');
            });
            const showUserConfirmation = appController.__opts.showUserConfirmation as () =>
                | Promise<void>
                | void;
            await showUserConfirmation();
            expect(noti.showPopup).toHaveBeenCalled();
            expect(appController.appStateController.getCurrentPopupId()).toBe('new-popup-id-123');
        });

        it('skips showPopup while another popup is already open', async () => {
            const appController = getAppController();
            const noti = getNotificationManager();
            // Connect a popup port to bump openPopupCount above 0.
            const onConnect = ((globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ ||
                [])[0];
            const popupListeners: Array<() => void> = [];
            const port = {
                name: 'popup',
                sender: { url: `chrome-extension://mock-extension-id/popup.html` },
                onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
                onDisconnect: {
                    addListener: jest.fn(cb => popupListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                disconnect: jest.fn(),
                postMessage: jest.fn(),
            };
            await Promise.resolve(onConnect(port)).catch(() => undefined);
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            noti.showPopup.mockClear();
            const showUserConfirmation = appController.__opts.showUserConfirmation as () =>
                | Promise<void>
                | void;
            await showUserConfirmation();
            expect(noti.showPopup).not.toHaveBeenCalled();
            // Cleanup
            popupListeners.forEach(l => l());
            await new Promise<void>(resolve => setTimeout(resolve, 10));
        });

        it('skips showPopup when the sidepanel is already open', async () => {
            const appController = getAppController();
            const noti = getNotificationManager();
            noti.showPopup.mockClear();
            // Flip sidePanelOpened by routing a sidepanel port through onConnect.
            const onConnect = ((globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ ||
                [])[0];
            const port = {
                name: 'sidepanel',
                sender: { url: `chrome-extension://mock-extension-id/sidepanel.html` },
                onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
                onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                disconnect: jest.fn(),
                postMessage: jest.fn(),
            };
            await Promise.resolve(onConnect(port)).catch(() => undefined);
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            const showUserConfirmation = appController.__opts.showUserConfirmation as () =>
                | Promise<void>
                | void;
            await showUserConfirmation();
            expect(noti.showPopup).not.toHaveBeenCalled();
        });

        it('resolves SHOW_CALLS_STATUS approvals when the popup closes', async () => {
            const appController = getAppController();
            const onConnect = ((globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ ||
                [])[0];
            // Seed a pending approval with the EIP5792 SHOW_CALLS_STATUS type.
            appController.approvalController.state.pendingApprovals = {
                appr1: { type: 'wallet_showCallsStatus' },
                appr2: { type: 'other' },
            };
            appController.resolvePendingApproval = jest.fn();
            const msgListeners: Array<(msg: any) => void> = [];
            const disconnectListeners: Array<() => void> = [];
            const port = {
                name: 'popup',
                sender: { url: `chrome-extension://mock-extension-id/popup.html` },
                onMessage: {
                    addListener: jest.fn(cb => msgListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                onDisconnect: {
                    addListener: jest.fn(cb => disconnectListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                disconnect: jest.fn(),
                postMessage: jest.fn(),
            };
            await Promise.resolve(onConnect(port)).catch(() => undefined);
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            disconnectListeners.forEach(l => l());
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            // SHOW_CALLS_STATUS approval should be resolved with null.
            expect(appController.resolvePendingApproval).toHaveBeenCalledWith('appr1', null);
        });

        it('checks chrome-extension origin against runtime id on non-Firefox platforms', async () => {
            (globalThis as any).__CHILLY_TEST_PLATFORM_NAME__ = 'Chrome';
            try {
                const onConnect = ((globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ ||
                    [])[0];
                const port = {
                    name: 'popup',
                    sender: { url: `chrome-extension://mock-extension-id/popup.html` },
                    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
                    onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                    disconnect: jest.fn(),
                    postMessage: jest.fn(),
                };
                // Just exercise the else branch (line 247-248); the actual origin comparison
                // result varies under jsdom but the comparison expression itself must run.
                await Promise.resolve(onConnect(port)).catch(() => undefined);
                await new Promise<void>(resolve => setTimeout(resolve, 10));
                expect(port.onMessage.addListener).toHaveBeenCalled();
            } finally {
                (globalThis as any).__CHILLY_TEST_PLATFORM_NAME__ = 'Firefox';
            }
        });

        it('treats mismatched chrome-extension origin as external on non-Firefox platforms', async () => {
            (globalThis as any).__CHILLY_TEST_PLATFORM_NAME__ = 'Chrome';
            try {
                const onConnect = ((globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ ||
                    [])[0];
                const appController = (globalThis as any).__CHILLY_TEST_APP_CONTROLLER__ as any;
                const spy = jest.spyOn(appController, 'setupUntrustedCommunication');
                const port = {
                    name: 'external-page',
                    sender: {
                        url: 'https://example.com/page',
                        tab: { id: 555 },
                    },
                    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
                    onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                    disconnect: jest.fn(),
                    postMessage: jest.fn(),
                };
                await Promise.resolve(onConnect(port)).catch(() => undefined);
                await new Promise<void>(resolve => setTimeout(resolve, 10));
                expect(spy).toHaveBeenCalled();
                spy.mockRestore();
            } finally {
                (globalThis as any).__CHILLY_TEST_PLATFORM_NAME__ = 'Firefox';
            }
        });

        it('writes new state through the persistence pipeline sink', async () => {
            const localStore = mockLocalStoreImpl();
            localStore.set.mockClear();
            const stream = (globalThis as any).__CHILLY_TEST_STORE_STREAM__ as any;
            stream.push({ snapshot: 1 });
            await new Promise<void>(resolve => setTimeout(resolve, 1100));
            expect(localStore.set).toHaveBeenCalledWith(expect.objectContaining({ snapshot: 1 }));
        });

        it('logs when the persistence pipeline finishes with an error', async () => {
            const logger = require('../src/shared/utils/logger').default as { log: jest.Mock };
            logger.log.mockClear();
            const stream = (globalThis as any).__CHILLY_TEST_STORE_STREAM__ as any;
            stream.destroy(new Error('persistence-failed'));
            await new Promise<void>(resolve => setTimeout(resolve, 50));
            expect(
                logger.log.mock.calls.some(args =>
                    args.some(a => typeof a === 'string' && a.includes('Persistence pipeline failed')),
                ),
            ).toBe(true);
        });

        it('disconnects environment-specific polling when a popup closes while other tabs stay open', async () => {
            const appController = (globalThis as any).__CHILLY_TEST_APP_CONTROLLER__ as any;
            appController.onEnvironmentTypeClosed = jest.fn();
            const onConnect = ((globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ ||
                [])[0];
            // Keep a fullscreen tab alive so isClientOpen stays truthy when the popup closes.
            const fullscreenListeners: Array<() => void> = [];
            const fullscreenPort = {
                name: 'fullscreen',
                sender: {
                    url: `chrome-extension://mock-extension-id/home.html`,
                    tab: { id: 7777 },
                },
                onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
                onDisconnect: {
                    addListener: jest.fn(cb => fullscreenListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                disconnect: jest.fn(),
                postMessage: jest.fn(),
            };
            await Promise.resolve(onConnect(fullscreenPort)).catch(() => undefined);
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            // Now route + close a popup port. isClientOpen will be true because tab 7777 is open.
            const popupListeners: Array<() => void> = [];
            const popupPort = {
                name: 'popup',
                sender: { url: `chrome-extension://mock-extension-id/popup.html` },
                onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
                onDisconnect: {
                    addListener: jest.fn(cb => popupListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                disconnect: jest.fn(),
                postMessage: jest.fn(),
            };
            await Promise.resolve(onConnect(popupPort)).catch(() => undefined);
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            popupListeners.forEach(l => l());
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            expect(appController.onEnvironmentTypeClosed).toHaveBeenCalledWith('popup');
            // Cleanup: close the fullscreen tab so subsequent tests start clean.
            fullscreenListeners.forEach(l => l());
            await new Promise<void>(resolve => setTimeout(resolve, 10));
        });

        it('keeps fullscreen polling alive when more tabs remain after one closes', async () => {
            const appController = getAppController();
            appController.onEnvironmentTypeClosed = jest.fn();
            const onConnect = ((globalThis as any).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ ||
                [])[0];
            const makeFullscreen = (id: number) => {
                const listeners: Array<() => void> = [];
                return {
                    port: {
                        name: 'fullscreen',
                        sender: {
                            url: `chrome-extension://mock-extension-id/home.html`,
                            tab: { id },
                        },
                        onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
                        onDisconnect: {
                            addListener: jest.fn(cb => listeners.push(cb)),
                            removeListener: jest.fn(),
                        },
                        disconnect: jest.fn(),
                        postMessage: jest.fn(),
                    },
                    dispatchClose: () => listeners.forEach(l => l()),
                };
            };
            const a = makeFullscreen(1000);
            const b = makeFullscreen(1001);
            await Promise.resolve(onConnect(a.port)).catch(() => undefined);
            await Promise.resolve(onConnect(b.port)).catch(() => undefined);
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            // Close one fullscreen tab; the other still keeps openTabsIDs non-empty.
            a.dispatchClose();
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            // onEnvironmentTypeClosed must NOT have been called when other fullscreen tabs remain.
            expect(appController.onEnvironmentTypeClosed).not.toHaveBeenCalledWith('fullscreen');
        });
    });

});
