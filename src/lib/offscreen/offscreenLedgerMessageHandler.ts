/**
 * Ledger offscreen stack: USB disconnect → session lifecycle (`LedgerKeyring` + WebHID) +
 * RPC envelope handling (listener registered from `src/offscreen.ts`).
 */
import { LedgerKeyring } from '@metamask/eth-ledger-bridge-keyring';

import logger from '../../shared/utils/logger';
import {
    LEDGER_ERR_EIP712_V4_ONLY,
    LEDGER_ERR_INVALID_ADDRESS_PAGE_DIRECTION,
    ledgerUnknownOpMessage,
} from '../ledger/ledgerErrorMessages';
import { normalizeLedgerDeviceErrorMessage } from '../ledger/ledgerNormalizeDeviceError';
import { LEDGER_USB_VENDOR_ID } from '../ledger/ledgerUsbConstants';
import { LedgerWebHidBridge } from '../ledger/LedgerWebHidBridge';
import { isLedgerTransportStuckError } from '../ledger/ledgerTransportRecovery';

import { HARDWARE_OFFSCREEN_MESSAGE } from './hardwareOffscreenMessaging';
import {
    typedTransactionFromHardwareWirePayload,
    typedTransactionToWireRecord,
    type HardwareTxWirePayload,
} from './hardwareTxWire';

type LedgerKeyringInstance = InstanceType<typeof LedgerKeyring>;

type LedgerSessionState = { instanceId: string; keyring: LedgerKeyringInstance };

let ledgerSession: LedgerSessionState | null = null;

async function disposeLedgerOffscreenSession(): Promise<void> {
    const session = ledgerSession;
    ledgerSession = null;

    if (!session) {
        return;
    }

    try {
        await session.keyring.destroy();
    } catch {
        // ignore
    }
}

async function createLedgerOffscreenSession(instanceId: string): Promise<LedgerKeyringInstance> {
    const bridge = new LedgerWebHidBridge();
    const keyring = new LedgerKeyring({ bridge });
    await keyring.init();
    await openWebHidTransport(bridge);
    ledgerSession = { instanceId, keyring };
    logger.log('⚙️ New Ledger bridge created', instanceId);
    return keyring;
}

/** Clear Ledger session when the HID device disconnects (MetaMask-style). */
function registerLedgerUsbDisconnectListener(): void {
    const hid = (
        navigator as {
            hid?: { addEventListener(type: string, listener: (ev: Event) => void): void };
        }
    ).hid;
    if (!hid?.addEventListener) {
        return;
    }
    hid.addEventListener('disconnect', (ev: Event) => {
        const dev = (ev as unknown as { device: { vendorId: number } }).device;
        if (dev.vendorId === LEDGER_USB_VENDOR_ID) {
            void disposeLedgerOffscreenSession();
        }
    });
}

async function openWebHidTransport(bridge: LedgerWebHidBridge): Promise<void> {
    await bridge.updateTransportMethod('webhid');
}

async function ensureLedgerOffscreenSession(
    instanceId: string,
    serialized: unknown,
): Promise<LedgerKeyringInstance> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            if (ledgerSession?.instanceId !== instanceId) {
                await disposeLedgerOffscreenSession();
                await createLedgerOffscreenSession(instanceId);
            }

            const kr = ledgerSession!.keyring;
            await kr.deserialize(
                (serialized && typeof serialized === 'object' ? serialized : {}) as never,
            );

            await (kr.bridge as LedgerWebHidBridge).ensureEthereumAppOpenOrThrow();

            return kr;
        } catch (error) {
            if (attempt === 0 && isLedgerTransportStuckError(error)) {
                logger.warn('⚙️ Ledger transport stuck — resetting session', error);
                await disposeLedgerOffscreenSession();
                continue;
            }
            throw error;
        }
    }

    throw new Error('Could not reconnect to Ledger. Reconnect USB and try again.');
}

type LedgerOffscreenSendResponsePayload =
    | { ledgerRequestId: string; ok: true; result?: unknown }
    | { ledgerRequestId: string; ok: false; error: string };

function ledgerOffscreenRespond(
    sendResponse: (payload: LedgerOffscreenSendResponsePayload) => void,
    ledgerRequestId: string,
    body:
        | (Omit<Extract<LedgerOffscreenSendResponsePayload, { ok: true }>, 'ledgerRequestId'> & {
              ledgerRequestId?: string;
          })
        | Omit<Extract<LedgerOffscreenSendResponsePayload, { ok: false }>, 'ledgerRequestId'>,
): void {
    sendResponse({ ledgerRequestId, ...body } as LedgerOffscreenSendResponsePayload);
}

type LedgerIncomingEnvelope = {
    ledgerRequestId: string;
    instanceId: string;
    method: string;
    payload?: Record<string, unknown>;
};

