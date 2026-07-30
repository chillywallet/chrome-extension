/**
 * Trezor offscreen keyring RPC (handled via `chrome.runtime.onMessage` registered in `src/offscreen.ts`).
 */
import { SignTypedDataVersion } from '@metamask/eth-sig-util';
import { TrezorConnectBridge, TrezorKeyring } from '@metamask/eth-trezor-keyring';
import TrezorConnect from '@trezor/connect-web';

import logger from '../../shared/utils/logger';

import { HARDWARE_OFFSCREEN_MESSAGE } from './hardwareOffscreenMessaging';
import {
    typedTransactionFromHardwareWirePayload,
    typedTransactionToWireRecord,
    type HardwareTxWirePayload,
} from './hardwareTxWire';

type TrezorIncoming = {
    trezorRequestId: string;
    instanceId: string;
    method: string;
    payload?: Record<string, unknown>;
};

type TrezorSendResponsePayload =
    | { trezorRequestId: string; ok: true; result?: unknown }
    | { trezorRequestId: string; ok: false; error: string };

type TrezorKeyringInstance = InstanceType<typeof TrezorKeyring>;

type TrezorSession = { instanceId: string; keyring: TrezorKeyringInstance };

let trezorSession: TrezorSession | null = null;

/** Clears @trezor/connect-web singleton state (iframe / popup). Required when the MetaMask bridge is recreated: new TrezorConnectBridge() has trezorConnectInitiated false but Connect can still think it is initialized. */
async function disposeTrezorConnectSingleton(): Promise<void> {
    try {
        await TrezorConnect.dispose();
    } catch {
        // ignore
    }
}

async function disposeTrezorSession(): Promise<void> {
    if (trezorSession) {
        try {
            await trezorSession.keyring.destroy();
        } catch {
            // ignore
        }
        trezorSession = null;
    }

    await disposeTrezorConnectSingleton();
}

async function ensureTrezorSession(
    instanceId: string,
    serialized: unknown,
): Promise<TrezorKeyringInstance> {
    if (trezorSession?.instanceId !== instanceId) {
        await disposeTrezorSession();
        const bridge = new TrezorConnectBridge();
        await bridge.init({
            manifest: {
                appName: 'Chilly Wallet',
                // Placeholder identity until a real Chilly Wallet domain exists;
                // Trezor Connect only uses this for display/telemetry.
                appUrl: 'https://chillywallet.io/',
                email: 'support@chillywallet.io',
            },
            lazyLoad: true,
        });

        if (!bridge.trezorConnectInitiated) {
            throw new Error('Trezor Connect did not initialize');
        }

        const keyring = new TrezorKeyring({ bridge });
        trezorSession = { instanceId, keyring };
        logger.log('⚙️ New Trezor bridge created', instanceId);
    }

    const kr = trezorSession.keyring;

    await kr.deserialize((serialized && typeof serialized === 'object' ? serialized : {}) as never);

    return kr;
}

function trezorRespond(
    sendResponse: (payload: TrezorSendResponsePayload) => void,
    trezorRequestId: string,
    body:
        | (Omit<Extract<TrezorSendResponsePayload, { ok: true }>, 'trezorRequestId'> & {
              trezorRequestId?: string;
          })
        | Omit<Extract<TrezorSendResponsePayload, { ok: false }>, 'trezorRequestId'>,
): void {
    sendResponse({ trezorRequestId, ...body } as TrezorSendResponsePayload);
}

