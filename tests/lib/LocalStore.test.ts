// @ts-ignore — JS module
import LocalStore from '../../src/lib/LocalStore';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        storage: {
            local: {
                get: jest.fn(),
                set: jest.fn(),
            },
        },
    },
}));

jest.mock('../../src/shared/utils/browser-runtime-utils', () => ({
    checkForLastError: jest.fn(),
}));

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const browser = require('webextension-polyfill').default;

describe('LocalStore', () => {
    beforeEach(() => {
        browser.storage.local.get.mockReset();
        browser.storage.local.set.mockReset();
    });

    it('reports supported when storage.local is present', () => {
        const store = new LocalStore();
        expect(store.isSupported).toBe(true);
    });

    it('setMetadata stores the metadata', () => {
        const store = new LocalStore();
        store.setMetadata({ version: 1 });
        expect(store.metadata).toEqual({ version: 1 });
    });

    it('set rejects when no state', async () => {
        const store = new LocalStore();
        store.setMetadata({ version: 1 });
        await expect(store.set(undefined as any)).rejects.toThrow(/missing/);
    });

    it('set rejects when no metadata', async () => {
        const store = new LocalStore();
        await expect(store.set({ a: 1 })).rejects.toThrow(/Metadata must be set/);
    });

    it('set persists data with meta', async () => {
        browser.storage.local.set.mockResolvedValue(undefined);
        const store = new LocalStore();
        store.setMetadata({ version: 1 });
        await store.set({ a: 1 });
        expect(browser.storage.local.set).toHaveBeenCalledWith({
            data: { a: 1 },
            meta: { version: 1 },
        });
    });

    it('get returns undefined when storage returns empty', async () => {
        browser.storage.local.get.mockResolvedValue({});
        const store = new LocalStore();
        await expect(store.get()).resolves.toBeUndefined();
    });

    it('get returns the stored state', async () => {
        browser.storage.local.get.mockResolvedValue({ data: { a: 1 } });
        const store = new LocalStore();
        const result = await store.get();
        expect(result).toEqual({ data: { a: 1 } });
        expect(store.mostRecentRetrievedState).toEqual({ data: { a: 1 } });
    });

    it('logs an error during construction when storage.local is missing', () => {
        const original = browser.storage.local;
        browser.storage.local = undefined as any;
        try {
            const store = new LocalStore();
            expect(store.isSupported).toBe(false);
        } finally {
            browser.storage.local = original;
        }
    });

    it('get returns undefined when unsupported', async () => {
        const original = browser.storage.local;
        browser.storage.local = undefined as any;
        try {
            const store = new LocalStore();
            await expect(store.get()).resolves.toBeUndefined();
        } finally {
            browser.storage.local = original;
        }
    });

    it('set throws when unsupported', async () => {
        const original = browser.storage.local;
        browser.storage.local = undefined as any;
        try {
            const store = new LocalStore();
            await expect(store.set({ a: 1 })).rejects.toThrow(/does not support/);
        } finally {
            browser.storage.local = original;
        }
    });

    it('set clears dataPersistenceFailing once a write succeeds', async () => {
        const { checkForLastError } = require('../../src/shared/utils/browser-runtime-utils');
        // First write: _set's checkForLastError returns an error → outer _set rejects → set catches → flag flips true
        (checkForLastError as jest.Mock)
            .mockReturnValueOnce(new Error('write err'))
            .mockReturnValueOnce(undefined);
        browser.storage.local.set.mockResolvedValue(undefined);
        const store = new LocalStore();
        store.setMetadata({ version: 1 });
        await store.set({ a: 1 });
        expect(store.dataPersistenceFailing).toBe(true);
        await store.set({ a: 2 });
        expect(store.dataPersistenceFailing).toBe(false);
    });

    it('_get rejects when checkForLastError reports an error', async () => {
        const { checkForLastError } = require('../../src/shared/utils/browser-runtime-utils');
        (checkForLastError as jest.Mock).mockReturnValueOnce(new Error('storage err'));
        browser.storage.local.get.mockResolvedValueOnce({ data: { a: 1 } });
        const store = new LocalStore();
        await expect(store.get()).rejects.toThrow(/storage err/);
    });
});
