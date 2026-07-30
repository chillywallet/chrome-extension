/**
 * Chrome MV3 offscreen document entry. Ledger and Trezor bridges run here (shared boot).
 */
import browser from 'webextension-polyfill';

import { HARDWARE_OFFSCREEN_MESSAGE } from './lib/offscreen/hardwareOffscreenMessaging';
import { handleOffscreenLedgerRuntimeMessage } from './lib/offscreen/offscreenLedgerMessageHandler';
import { handleOffscreenTrezorRuntimeMessage } from './lib/offscreen/offscreenTrezorMessageHandler';

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (handleOffscreenLedgerRuntimeMessage(message, sender, sendResponse)) {
        return true;
    }
    if (handleOffscreenTrezorRuntimeMessage(message, sender, sendResponse)) {
        return true;
    }
    return undefined;
});

queueMicrotask(() => {
    void browser.runtime
        .sendMessage({
            target: HARDWARE_OFFSCREEN_MESSAGE.bootTargetExtension,
            offscreenBooted: true as const,
        })
        .catch(() => {});
});
