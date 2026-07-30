import browser from 'webextension-polyfill';

import { HARDWARE_OFFSCREEN_MESSAGE } from './hardwareOffscreenMessaging';

const OFFSCREEN_PATH = 'offscreen.html';

/** `browser.offscreen` is Chrome MV3-specific; polyfill types may omit it. */
type BrowserWithOffscreen = typeof browser & {
    offscreen?: {
        createDocument: (options: {
            url: string;
            reasons: readonly string[];
            justification: string;
        }) => Promise<void>;
        closeDocument: () => Promise<void>;
    };
};

const ext = browser as BrowserWithOffscreen;

async function closeOffscreenDocumentIfOpen(): Promise<void> {
    if (!ext.offscreen?.closeDocument) {
        return;
    }
    try {
        await ext.offscreen.closeDocument();
    } catch {
        /* No matching offscreen document, or API not applicable. */
    }
}

async function ensureOffscreenDocument(): Promise<void> {
    if (!ext.offscreen?.createDocument) {
        throw new Error('Hardware wallets require Chrome MV3 offscreen API support.');
    }

    try {
        await ext.offscreen.createDocument({
            url: browser.runtime.getURL(OFFSCREEN_PATH),
            reasons: ['IFRAME_SCRIPTING'],
            justification:
                'Hardware wallets (Ledger, etc.) use an offscreen document for iframe bridges and device access.',
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/already exists/i.test(message) && !/Duplicate/i.test(message)) {
            throw error;
        }
    }
}

/** True after offscreen posts {@link HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension}. Reset when document is torn down. */
let offscreenBootAcknowledged = false;

let ensureReadyPromise: Promise<void> | null = null;

function resetOffscreenBootHandshake(): void {
    offscreenBootAcknowledged = false;
}

/** Service worker listens for MetaMask-style offscreen boot (see metamask-extension `isBooted`). */
browser.runtime.onMessage.addListener((message: unknown) => {
    const m = message as { target?: string; offscreenBooted?: boolean };

    if (m.target !== HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension || !m.offscreenBooted) {
        return undefined;
    }

    offscreenBootAcknowledged = true;

    return undefined;
});

async function waitForOffscreenBoot(timeoutMs = 12000): Promise<void> {
    const start = Date.now();
    while (!offscreenBootAcknowledged) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(
                'Hardware wallet offscreen bridge did not connect. Reload the extension and try again.',
            );
        }
        await new Promise<void>(resolve => {
            globalThis.setTimeout(resolve, 40);
        });
    }
}

/** Shared by Ledger and Trezor offscreen keyrings — bootstraps the single offscreen document. */
export async function ensureHardwareOffscreenReady(): Promise<void> {
    if (offscreenBootAcknowledged) {
        return;
    }

    ensureReadyPromise ||= (async () => {
        resetOffscreenBootHandshake();
        await closeOffscreenDocumentIfOpen();
        await ensureOffscreenDocument();
        await waitForOffscreenBoot();
    })();

    try {
        await ensureReadyPromise;
    } catch (e) {
        ensureReadyPromise = null;
        throw e instanceof Error ? e : new Error(String(e));
    }

    if (!offscreenBootAcknowledged) {
        throw new Error('Offscreen document did not acknowledge boot.');
    }
}
