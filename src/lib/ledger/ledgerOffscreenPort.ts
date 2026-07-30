import browser from 'webextension-polyfill';

import logger from '../../shared/utils/logger';

import { HARDWARE_OFFSCREEN_MESSAGE } from '../offscreen/hardwareOffscreenMessaging';
import { ensureHardwareOffscreenReady } from '../offscreen/hardwareOffscreenPort';
import {
    LEDGER_ERR_OFFSCREEN_GENERIC,
    LEDGER_ERR_OFFSCREEN_INVALID_RESPONSE,
    ledgerOffscreenRpcTimeoutMessage,
} from './ledgerErrorMessages';

export type LedgerOffscreenRequest = {
    target: typeof HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget;
    ledgerRequestId: string;
    instanceId: string;
    method: string;
    payload?: unknown;
};

export type LedgerOffscreenResponseOk = {
    ledgerRequestId: string;
    ok: true;
    result?: unknown;
};

export type LedgerOffscreenResponseErr = {
    ledgerRequestId: string;
    ok: false;
    error: string;
};

/** Allow time for device prompts during paging and signing. */
const LEDGER_OFFSCREEN_RPC_TIMEOUT_MS = 120_000;

function sendLedgerOffscreenMessage(
    message: LedgerOffscreenRequest,
    timeoutMs = LEDGER_OFFSCREEN_RPC_TIMEOUT_MS,
): Promise<LedgerOffscreenResponseOk | LedgerOffscreenResponseErr | undefined | null> {
    return new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
            reject(new Error(ledgerOffscreenRpcTimeoutMessage(timeoutMs)));
        }, timeoutMs);

        browser.runtime
            .sendMessage(message)
            .then(raw => {
                globalThis.clearTimeout(timer);
                resolve(
                    raw as LedgerOffscreenResponseOk | LedgerOffscreenResponseErr | undefined | null,
                );
            })
            .catch(error => {
                globalThis.clearTimeout(timer);
                reject(error);
            });
    });
}

/** RPC from service worker → offscreen Ledger bridge (serialized state in/out). */
export async function ledgerOffscreenRpc<T>(
    instanceId: string,
    method: string,
    payload?: unknown,
): Promise<T> {
    logger.log('⚙️ Ledger request', method, payload);
    await ensureHardwareOffscreenReady();

    const ledgerRequestId = crypto.randomUUID();

    const raw = await sendLedgerOffscreenMessage({
        target: HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget,
        ledgerRequestId,
        instanceId,
        method,
        payload,
    });

    logger.log('⚙️ Ledger response', raw);

    if (!raw || raw.ledgerRequestId !== ledgerRequestId) {
        throw new Error(LEDGER_ERR_OFFSCREEN_INVALID_RESPONSE);
    }

    if (raw.ok) {
        return raw.result as T;
    }

    throw new Error(raw.error || LEDGER_ERR_OFFSCREEN_GENERIC);
}
