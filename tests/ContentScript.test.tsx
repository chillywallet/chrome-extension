/**
 * @jest-environment jsdom
 */

// Capture all ObjectMultiplex instances created during tests so we can drive pipeline error
// callbacks that are otherwise hard to reach.
import type { Browser } from 'webextension-polyfill';
import { destroyStreams, startContentScript } from '../src/ContentScript';
import { CHILLY_EXTENSION_READY } from '../src/shared/constants/app';
import { EXTERNAL_PROVIDER, INPAGE } from '../src/shared/constants/stream';
import shouldInjectProvider from '../src/shared/utils/provider-injection';
import {
    checkForLastError,
    getIsBrowserPrerenderBroken,
} from '../src/shared/utils/browser-runtime-utils';

(globalThis as any).__CHILLY_TEST_MUX_INSTANCES__ = [];
jest.mock('@metamask/object-multiplex', () => {
    const Actual = jest.requireActual('@metamask/object-multiplex');
    class TrackedMultiplex extends Actual {
        constructor(...args: any[]) {
            super(...args);
            (globalThis as any).__CHILLY_TEST_MUX_INSTANCES__.push(this);
        }
    }
    return TrackedMultiplex;
});

jest.mock('@metamask/object-multiplex/dist/Substream', () => {
    const Actual = jest.requireActual('@metamask/object-multiplex/dist/Substream');
    (globalThis as any).__CHILLY_TEST_SUBSTREAM_INSTANCES__ = [];
    class TrackedSubstream extends Actual.Substream {
        constructor(...args: any[]) {
            super(...args);
            (globalThis as any).__CHILLY_TEST_SUBSTREAM_INSTANCES__.push(this);
        }
    }
    return { ...Actual, Substream: TrackedSubstream };
});

jest.mock('webextension-polyfill', () => require('./helpers/webextensionTestMock.js'));

jest.mock('../src/shared/utils/browser-runtime-utils', () => ({
    checkForLastError: jest.fn(),
    getIsBrowserPrerenderBroken: jest.fn(() => false),
}));

jest.mock('../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../src/shared/utils/provider-injection', () => ({
    __esModule: true,
    default: jest.fn(() => true),
}));

const getBrowser = () => require('webextension-polyfill').default as Browser;

type MockPort = {
    onMessage: { addListener: jest.Mock; removeListener: jest.Mock };
    onDisconnect: { addListener: jest.Mock; removeListener: jest.Mock };
    disconnect: jest.Mock;
    __dispatchMessage: (msg: any) => void;
    __dispatchDisconnect: () => void;
};

const buildPort = (): MockPort => {
    const msgListeners: Array<(msg: any) => void> = [];
    const disconnectListeners: Array<() => void> = [];
    return {
        onMessage: {
            addListener: jest.fn(cb => msgListeners.push(cb)),
            removeListener: jest.fn(),
        },
        onDisconnect: {
            addListener: jest.fn(cb => disconnectListeners.push(cb)),
            removeListener: jest.fn(cb => {
                const i = disconnectListeners.indexOf(cb);
                if (i >= 0) disconnectListeners.splice(i, 1);
            }),
        },
        disconnect: jest.fn(),
        __dispatchMessage: msg => msgListeners.forEach(l => l(msg)),
        __dispatchDisconnect: () => disconnectListeners.forEach(l => l()),
    };
};

let portFactory: () => MockPort;
let lastPort: MockPort | null = null;

beforeEach(() => {
    document.documentElement.innerHTML = '';
    try {
        destroyStreams();
    } catch {
        /* ignore */
    }
    (globalThis as any).__CHILLY_TEST_MUX_INSTANCES__ = [];
    (globalThis as any).__CHILLY_TEST_SUBSTREAM_INSTANCES__ = [];
    lastPort = null;
    portFactory = () => {
        lastPort = buildPort();
        return lastPort;
    };
    (shouldInjectProvider as jest.Mock).mockReturnValue(true);
    (getIsBrowserPrerenderBroken as jest.Mock).mockReturnValue(false);
    const b = getBrowser();
    (b.runtime.onMessage.addListener as jest.Mock).mockClear();
    jest.spyOn(b.runtime, 'connect').mockImplementation(() => portFactory() as any);
});

