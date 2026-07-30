import browser from 'webextension-polyfill';
import { CallBatchStatus } from './types';

const STORAGE_KEY_PREFIX = 'eip5792_batch:';
const memoryCache = new Map<string, CallBatchStatus>();

function storageKey(id: string): string {
    return `${STORAGE_KEY_PREFIX}${id}`;
}

export async function getCallBatchStatus(id: string): Promise<CallBatchStatus | undefined> {
    const cached = memoryCache.get(id);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const key = storageKey(id);
        const raw = await browser.storage.local.get(key);
        const data = raw[key] as CallBatchStatus | undefined;
        if (!data) {
            return undefined;
        }
        memoryCache.set(id, data);
        return data;
    } catch {
        return undefined;
    }
}

export async function setCallBatchStatus(id: string, status: CallBatchStatus): Promise<void> {
    memoryCache.set(id, status);
    try {
        await browser.storage.local.set({
            [storageKey(id)]: status,
        });
    } catch {
        // best-effort persistence
    }
}

export async function hasCallBatch(id: string): Promise<boolean> {
    if (memoryCache.has(id)) {
        return true;
    }

    try {
        const key = storageKey(id);
        const raw = await browser.storage.local.get(key);
        return Boolean(raw[key]);
    } catch {
        return false;
    }
}
