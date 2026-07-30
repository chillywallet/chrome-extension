/* Shared fake browser API for Jest (not under __mocks__/webextension-polyfill to avoid require recursion) */
const runtimeMessageListeners = [];
(globalThis).__CHILLY_TEST_RUNTIME_MESSAGE_LISTENERS__ = runtimeMessageListeners;
const runtimeConnectListeners = [];
(globalThis).__CHILLY_TEST_RUNTIME_CONNECT_LISTENERS__ = runtimeConnectListeners;
const runtimeConnectExternalListeners = [];
(globalThis).__CHILLY_TEST_RUNTIME_CONNECT_EXTERNAL_LISTENERS__ = runtimeConnectExternalListeners;

/** Avoid `jest.fn` at module-init for `connect` — when this mock is loaded from a `jest.mock` factory it can yield a no-op mock that returns undefined. */
function createRuntimePort() {
    return {
        onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
        onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
        disconnect: jest.fn(),
    };
}

const browser = {
    runtime: {
        id: 'mock-extension-id',
        connect(..._args) {
            return createRuntimePort();
        },
        getManifest: jest.fn(() => ({ manifest_version: 3 })),
        // Plain function on purpose: CRA sets resetMocks:true, which would wipe a
        // jest.fn implementation and make getURL return undefined mid-suite.
        getURL: (path) =>
            `chrome-extension://mock-extension-id${path.startsWith('/') ? path : `/${path}`}`,
        onConnect: {
            addListener: jest.fn((cb) => {
                runtimeConnectListeners.push(cb);
            }),
        },
        onConnectExternal: {
            addListener: jest.fn((cb) => {
                runtimeConnectExternalListeners.push(cb);
            }),
        },
        onMessage: {
            addListener: jest.fn((cb) => {
                runtimeMessageListeners.push(cb);
            }),
            removeListener: jest.fn(),
        },
    },
    tabs: {
        query: jest.fn().mockResolvedValue([]),
        sendMessage: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
    webNavigation: {
        onBeforeNavigate: {
            addListener: jest.fn((cb) => {
                (globalThis).__CHILLY_TEST_WEBNAV_LISTENERS__ =
                    (globalThis).__CHILLY_TEST_WEBNAV_LISTENERS__ || [];
                (globalThis).__CHILLY_TEST_WEBNAV_LISTENERS__.push(cb);
            }),
        },
    },
    storage: {
        session: {
            get: jest.fn().mockResolvedValue({}),
            set: jest.fn().mockResolvedValue(undefined),
        },
        local: { get: jest.fn(), set: jest.fn() },
    },
    action: { setBadgeText: jest.fn(), setBadgeBackgroundColor: jest.fn() },
    browserAction: { setBadgeText: jest.fn(), setBadgeBackgroundColor: jest.fn() },
};

module.exports = {
    __esModule: true,
    default: browser,
};
