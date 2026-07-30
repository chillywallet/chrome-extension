import browser from 'webextension-polyfill';

import logger from '../../shared/utils/logger';
import { HARDWARE_OFFSCREEN_MESSAGE } from '../offscreen/hardwareOffscreenMessaging';

import { ensureHardwareOffscreenReady } from '../offscreen/hardwareOffscreenPort';

export type TrezorOffscreenResponseOk = {
    trezorRequestId: string;
    ok: true;
    result?: unknown;
};

export type TrezorOffscreenResponseErr = {
    trezorRequestId: string;
    ok: false;
    error: string;
};

type TrezorOffscreenRpcMessage = {
    target: typeof HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget;
    trezorRequestId: string;
    instanceId: string;
    method: string;
    payload?: unknown;
};

/** Allow time for Trezor Suite / device prompts during paging and signing. */
const TREZOR_OFFSCREEN_RPC_TIMEOUT_MS = 120_000;

function sendTrezorOffscreenMessage(
    message: TrezorOffscreenRpcMessage,
    timeoutMs = TREZOR_OFFSCREEN_RPC_TIMEOUT_MS,
): Promise<TrezorOffscreenResponseOk | TrezorOffscreenResponseErr | undefined | null> {
    return new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
            reject(
                new Error(
                    `Trezor request timed out after ${Math.round(timeoutMs / 1000)}s. Open Trezor Suite, unlock your device, and try again.`,
                ),
            );
        }, timeoutMs);

        browser.runtime
            .sendMessage(message)
            .then(raw => {
                globalThis.clearTimeout(timer);
                resolve(
                    raw as TrezorOffscreenResponseOk | TrezorOffscreenResponseErr | undefined | null,
                );
            })
            .catch(error => {
                globalThis.clearTimeout(timer);
                reject(error);
            });
    });
}

/** RPC from service worker → offscreen Trezor bridge (serialized state in/out). */
export async function trezorOffscreenRpc<T>(
    instanceId: string,
    method: string,
    payload?: unknown,
): Promise<T> {
    logger.log('⚙️ Trezor request', method, payload);
    await ensureHardwareOffscreenReady();

    const trezorRequestId = crypto.randomUUID();

    const raw = await sendTrezorOffscreenMessage({
        target: HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget,
        trezorRequestId,
        instanceId,
        method,
        payload,
    });

    logger.log('⚙️ Trezor response', raw);

    if (!raw || raw.trezorRequestId !== trezorRequestId) {
        throw new Error('Trezor offscreen returned an invalid response.');
    }

    if (raw.ok) {
        return raw.result as T;
    }

    throw new Error(raw.error || 'Trezor offscreen error');
}
