(globalThis as any).__hardwareOffscreenMockState = {
    offscreen: undefined,
    listeners: [] as Function[],
};

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        runtime: {
            getURL: (path: string) => `chrome-extension://x/${path}`,
            onMessage: {
                addListener: (fn: Function) => {
                    (globalThis as any).__hardwareOffscreenMockState.listeners.push(fn);
                },
            },
        },
        get offscreen() {
            return (globalThis as any).__hardwareOffscreenMockState.offscreen;
        },
    },
}));

const state: { offscreen: any; listeners: Function[] } = (globalThis as any)
    .__hardwareOffscreenMockState;

function loadFresh() {
    jest.resetModules();
    state.listeners.length = 0;
    return require('../../../src/lib/offscreen/hardwareOffscreenPort');
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(() => {
    state.offscreen = undefined;
    state.listeners.length = 0;
});

describe('ensureHardwareOffscreenReady', () => {
    it('throws when browser.offscreen API is unavailable', async () => {
        state.offscreen = undefined;
        const { ensureHardwareOffscreenReady } = loadFresh();
        await expect(ensureHardwareOffscreenReady()).rejects.toThrow(/Chrome MV3 offscreen API/);
    });

    it('creates offscreen document and resolves once boot listener is triggered', async () => {
        const createDocument = jest.fn().mockResolvedValue(undefined);
        const closeDocument = jest.fn().mockResolvedValue(undefined);
        state.offscreen = { createDocument, closeDocument };
        const { ensureHardwareOffscreenReady } = loadFresh();
        const {
            HARDWARE_OFFSCREEN_MESSAGE,
        } = require('../../../src/lib/offscreen/hardwareOffscreenMessaging');

        const pending = ensureHardwareOffscreenReady();
        await flushMicrotasks();
        for (const fn of state.listeners) {
            fn({
                target: HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension,
                offscreenBooted: true,
            });
        }
        await expect(pending).resolves.toBeUndefined();
        expect(createDocument).toHaveBeenCalled();
        expect(closeDocument).toHaveBeenCalled();
    });

    it('ignores messages that do not match the boot target', async () => {
        const createDocument = jest.fn().mockResolvedValue(undefined);
        const closeDocument = jest.fn().mockResolvedValue(undefined);
        state.offscreen = { createDocument, closeDocument };
        const { ensureHardwareOffscreenReady } = loadFresh();
        const {
            HARDWARE_OFFSCREEN_MESSAGE,
        } = require('../../../src/lib/offscreen/hardwareOffscreenMessaging');

        const pending = ensureHardwareOffscreenReady();
        await flushMicrotasks();
        for (const fn of state.listeners) {
            fn({ target: 'something-else', offscreenBooted: true });
        }
        for (const fn of state.listeners) {
            fn({
                target: HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension,
                offscreenBooted: true,
            });
        }
        await expect(pending).resolves.toBeUndefined();
    });

    it('swallows already-exists createDocument errors', async () => {
        const createDocument = jest
            .fn()
            .mockRejectedValueOnce(new Error('Only a single offscreen document already exists'));
        const closeDocument = jest.fn().mockResolvedValue(undefined);
        state.offscreen = { createDocument, closeDocument };
        const { ensureHardwareOffscreenReady } = loadFresh();
        const {
            HARDWARE_OFFSCREEN_MESSAGE,
        } = require('../../../src/lib/offscreen/hardwareOffscreenMessaging');

        const pending = ensureHardwareOffscreenReady();
        await flushMicrotasks();
        for (const fn of state.listeners) {
            fn({
                target: HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension,
                offscreenBooted: true,
            });
        }
        await expect(pending).resolves.toBeUndefined();
    });

    it('propagates unrelated createDocument errors', async () => {
        const createDocument = jest.fn().mockRejectedValueOnce(new Error('boom'));
        const closeDocument = jest.fn().mockResolvedValue(undefined);
        state.offscreen = { createDocument, closeDocument };
        const { ensureHardwareOffscreenReady } = loadFresh();
        await expect(ensureHardwareOffscreenReady()).rejects.toThrow('boom');
    });

    it('swallows closeDocument errors and proceeds to create', async () => {
        const createDocument = jest.fn().mockResolvedValue(undefined);
        const closeDocument = jest.fn().mockRejectedValueOnce(new Error('no doc'));
        state.offscreen = { createDocument, closeDocument };
        const { ensureHardwareOffscreenReady } = loadFresh();
        const {
            HARDWARE_OFFSCREEN_MESSAGE,
        } = require('../../../src/lib/offscreen/hardwareOffscreenMessaging');

        const pending = ensureHardwareOffscreenReady();
        await flushMicrotasks();
        for (const fn of state.listeners) {
            fn({
                target: HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension,
                offscreenBooted: true,
            });
        }
        await expect(pending).resolves.toBeUndefined();
    });

    it('handles non-Error close rejections by stringifying them', async () => {
        const createDocument = jest.fn().mockResolvedValue(undefined);
        // eslint-disable-next-line prefer-promise-reject-errors
        const closeDocument = jest.fn().mockRejectedValueOnce('plain-string');
        state.offscreen = { createDocument, closeDocument };
        const { ensureHardwareOffscreenReady } = loadFresh();
        const {
            HARDWARE_OFFSCREEN_MESSAGE,
        } = require('../../../src/lib/offscreen/hardwareOffscreenMessaging');

        const pending = ensureHardwareOffscreenReady();
        await flushMicrotasks();
        for (const fn of state.listeners) {
            fn({
                target: HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension,
                offscreenBooted: true,
            });
        }
        await expect(pending).resolves.toBeUndefined();
    });

    it('wraps non-Error createDocument rejections via new Error(String(e))', async () => {
        // eslint-disable-next-line prefer-promise-reject-errors
        const createDocument = jest.fn().mockRejectedValueOnce('catastrophic-string');
        const closeDocument = jest.fn().mockResolvedValue(undefined);
        state.offscreen = { createDocument, closeDocument };
        const { ensureHardwareOffscreenReady } = loadFresh();
        await expect(ensureHardwareOffscreenReady()).rejects.toThrow('catastrophic-string');
    });
});
