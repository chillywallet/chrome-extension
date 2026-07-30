/**
 * @jest-environment jsdom
 */

import type { Browser } from 'webextension-polyfill';
import { getEnvironmentType } from '../src/shared/utils/utils';
import { setupMultiplex } from '../src/lib/stream-utils';
import createRPCClientFactory from '../src/lib/RPCClientFactory';
import {
    connectToAccountManager,
    queryCurrentActiveTab,
    setupControllerConnection,
    setupWeb3Connection,
    start,
} from '../src/App';

jest.mock('webextension-polyfill', () => require('./helpers/webextensionTestMock.js'));

jest.mock('../src/shared/utils/logger', () => ({
    __esModule: true,
    default: {
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
    },
}));

jest.mock('../src/shared/utils/browser-runtime-utils', () => ({
    isManifestV3: false,
    checkForLastErrorAndLog: jest.fn(),
}));

jest.mock('../src/shared/utils/utils', () => ({
    __esModule: true,
    getEnvironmentType: jest.fn(() => 'popup'),
}));

jest.mock('../src/ui', () => ({
    __esModule: true,
    default: jest.fn(),
    startReloadPage: jest.fn(),
    updateBackgroundConnection: jest.fn(),
}));

jest.mock('../src/lib/ExtensionPlatform', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(function MockPlatform(this: Record<string, unknown>) {
        this.openExtensionInBrowser = jest.fn();
    }),
}));

jest.mock('extension-port-stream', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(function PortStreamMock(this: any, _port: unknown) {
            this.on = jest.fn();
            this.pipe = jest.fn((dst: any) => dst);
            this.write = jest.fn();
        }),
    };
});

jest.mock('web3-stream-provider', () => {
    return jest.fn().mockImplementation(function StreamProviderMock(this: any) {
        this.on = jest.fn();
        this.pipe = jest.fn((dst: any) => dst);
    });
});

jest.mock('@metamask/eth-query', () => {
    return jest.fn().mockImplementation(function EthQueryMock(this: any) {
        this.tag = 'ethquery';
    });
});

jest.mock('@metamask/ethjs', () => {
    return jest.fn().mockImplementation(function EthMock(this: any) {
        this.tag = 'eth';
    });
});

jest.mock('../src/lib/RPCClientFactory', () => ({
    __esModule: true,
    default: jest.fn(() => ({ backgroundRPC: true })),
}));

jest.mock('../src/lib/stream-utils', () => ({
    __esModule: true,
    setupMultiplex: jest.fn(() => ({
        createStream: jest.fn(() => ({
            on: jest.fn(),
            pipe: jest.fn((dst: any) => dst),
        })),
    })),
}));

const getBrowser = () => require('webextension-polyfill').default as Browser;

