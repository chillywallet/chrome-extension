import '@testing-library/jest-dom';

// Polyfill TextEncoder/TextDecoder for libs that need them (e.g. viem) under jsdom
if (typeof (global as any).TextEncoder === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TextEncoder, TextDecoder } = require('util');
    (global as any).TextEncoder = TextEncoder;
    (global as any).TextDecoder = TextDecoder;
}

if (typeof (global as any).structuredClone === 'undefined') {
    (global as any).structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
}

// Mock chrome extension APIs
const mockChrome = {
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        getURL: jest.fn((path: string) => `chrome-extension://mock-id/${path}`),
        id: 'mock-extension-id',
        connect: jest.fn(() => ({
            onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
            onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
            disconnect: jest.fn(),
        })),
        getManifest: jest.fn(() => ({ manifest_version: 2 })),
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
        },
        sync: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
        },
    },
    tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
        create: jest.fn(),
    },
};

(global as any).chrome = mockChrome;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));