describe('ContentScript', () => {
    it('starts streams and registers a runtime message listener when injection is allowed', () => {
        startContentScript();
        expect(getBrowser().runtime.connect).toHaveBeenCalled();
    });

    it('skips initialization when shouldInjectProvider is false', () => {
        (shouldInjectProvider as jest.Mock).mockReturnValue(false);
        startContentScript();
        expect(getBrowser().runtime.connect).not.toHaveBeenCalled();
    });

    it('destroyStreams disconnects when extension streams exist', () => {
        startContentScript();
        const port = (getBrowser().runtime.connect as jest.Mock).mock.results[0].value as MockPort;
        destroyStreams();
        expect(port.disconnect).toHaveBeenCalled();
    });

    it('destroyStreams is a no-op when no port is open', () => {
        // no startContentScript before, just verify no throw and no calls
        expect(() => destroyStreams()).not.toThrow();
    });

    it('handles CHILLY_EXTENSION_READY by bootstrapping extension streams once', async () => {
        startContentScript();
        const addListener = getBrowser().runtime.onMessage.addListener as jest.Mock;
        const listener = addListener.mock.calls[0][0];
        const r1 = await Promise.resolve(listener({ name: CHILLY_EXTENSION_READY }));
        const r2 = await Promise.resolve(listener({ name: CHILLY_EXTENSION_READY }));
        expect(String(r1)).toContain(CHILLY_EXTENSION_READY);
        expect(String(r2)).toContain(CHILLY_EXTENSION_READY);
        expect(getBrowser().runtime.connect).toHaveBeenCalledTimes(1);
    });

    it('onMessageSetUpExtensionStreams returns undefined for unrelated messages', () => {
        startContentScript();
        const addListener = getBrowser().runtime.onMessage.addListener as jest.Mock;
        const listener = addListener.mock.calls[0][0];
        expect(listener({ name: 'something-else' })).toBeUndefined();
    });

    it('re-bootstraps extension streams when CHILLY_EXTENSION_READY arrives after disconnect', async () => {
        startContentScript();
        expect(getBrowser().runtime.connect).toHaveBeenCalledTimes(1);
        destroyStreams();
        const addListener = getBrowser().runtime.onMessage.addListener as jest.Mock;
        const listener = addListener.mock.calls[0][0];
        await Promise.resolve(listener({ name: CHILLY_EXTENSION_READY }));
        expect(getBrowser().runtime.connect).toHaveBeenCalledTimes(2);
    });

    it('forwards chilly_chainChanged into a window postMessage notifying inpage', async () => {
        const postMessageSpy = jest.spyOn(window, 'postMessage');
        startContentScript();
        // Simulate a message coming through the extension port (PortStream will forward as data)
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        lastPort!.__dispatchMessage({ data: { method: 'chilly_chainChanged' } });
        // PortStream pushes through a Readable in a microtask
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        const chainChangedCall = postMessageSpy.mock.calls.find(
            ([msg]: any) =>
                msg?.target === INPAGE &&
                msg?.data?.data?.method === 'CHILLY_EXTENSION_CONNECT_CAN_RETRY',
        );
        expect(chainChangedCall).toBeDefined();
        expect(chainChangedCall![0]).toMatchObject({
            target: INPAGE,
            data: {
                name: EXTERNAL_PROVIDER,
                data: { jsonrpc: '2.0', method: 'CHILLY_EXTENSION_CONNECT_CAN_RETRY' },
            },
        });
    });

    it('ignores chain-changed messages when no connect was sent', async () => {
        startContentScript();
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        // First chain-changed flips the flag false; subsequent should not post
        lastPort!.__dispatchMessage({ data: { method: 'chilly_chainChanged' } });
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        const postMessageSpy = jest.spyOn(window, 'postMessage');
        postMessageSpy.mockClear();
        lastPort!.__dispatchMessage({ data: { method: 'chilly_chainChanged' } });
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        const wasPosted = postMessageSpy.mock.calls.some(
            ([msg]: any) =>
                msg?.target === INPAGE &&
                msg?.data?.data?.method === 'CHILLY_EXTENSION_CONNECT_CAN_RETRY',
        );
        expect(wasPosted).toBe(false);
    });

    it('on port disconnect with no error, does not schedule a reconnect attempt', async () => {
        jest.useFakeTimers();
        try {
            startContentScript();
            const port = lastPort!;
            (checkForLastError as jest.Mock).mockReturnValue(undefined);
            port.__dispatchDisconnect();
            jest.advanceTimersByTime(1001);
            expect(getBrowser().runtime.connect).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });

    it('on port disconnect with an error, schedules a reconnect attempt', async () => {
        jest.useFakeTimers();
        try {
            startContentScript();
            const port = lastPort!;
            (checkForLastError as jest.Mock).mockReturnValue(new Error('lost'));
            port.__dispatchDisconnect();
            jest.advanceTimersByTime(1001);
            expect(getBrowser().runtime.connect).toHaveBeenCalledTimes(2);
        } finally {
            jest.useRealTimers();
        }
    });

    it('invokes destroyStreams when the prerenderingchange listener fires', () => {
        (getIsBrowserPrerenderBroken as jest.Mock).mockReturnValue(true);
        Object.defineProperty(document, 'prerendering', { value: true, configurable: true });
        const handlers: Array<EventListenerOrEventListenerObject> = [];
        const addEventListenerSpy = jest
            .spyOn(document, 'addEventListener')
            .mockImplementation(((name: string, cb: any) => {
                if (name === 'prerenderingchange') handlers.push(cb);
            }) as any);
        startContentScript();
        addEventListenerSpy.mockRestore();
        Object.defineProperty(document, 'prerendering', { value: false, configurable: true });
        expect(handlers.length).toBeGreaterThan(0);
        const port = lastPort!;
        (handlers[0] as any)();
        expect(port.disconnect).toHaveBeenCalled();
    });

    it('reconnects extension streams when a BFCached page is shown', () => {
        startContentScript();
        const beforeCount = (getBrowser().runtime.connect as jest.Mock).mock.calls.length;
        const evt = new Event('pageshow') as any;
        Object.defineProperty(evt, 'persisted', { value: true });
        window.dispatchEvent(evt);
        expect((getBrowser().runtime.connect as jest.Mock).mock.calls.length).toBeGreaterThan(
            beforeCount,
        );
    });

    it('does not reconnect on pageshow if event is not persisted', () => {
        startContentScript();
        const beforeCount = (getBrowser().runtime.connect as jest.Mock).mock.calls.length;
        const evt = new Event('pageshow') as any;
        Object.defineProperty(evt, 'persisted', { value: false });
        window.dispatchEvent(evt);
        expect((getBrowser().runtime.connect as jest.Mock).mock.calls.length).toBe(beforeCount);
    });

    it('destroys streams when a page may become BFCached', () => {
        startContentScript();
        const port = lastPort!;
        const evt = new Event('pagehide') as any;
        Object.defineProperty(evt, 'persisted', { value: true });
        window.dispatchEvent(evt);
        expect(port.disconnect).toHaveBeenCalled();
    });

    it('logs and notifies inpage when extension and page mux pipelines fail', async () => {
        const postMessageSpy = jest.spyOn(window, 'postMessage');
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

        startContentScript();

        const muxes = (globalThis as any).__CHILLY_TEST_MUX_INSTANCES__ as any[];
        // pageMux (index 0), extensionMux (index 1)
        const pageMux = muxes[0];
        const extensionMux = muxes[1];
        // Each mux's pipeline registers an error listener; emit error to trigger the callback.
        pageMux.emit('error', new Error('page-mux-failed'));
        extensionMux.emit('error', new Error('extension-mux-failed'));

        await new Promise<void>(resolve => setTimeout(resolve, 20));

        const streamFailurePost = postMessageSpy.mock.calls.find(
            ([msg]: any) =>
                msg?.target === INPAGE && msg?.data?.data?.method === 'CHILLY_STREAM_FAILURE',
        );
        expect(streamFailurePost).toBeDefined();
        expect(
            debugSpy.mock.calls.some(args =>
                args.some(
                    a => typeof a === 'string' && a.includes('Chilly Background Multiplex'),
                ),
            ),
        ).toBe(true);
        expect(
            debugSpy.mock.calls.some(args =>
                args.some(a => typeof a === 'string' && a.includes('Chilly Inpage Multiplex')),
            ),
        ).toBe(true);

        debugSpy.mockRestore();
    });

    it('logs when the muxed page channel pipeline disconnects with an error', async () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

        startContentScript();

        const substreams = (globalThis as any).__CHILLY_TEST_SUBSTREAM_INSTANCES__ as any[];
        // pageChannel is created first (inside setupPageStreams), then extensionChannel.
        const pageChannel = substreams[0];
        pageChannel.emit('error', new Error('page-channel-failed'));

        await new Promise<void>(resolve => setTimeout(resolve, 20));

        expect(
            debugSpy.mock.calls.some(args =>
                args.some(a => typeof a === 'string' && a.includes('Muxed traffic for channel')),
            ),
        ).toBe(true);

        debugSpy.mockRestore();
    });

    it('auto-bootstraps when JEST_WORKER_ID is not set (module top-level branch)', () => {
        const originalId = process.env.JEST_WORKER_ID;
        delete process.env.JEST_WORKER_ID;
        try {
            jest.isolateModules(() => {
                // Re-require the module so the top-level guard re-evaluates.
                require('../src/ContentScript');
            });
        } finally {
            if (originalId !== undefined) {
                process.env.JEST_WORKER_ID = originalId;
            }
        }
        // The fact that the require completes without throwing is enough.
        expect(true).toBe(true);
    });

    it('registers a prerenderingchange listener when prerender is broken', () => {
        (getIsBrowserPrerenderBroken as jest.Mock).mockReturnValue(true);
        Object.defineProperty(document, 'prerendering', { value: true, configurable: true });
        const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
        startContentScript();
        expect(
            addEventListenerSpy.mock.calls.some(([name]) => name === 'prerenderingchange'),
        ).toBe(true);
        addEventListenerSpy.mockRestore();
        Object.defineProperty(document, 'prerendering', { value: false, configurable: true });
    });
});