/** @returns `true` if this message is a Trezor RPC (async `sendResponse` will follow). */
export function handleOffscreenTrezorRuntimeMessage(
    message: unknown,
    _sender: unknown,
    sendResponse: (response?: unknown) => void,
): boolean {
    const envelope = message as TrezorIncoming & { target?: string };

    if (
        envelope.target !== HARDWARE_OFFSCREEN_MESSAGE.rpcTrezorTarget ||
        typeof envelope.trezorRequestId !== 'string' ||
        typeof envelope.method !== 'string' ||
        typeof envelope.instanceId !== 'string'
    ) {
        return false;
    }

    const { trezorRequestId, instanceId, method, payload } = envelope;

    void (async () => {
        const reply = sendResponse as (payload: TrezorSendResponsePayload) => void;
        try {
            switch (method) {
                case 'dispose':
                    await disposeTrezorSession();
                    trezorRespond(reply, trezorRequestId, { ok: true });
                    break;
                case 'addAccounts': {
                    const kr = await ensureTrezorSession(instanceId, payload?.serialized);
                    const n = typeof payload?.n === 'number' ? payload.n : 1;
                    const before = await kr.getAccounts();
                    const beforeSet = new Set(before.map(a => a.toLowerCase()));
                    const after = await kr.addAccounts(n);
                    const newAddresses = after.filter(a => !beforeSet.has(a.toLowerCase()));

                    trezorRespond(reply, trezorRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            newAddresses,
                        },
                    });

                    break;
                }
                case 'signTransaction': {
                    const kr = await ensureTrezorSession(instanceId, payload?.serialized);

                    const address = payload?.address as string;
                    const wire = payload?.wire as HardwareTxWirePayload;
                    const tx = typedTransactionFromHardwareWirePayload(wire);
                    const signed = await kr.signTransaction(address, tx);

                    trezorRespond(reply, trezorRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            signedTx: typedTransactionToWireRecord(signed),
                        },
                    });

                    break;
                }
                case 'signPersonalMessage': {
                    const kr = await ensureTrezorSession(instanceId, payload?.serialized);
                    const signature = (await kr.signPersonalMessage(
                        payload?.address as string,
                        payload?.message as string,
                    )) as string;

                    trezorRespond(reply, trezorRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            signature,
                        },
                    });

                    break;
                }
                case 'signTypedData': {
                    const kr = await ensureTrezorSession(instanceId, payload?.serialized);

                    const versionStr = typeof payload?.version === 'string' ? payload.version : '';

                    if (versionStr !== 'V4') {
                        throw new Error('Trezor: Only EIP-712 V4 typed data signing is supported');
                    }

                    const signature = await kr.signTypedData(
                        payload?.address as string,
                        payload?.data as never,
                        { version: SignTypedDataVersion.V4 },
                    );

                    trezorRespond(reply, trezorRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            signature,
                        },
                    });

                    break;
                }
                case 'getAddressPage': {
                    const kr = await ensureTrezorSession(instanceId, payload?.serialized);
                    const direction = payload?.direction as string;
                    let rows: Awaited<ReturnType<typeof kr.getFirstPage>>;
                    if (direction === 'first') {
                        rows = await kr.getFirstPage();
                    } else if (direction === 'next') {
                        rows = await kr.getNextPage();
                    } else if (direction === 'prev') {
                        rows = await kr.getPreviousPage();
                    } else {
                        throw new Error('Invalid address page direction.');
                    }

                    trezorRespond(reply, trezorRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            accounts: rows,
                        },
                    });

                    break;
                }
                case 'importAccountsAtIndices': {
                    const kr = await ensureTrezorSession(instanceId, payload?.serialized);
                    const indices = Array.isArray(payload?.indices)
                        ? (payload.indices as number[])
                        : [];
                    const added: string[] = [];
                    for (const idx of [...new Set(indices)].sort((a, b) => a - b)) {
                        const before = await kr.getAccounts();
                        const beforeSet = new Set(before.map(a => a.toLowerCase()));
                        kr.setAccountToUnlock(idx);
                        const after = await kr.addAccounts(1);
                        added.push(...after.filter(a => !beforeSet.has(a.toLowerCase())));
                    }

                    trezorRespond(reply, trezorRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            newAddresses: added,
                        },
                    });

                    break;
                }

                default:
                    trezorRespond(reply, trezorRequestId, {
                        ok: false,
                        error: `Unknown Trezor op: ${method}`,
                    });
            }
        } catch (error) {
            const messageText =
                error instanceof Error ? error.message.trim() || error.toString() : String(error);

            trezorRespond(reply, trezorRequestId, {
                ok: false,
                error: messageText === 'Unknown error' ? 'You rejected the request.' : messageText,
            });
        }
    })();

    return true;
}