/** @returns `true` if this message is a Ledger RPC (async `sendResponse` will follow). */
export function handleOffscreenLedgerRuntimeMessage(
    message: unknown,
    _sender: unknown,
    sendResponse: (response?: unknown) => void,
): boolean {
    const envelope = message as LedgerIncomingEnvelope & { target?: string };

    if (
        envelope.target !== HARDWARE_OFFSCREEN_MESSAGE.rpcLedgerTarget ||
        typeof envelope.ledgerRequestId !== 'string' ||
        typeof envelope.method !== 'string' ||
        typeof envelope.instanceId !== 'string'
    ) {
        return false;
    }

    const { ledgerRequestId, instanceId, method, payload } = envelope;

    void (async () => {
        try {
            switch (method) {
                case 'dispose':
                    await disposeLedgerOffscreenSession();
                    ledgerOffscreenRespond(sendResponse, ledgerRequestId, { ok: true });
                    break;
                case 'addAccounts': {
                    const kr = await ensureLedgerOffscreenSession(instanceId, payload?.serialized);
                    const n = typeof payload?.n === 'number' ? payload.n : 1;
                    const newAddresses = await kr.addAccounts(n);

                    ledgerOffscreenRespond(sendResponse, ledgerRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            newAddresses,
                        },
                    });

                    break;
                }
                case 'signTransaction': {
                    const kr = await ensureLedgerOffscreenSession(instanceId, payload?.serialized);

                    const address = payload?.address as string;
                    const wire = payload?.wire as HardwareTxWirePayload;
                    const tx = typedTransactionFromHardwareWirePayload(wire);
                    const signed = await kr.signTransaction(address, tx);

                    ledgerOffscreenRespond(sendResponse, ledgerRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            signedTx: typedTransactionToWireRecord(signed),
                        },
                    });

                    break;
                }
                case 'signPersonalMessage': {
                    const kr = await ensureLedgerOffscreenSession(instanceId, payload?.serialized);
                    const signature = await kr.signPersonalMessage(
                        payload?.address as string,
                        payload?.message as string,
                    );

                    ledgerOffscreenRespond(sendResponse, ledgerRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            signature,
                        },
                    });

                    break;
                }
                case 'signTypedData': {
                    const kr = await ensureLedgerOffscreenSession(instanceId, payload?.serialized);

                    const versionStr = typeof payload?.version === 'string' ? payload.version : '';

                    if (versionStr !== 'V4') {
                        throw new Error(LEDGER_ERR_EIP712_V4_ONLY);
                    }

                    const signature = await kr.signTypedData(
                        payload?.address as string,
                        payload?.data as never,
                        { version: 'V4' },
                    );

                    ledgerOffscreenRespond(sendResponse, ledgerRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            signature,
                        },
                    });

                    break;
                }
                case 'getAddressPage': {
                    const kr = await ensureLedgerOffscreenSession(instanceId, payload?.serialized);
                    const direction = payload?.direction as string;
                    let rows: Awaited<ReturnType<typeof kr.getFirstPage>>;
                    if (direction === 'first') {
                        rows = await kr.getFirstPage();
                    } else if (direction === 'next') {
                        rows = await kr.getNextPage();
                    } else if (direction === 'prev') {
                        rows = await kr.getPreviousPage();
                    } else {
                        throw new Error(LEDGER_ERR_INVALID_ADDRESS_PAGE_DIRECTION);
                    }

                    ledgerOffscreenRespond(sendResponse, ledgerRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            accounts: rows,
                        },
                    });

                    break;
                }
                case 'importAccountsAtIndices': {
                    const kr = await ensureLedgerOffscreenSession(instanceId, payload?.serialized);
                    const indices = Array.isArray(payload?.indices)
                        ? (payload.indices as number[])
                        : [];
                    const added: string[] = [];
                    for (const idx of [...new Set(indices)].sort((a, b) => a - b)) {
                        kr.setAccountToUnlock(idx);
                        const batch = await kr.addAccounts(1);
                        added.push(...batch);
                    }

                    ledgerOffscreenRespond(sendResponse, ledgerRequestId, {
                        ok: true,
                        result: {
                            serialized: await kr.serialize(),
                            newAddresses: added,
                        },
                    });

                    break;
                }

                default:
                    ledgerOffscreenRespond(sendResponse, ledgerRequestId, {
                        ok: false,
                        error: ledgerUnknownOpMessage(method),
                    });
            }
        } catch (error) {
            if (isLedgerTransportStuckError(error)) {
                await disposeLedgerOffscreenSession();
            }
            const messageText = normalizeLedgerDeviceErrorMessage(error);
            ledgerOffscreenRespond(sendResponse, ledgerRequestId, {
                ok: false,
                error: messageText,
            });
        }
    })();

    return true;
}

registerLedgerUsbDisconnectListener();