describe('App entry', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app-content"></div>';
        const b = getBrowser();
        (b.tabs.query as jest.Mock).mockClear();
        (b.tabs.query as jest.Mock).mockResolvedValue([]);
        (global as any).platform = undefined;
        (global as any).ethereumProvider = undefined;
        (global as any).ethQuery = undefined;
        (global as any).eth = undefined;
        // Restore impls that resetMocks wipes between tests
        (setupMultiplex as jest.Mock).mockImplementation(() => ({
            createStream: jest.fn(() => ({
                on: jest.fn(),
                pipe: jest.fn((dst: any) => dst),
            })),
        }));
        (createRPCClientFactory as unknown as jest.Mock).mockImplementation(() => ({
            backgroundRPC: true,
        }));
        const PortStream = require('extension-port-stream').default as jest.Mock;
        PortStream.mockImplementation(function (this: any) {
            this.on = jest.fn();
            this.pipe = jest.fn((dst: any) => dst);
            this.write = jest.fn();
        });
        const StreamProvider = require('web3-stream-provider') as jest.Mock;
        StreamProvider.mockImplementation(function (this: any) {
            this.on = jest.fn();
            this.pipe = jest.fn((dst: any) => dst);
        });
        const EthQueryCtor = require('@metamask/eth-query') as jest.Mock;
        EthQueryCtor.mockImplementation(function (this: any) {
            this.tag = 'ethquery';
        });
        const EthCtor = require('@metamask/ethjs') as jest.Mock;
        EthCtor.mockImplementation(function (this: any) {
            this.tag = 'eth';
        });
    });

    describe('queryCurrentActiveTab', () => {
        it('returns null when window type is not popup', async () => {
            await expect(queryCurrentActiveTab('fullscreen' as any)).resolves.toBeNull();
            expect(getBrowser().tabs.query).not.toHaveBeenCalled();
        });

        it('returns null when tabs query fails', async () => {
            const logger = require('../src/shared/utils/logger').default;
            (getBrowser().tabs.query as jest.Mock).mockRejectedValueOnce(new Error('no tab'));
            await expect(queryCurrentActiveTab('popup' as any)).resolves.toBeNull();
            expect(logger.error).toHaveBeenCalled();
        });

        it('skips logger.error when checkForLastErrorAndLog returns truthy', async () => {
            const { checkForLastErrorAndLog } = require('../src/shared/utils/browser-runtime-utils');
            const logger = require('../src/shared/utils/logger').default;
            (checkForLastErrorAndLog as jest.Mock).mockReturnValueOnce(new Error('last'));
            (getBrowser().tabs.query as jest.Mock).mockRejectedValueOnce(new Error('boom'));
            (logger.error as jest.Mock).mockClear();
            await expect(queryCurrentActiveTab('popup' as any)).resolves.toBeNull();
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('returns null when active tab has no usable url', async () => {
            (getBrowser().tabs.query as jest.Mock).mockResolvedValueOnce([
                { id: 1, title: '', url: '' },
            ]);
            await expect(queryCurrentActiveTab('popup' as any)).resolves.toBeNull();
        });

        it('returns null when origin is null', async () => {
            (getBrowser().tabs.query as jest.Mock).mockResolvedValueOnce([
                { id: 2, title: 'x', url: 'null://void' },
            ]);
            await expect(queryCurrentActiveTab('popup' as any)).resolves.toBeNull();
        });

        it('returns active tab info for a normal https url', async () => {
            (getBrowser().tabs.query as jest.Mock).mockResolvedValueOnce([
                { id: 3, title: 'Site', url: 'https://example.com/foo' },
            ]);
            await expect(queryCurrentActiveTab('popup' as any)).resolves.toEqual({
                id: 3,
                title: 'Site',
                origin: 'https://example.com',
                protocol: 'https:',
                url: 'https://example.com/foo',
            });
        });

        it('falls back to defaults when id/title are missing', async () => {
            (getBrowser().tabs.query as jest.Mock).mockResolvedValueOnce([
                { url: 'https://example.org/' },
            ]);
            await expect(queryCurrentActiveTab('popup' as any)).resolves.toEqual({
                id: 0,
                title: '',
                origin: 'https://example.org',
                protocol: 'https:',
                url: 'https://example.org/',
            });
        });
    });

    describe('start', () => {
        beforeEach(() => {
            (getEnvironmentType as jest.Mock).mockReturnValue('popup');
            (getBrowser().tabs.query as jest.Mock).mockResolvedValue([
                { id: 1, title: 't', url: 'https://example.com/' },
            ]);
            jest.spyOn(getBrowser().runtime, 'connect').mockImplementation(() => ({
                onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
                onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                disconnect: jest.fn(),
            }));
            const Platform = require('../src/lib/ExtensionPlatform').default as jest.Mock;
            Platform.mockImplementation(function (this: any) {
                this.openExtensionInBrowser = jest.fn();
            });
        });

        it('uses mocked environment type for the runtime port name', () => {
            (getEnvironmentType as jest.Mock).mockReturnValueOnce('notification');
            void start();
            expect(getBrowser().runtime.connect).toHaveBeenCalledWith({ name: 'notification' });
        });

        it('opens a runtime port for the active window type', async () => {
            jest.useFakeTimers();
            await start();
            expect(getBrowser().runtime.connect).toHaveBeenCalledWith({ name: 'popup' });
            jest.advanceTimersByTime(60_000);
            jest.useRealTimers();
        });

        it('invokes the non-MV3 message listener and triggers initializeUiWithTab', async () => {
            jest.isolateModules(() => {
                jest.doMock('../src/shared/utils/browser-runtime-utils', () => ({
                    isManifestV3: false,
                    checkForLastErrorAndLog: jest.fn(),
                }));
            });
            const addedListeners: Array<(m: any) => void> = [];
            const removeListener = jest.fn();
            jest.spyOn(getBrowser().runtime, 'connect').mockImplementation(() => ({
                onMessage: {
                    addListener: jest.fn((cb: any) => addedListeners.push(cb)),
                    removeListener,
                },
                onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                disconnect: jest.fn(),
            }));
            const launchUI = require('../src/ui').default as jest.Mock;
            launchUI.mockImplementation((_bg: any, _opts: any, cb: any) => {
                cb({
                    getState: () => ({ globalState: { completedOnboarding: false } }),
                });
            });
            await start();
            // Invoke listener with a non-matching method (no-op branch)
            addedListeners[0]?.({ data: { method: 'other' } });
            // Invoke listener with undefined message and undefined data
            addedListeners[0]?.(undefined);
            addedListeners[0]?.({});
            addedListeners[0]?.({ data: undefined });
            // Invoke listener with startUISync triggers UI initialisation and removes listener
            addedListeners[0]?.({ data: { method: 'startUISync' } });
            expect(launchUI).toHaveBeenCalled();
            expect(removeListener).toHaveBeenCalled();
        });

        it('opens the extension in browser when onboarding incomplete and not fullscreen', async () => {
            const launchUI = require('../src/ui').default as jest.Mock;
            const Platform = require('../src/lib/ExtensionPlatform').default as jest.Mock;
            const opened: any[] = [];
            Platform.mockImplementation(function (this: any) {
                this.openExtensionInBrowser = jest.fn(() => opened.push(true));
            });
            const addedListeners: Array<(m: any) => void> = [];
            jest.spyOn(getBrowser().runtime, 'connect').mockImplementation(() => ({
                onMessage: {
                    addListener: jest.fn((cb: any) => addedListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                disconnect: jest.fn(),
            }));
            launchUI.mockImplementation((_bg: any, _opts: any, cb: any) => {
                cb({
                    getState: () => ({ globalState: { completedOnboarding: false } }),
                });
            });
            await start();
            addedListeners[0]?.({ data: { method: 'startUISync' } });
            expect(opened.length).toBe(1);
        });

        it('does not open browser when fullscreen', async () => {
            (getEnvironmentType as jest.Mock).mockReturnValue('fullscreen');
            const launchUI = require('../src/ui').default as jest.Mock;
            const Platform = require('../src/lib/ExtensionPlatform').default as jest.Mock;
            const opened: any[] = [];
            Platform.mockImplementation(function (this: any) {
                this.openExtensionInBrowser = jest.fn(() => opened.push(true));
            });
            const addedListeners: Array<(m: any) => void> = [];
            jest.spyOn(getBrowser().runtime, 'connect').mockImplementation(() => ({
                onMessage: {
                    addListener: jest.fn((cb: any) => addedListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                disconnect: jest.fn(),
            }));
            launchUI.mockImplementation((_bg: any, _opts: any, cb: any) => {
                cb({
                    getState: () => ({ globalState: { completedOnboarding: false } }),
                });
            });
            await start();
            addedListeners[0]?.({ data: { method: 'startUISync' } });
            expect(opened.length).toBe(0);
        });

        it('skips browser open when onboarding is complete', async () => {
            const launchUI = require('../src/ui').default as jest.Mock;
            const Platform = require('../src/lib/ExtensionPlatform').default as jest.Mock;
            const opened: any[] = [];
            Platform.mockImplementation(function (this: any) {
                this.openExtensionInBrowser = jest.fn(() => opened.push(true));
            });
            const addedListeners: Array<(m: any) => void> = [];
            jest.spyOn(getBrowser().runtime, 'connect').mockImplementation(() => ({
                onMessage: {
                    addListener: jest.fn((cb: any) => addedListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                disconnect: jest.fn(),
            }));
            launchUI.mockImplementation((_bg: any, _opts: any, cb: any) => {
                cb({
                    getState: () => ({ globalState: { completedOnboarding: true } }),
                });
            });
            await start();
            addedListeners[0]?.({ data: { method: 'startUISync' } });
            expect(opened.length).toBe(0);
        });

        it('reloads page when UI is not initialised after timeout', async () => {
            jest.useFakeTimers();
            const { startReloadPage } = require('../src/ui');
            await start();
            jest.advanceTimersByTime(60_000);
            expect(startReloadPage).toHaveBeenCalled();
            jest.useRealTimers();
        });

        it('does not reload when UI has been initialised before timeout', async () => {
            jest.useFakeTimers();
            const addedListeners: Array<(m: any) => void> = [];
            jest.spyOn(getBrowser().runtime, 'connect').mockImplementation(() => ({
                onMessage: {
                    addListener: jest.fn((cb: any) => addedListeners.push(cb)),
                    removeListener: jest.fn(),
                },
                onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
                disconnect: jest.fn(),
            }));
            const launchUI = require('../src/ui').default as jest.Mock;
            const { startReloadPage } = require('../src/ui');
            (startReloadPage as jest.Mock).mockClear();
            launchUI.mockImplementation((_bg: any, _opts: any, cb: any) => {
                cb({
                    getState: () => ({ globalState: { completedOnboarding: true } }),
                });
            });
            await start();
            addedListeners[0]?.({ data: { method: 'startUISync' } });
            jest.advanceTimersByTime(60_000);
            expect(startReloadPage).not.toHaveBeenCalled();
            jest.useRealTimers();
        });
    });

    describe('MV3 message listener', () => {
        it('initialises UI on startUISync and uses updateUIStreams on subsequent startUISync', async () => {
            const messageListeners: Array<(m: any) => void> = [];
            const disconnectListeners: Array<() => void> = [];
            type Captured = {
                launchUI: jest.Mock;
                updateBackgroundConnection: jest.Mock;
                connect: jest.Mock;
                startMv3: () => Promise<void>;
            };
            const captured = await new Promise<Captured>((resolve) => {
                jest.isolateModules(() => {
                    jest.resetModules();
                    jest.doMock('webextension-polyfill', () =>
                        require('./helpers/webextensionTestMock.js'),
                    );
                    jest.doMock('../src/shared/utils/browser-runtime-utils', () => ({
                        isManifestV3: true,
                        checkForLastErrorAndLog: jest.fn(),
                    }));
                    jest.doMock('../src/shared/utils/utils', () => ({
                        __esModule: true,
                        getEnvironmentType: jest.fn(() => 'popup'),
                    }));
                    jest.doMock('../src/shared/utils/logger', () => ({
                        __esModule: true,
                        default: {
                            log: jest.fn(),
                            info: jest.fn(),
                            warn: jest.fn(),
                            error: jest.fn(),
                            debug: jest.fn(),
                            trace: jest.fn(),
                        },
                    }));
                    jest.doMock('../src/ui', () => ({
                        __esModule: true,
                        default: jest.fn((_bg: any, _opts: any, cb: any) =>
                            cb({
                                getState: () => ({
                                    globalState: { completedOnboarding: true },
                                }),
                            }),
                        ),
                        startReloadPage: jest.fn(),
                        updateBackgroundConnection: jest.fn(),
                    }));
                    jest.doMock('../src/lib/ExtensionPlatform', () => ({
                        __esModule: true,
                        default: jest.fn().mockImplementation(function (this: any) {
                            this.openExtensionInBrowser = jest.fn();
                        }),
                    }));
                    jest.doMock('extension-port-stream', () => ({
                        __esModule: true,
                        default: jest.fn().mockImplementation(function (this: any) {
                            this.on = jest.fn();
                            this.pipe = jest.fn((dst: any) => dst);
                        }),
                    }));
                    jest.doMock('web3-stream-provider', () =>
                        jest.fn().mockImplementation(function (this: any) {
                            this.on = jest.fn();
                            this.pipe = jest.fn((dst: any) => dst);
                        }),
                    );
                    jest.doMock('@metamask/eth-query', () =>
                        jest.fn().mockImplementation(function (this: any) {
                            this.tag = 'ethquery';
                        }),
                    );
                    jest.doMock('@metamask/ethjs', () =>
                        jest.fn().mockImplementation(function (this: any) {
                            this.tag = 'eth';
                        }),
                    );
                    jest.doMock('../src/lib/RPCClientFactory', () => ({
                        __esModule: true,
                        default: jest.fn(() => ({ backgroundRPC: true })),
                    }));
                    jest.doMock('../src/lib/stream-utils', () => ({
                        __esModule: true,
                        setupMultiplex: jest.fn(() => ({
                            createStream: jest.fn(() => ({
                                on: jest.fn(),
                                pipe: jest.fn((dst: any) => dst),
                            })),
                        })),
                    }));
                    const browserPolyfill = require('webextension-polyfill').default;
                    jest.spyOn(browserPolyfill.runtime, 'connect').mockImplementation(() => ({
                        onMessage: {
                            addListener: jest.fn((cb: any) => messageListeners.push(cb)),
                            removeListener: jest.fn(),
                        },
                        onDisconnect: {
                            addListener: jest.fn((cb: any) => disconnectListeners.push(cb)),
                            removeListener: jest.fn(),
                        },
                        disconnect: jest.fn(),
                    }));
                    (browserPolyfill.tabs.query as jest.Mock).mockResolvedValue([
                        { id: 1, title: 't', url: 'https://example.com/' },
                    ]);
                    const { start: startMv3 } = require('../src/App');
                    resolve({
                        launchUI: require('../src/ui').default,
                        updateBackgroundConnection: require('../src/ui').updateBackgroundConnection,
                        connect: browserPolyfill.runtime.connect,
                        startMv3,
                    });
                });
            });
            document.body.innerHTML = '<div id="app-content"></div>';
            await captured.startMv3();
            messageListeners[0]?.({ data: { method: 'startUISync' } });
            messageListeners[0]?.({ data: { method: 'startUISync' } });
            messageListeners[0]?.({ data: { method: 'other' } });
            messageListeners[0]?.(undefined);
            messageListeners[0]?.({});
            messageListeners[0]?.({ data: undefined });
            disconnectListeners[0]?.();
            expect(captured.launchUI).toHaveBeenCalled();
            expect(captured.updateBackgroundConnection).toHaveBeenCalled();
            expect(captured.connect).toHaveBeenCalledTimes(2);
        });
    });

    describe('module init guard', () => {
        it('invokes start() when JEST_WORKER_ID is undefined', () => {
            const orig = process.env.JEST_WORKER_ID;
            delete process.env.JEST_WORKER_ID;
            try {
                jest.isolateModules(() => {
                    jest.doMock('webextension-polyfill', () =>
                        require('./helpers/webextensionTestMock.js'),
                    );
                    jest.doMock('../src/shared/utils/browser-runtime-utils', () => ({
                        isManifestV3: false,
                        checkForLastErrorAndLog: jest.fn(),
                    }));
                    jest.doMock('../src/shared/utils/utils', () => ({
                        __esModule: true,
                        getEnvironmentType: jest.fn(() => 'popup'),
                    }));
                    jest.doMock('../src/shared/utils/logger', () => ({
                        __esModule: true,
                        default: {
                            log: jest.fn(),
                            info: jest.fn(),
                            warn: jest.fn(),
                            error: jest.fn(),
                            debug: jest.fn(),
                            trace: jest.fn(),
                        },
                    }));
                    jest.doMock('../src/ui', () => ({
                        __esModule: true,
                        default: jest.fn(),
                        startReloadPage: jest.fn(),
                        updateBackgroundConnection: jest.fn(),
                    }));
                    jest.doMock('../src/lib/ExtensionPlatform', () => ({
                        __esModule: true,
                        default: jest.fn().mockImplementation(function (this: any) {
                            this.openExtensionInBrowser = jest.fn();
                        }),
                    }));
                    jest.doMock('extension-port-stream', () => ({
                        __esModule: true,
                        default: jest.fn().mockImplementation(function (this: any) {
                            this.on = jest.fn();
                            this.pipe = jest.fn((dst: any) => dst);
                        }),
                    }));
                    jest.doMock('web3-stream-provider', () =>
                        jest.fn().mockImplementation(function (this: any) {
                            this.on = jest.fn();
                            this.pipe = jest.fn((dst: any) => dst);
                        }),
                    );
                    jest.doMock('@metamask/eth-query', () =>
                        jest.fn().mockImplementation(function (this: any) {
                            this.tag = 'ethquery';
                        }),
                    );
                    jest.doMock('@metamask/ethjs', () =>
                        jest.fn().mockImplementation(function (this: any) {
                            this.tag = 'eth';
                        }),
                    );
                    jest.doMock('../src/lib/RPCClientFactory', () => ({
                        __esModule: true,
                        default: jest.fn(() => ({ backgroundRPC: true })),
                    }));
                    jest.doMock('../src/lib/stream-utils', () => ({
                        __esModule: true,
                        setupMultiplex: jest.fn(() => ({
                            createStream: jest.fn(() => ({
                                on: jest.fn(),
                                pipe: jest.fn((dst: any) => dst),
                            })),
                        })),
                    }));
                    require('../src/App');
                });
            } finally {
                if (orig !== undefined) process.env.JEST_WORKER_ID = orig;
            }
        });
    });

    describe('connection helpers', () => {
        let helpers: typeof import('../src/App');
        beforeEach(() => {
            // After MV3 resetModules, re-require fresh App module to bind to
            // the currently-active jest module factories.
            helpers = require('../src/App');
            // Re-establish web3 / eth / port stream impls (resetMocks wipes between tests).
            const PortStream = require('extension-port-stream').default as jest.Mock;
            PortStream.mockImplementation(function (this: any) {
                this.on = jest.fn();
                this.pipe = jest.fn((dst: any) => dst);
                this.write = jest.fn();
            });
            const StreamProvider = require('web3-stream-provider') as jest.Mock;
            StreamProvider.mockImplementation(function (this: any) {
                this.on = jest.fn();
                this.pipe = jest.fn((dst: any) => dst);
            });
            const EthQueryCtor = require('@metamask/eth-query') as jest.Mock;
            EthQueryCtor.mockImplementation(function (this: any) {
                this.tag = 'ethquery';
            });
            const EthCtor = require('@metamask/ethjs') as jest.Mock;
            EthCtor.mockImplementation(function (this: any) {
                this.tag = 'eth';
            });
            (require('../src/lib/stream-utils').setupMultiplex as jest.Mock).mockImplementation(
                () => ({
                    createStream: jest.fn(() => ({
                        on: jest.fn(),
                        pipe: jest.fn((dst: any) => dst),
                    })),
                }),
            );
            (require('../src/lib/RPCClientFactory').default as jest.Mock).mockImplementation(
                () => ({ backgroundRPC: true }),
            );
        });

        it('connectToAccountManager wires controller + provider streams', () => {
            const cb = jest.fn();
            const stream: any = { on: jest.fn(), pipe: jest.fn((d: any) => d) };
            helpers.connectToAccountManager(stream, cb);
            expect(cb).toHaveBeenCalledWith({ backgroundRPC: true });
        });

        it('setupControllerConnection invokes callback with backgroundRPC', () => {
            const cb = jest.fn();
            const stream: any = { on: jest.fn(), pipe: jest.fn((d: any) => d) };
            helpers.setupControllerConnection(stream, cb);
            expect(cb).toHaveBeenCalledWith({ backgroundRPC: true });
        });

        it('setupWeb3Connection sets up ethereumProvider, ethQuery and eth globals', () => {
            const stream: any = { on: jest.fn(), pipe: jest.fn((d: any) => d) };
            helpers.setupWeb3Connection(stream);
            expect((global as any).ethereumProvider).toBeDefined();
            expect((global as any).ethQuery).toBeDefined();
            expect((global as any).eth).toBeDefined();
            expect(stream.on).toHaveBeenCalledWith('error', expect.any(Function));
        });
    });
});
