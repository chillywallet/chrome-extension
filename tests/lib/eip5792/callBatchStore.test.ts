import {
    getCallBatchStatus,
    setCallBatchStatus,
    hasCallBatch,
} from '../../../src/lib/eip5792/callBatchStore';
import { CallBatchStatusCode } from '../../../src/lib/eip5792/types';

const mockStorage = new Map<string, any>();

jest.mock('webextension-polyfill', () => {
    return {
        __esModule: true,
        default: {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn(),
                    clear: jest.fn(),
                },
            },
        },
    };
});

describe('callBatchStore', () => {
    let browser: any;

    beforeEach(() => {
        // CRA/react-scripts has resetMocks: true, which clears any impls set at
        // mock-factory time. We re-install the working implementations here.
        browser = require('webextension-polyfill').default;
        mockStorage.clear();
        browser.storage.local.get.mockImplementation(async (key: string) => {
            const result: Record<string, any> = {};
            if (mockStorage.has(key)) result[key] = mockStorage.get(key);
            return result;
        });
        browser.storage.local.set.mockImplementation(async (data: Record<string, any>) => {
            Object.entries(data).forEach(([k, v]) => mockStorage.set(k, v));
        });
        browser.storage.local.clear.mockImplementation(() => mockStorage.clear());
    });

    const status: any = {
        version: '1',
        chainId: '0x1',
        id: 'abc',
        status: CallBatchStatusCode.Pending,
        atomic: true,
    };

    it('returns undefined for unknown id', async () => {
        await expect(getCallBatchStatus('missing-id')).resolves.toBeUndefined();
    });

    it('persists and reads a status', async () => {
        await setCallBatchStatus('id-1', status);
        await expect(getCallBatchStatus('id-1')).resolves.toEqual(status);
    });

    it('hasCallBatch returns true after set', async () => {
        await setCallBatchStatus('id-2', status);
        await expect(hasCallBatch('id-2')).resolves.toBe(true);
    });

    it('reads from storage when memory cache is missing and storage has the entry', async () => {
        // Seed storage directly (bypassing setCallBatchStatus so memory cache stays empty)
        mockStorage.set('eip5792_batch:id-3', status);
        await expect(getCallBatchStatus('id-3')).resolves.toEqual(status);
        // Second call hits cache
        await expect(getCallBatchStatus('id-3')).resolves.toEqual(status);
    });

    it('returns undefined when storage.get throws', async () => {
        browser.storage.local.get.mockImplementation(async () => {
            throw new Error('boom');
        });
        await expect(getCallBatchStatus('id-throws')).resolves.toBeUndefined();
    });

    it('setCallBatchStatus swallows storage.set errors', async () => {
        browser.storage.local.set.mockImplementation(async () => {
            throw new Error('boom-set');
        });
        await expect(setCallBatchStatus('id-set-err', status)).resolves.toBeUndefined();
        // Even though persistence failed, memory cache should hold it
        await expect(getCallBatchStatus('id-set-err')).resolves.toEqual(status);
    });

    it('hasCallBatch checks storage when not in memory and returns true if present', async () => {
        mockStorage.set('eip5792_batch:id-has', status);
        await expect(hasCallBatch('id-has')).resolves.toBe(true);
    });

    it('hasCallBatch returns false when not in memory and not in storage', async () => {
        await expect(hasCallBatch('id-absent')).resolves.toBe(false);
    });

    it('hasCallBatch returns false when storage.get throws', async () => {
        browser.storage.local.get.mockImplementation(async () => {
            throw new Error('boom');
        });
        await expect(hasCallBatch('id-throws')).resolves.toBe(false);
    });
});
