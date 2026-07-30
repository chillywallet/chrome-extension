import type Transport from '@ledgerhq/hw-transport';
import type {
    GetPublicKeyParams,
    GetPublicKeyResponse,
    LedgerBridge,
    LedgerSignMessageParams,
    LedgerSignMessageResponse,
    LedgerSignTransactionParams,
    LedgerSignTransactionResponse,
    LedgerSignTypedDataParams,
    LedgerSignTypedDataResponse,
} from '@metamask/eth-ledger-bridge-keyring';
import { LedgerTransportMiddleware } from '@metamask/eth-ledger-bridge-keyring';
import { SignTypedDataVersion, TypedDataUtils } from '@metamask/eth-sig-util';

import logger from '../../shared/utils/logger';
import {
    LEDGER_ERR_OPEN_ETHEREUM_APP,
    ledgerUnsupportedTransportMessage,
} from './ledgerErrorMessages';
import { forceCloseLedgerTransport } from './ledgerTransportRecovery';
import { openLedgerWebHidTransport } from './openLedgerWebHidTransport';

type LedgerWebHidBridgeOptions = Record<string, unknown>;

function isEthereumLedgerAppName(name: string): boolean {
    return name.trim().toLowerCase() === 'ethereum';
}

/** BOLOS “Locked device” APDU — device screen is on PIN / locked. */
const LEDGER_STATUS_LOCKED_DEVICE = 0x5515;

function isLedgerDeviceLockedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const e = error as { statusCode?: unknown; message?: unknown };
    if (typeof e.statusCode === 'number' && e.statusCode === LEDGER_STATUS_LOCKED_DEVICE) {
        return true;
    }
    if (typeof e.message === 'string' && /locked device/i.test(e.message)) {
        return true;
    }
    return false;
}

function isUserRejectedLedgerError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const e = error as { statusCode?: unknown; statusText?: unknown };
    return e.statusCode === 0x6985 || e.statusText === 'CONDITIONS_OF_USE_NOT_SATISFIED';
}

function isInsNotSupportedError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error as { statusText?: string }).statusText === 'INS_NOT_SUPPORTED'
    );
}

/**
 * WebHID bridge running in the extension offscreen document (same chrome-extension origin
 * as the popup). Pair the device from the UI first via {@link ensureLedgerWebHidPermission}
 * so {@link openLedgerWebHidTransport} can attach without a picker in the offscreen document.
 */
export class LedgerWebHidBridge implements LedgerBridge<LedgerWebHidBridgeOptions> {
    readonly #middleware: LedgerTransportMiddleware;
    #opts: LedgerWebHidBridgeOptions;

    isDeviceConnected = false;

    constructor(opts: LedgerWebHidBridgeOptions = {}) {
        this.#middleware = new LedgerTransportMiddleware();
        this.#opts = opts;
    }

    async init(): Promise<void> {
        return;
    }

    async destroy(): Promise<void> {
        try {
            await forceCloseLedgerTransport(this.#middleware.getTransport());
        } catch {
            try {
                await this.#middleware.dispose();
            } catch {
                // ignore
            }
        }
        this.isDeviceConnected = false;
    }

    async resetTransport(): Promise<void> {
        try {
            await forceCloseLedgerTransport(this.#middleware.getTransport());
        } catch {
            // ignore — transport may already be gone
        }

        const transport = await openLedgerWebHidTransport();
        this.#middleware.setTransport(transport);
        this.isDeviceConnected = true;
    }

    async getOptions(): Promise<LedgerWebHidBridgeOptions> {
        return this.#opts;
    }

    async setOptions(opts: LedgerWebHidBridgeOptions): Promise<void> {
        this.#opts = opts;
    }

    async attemptMakeApp(): Promise<boolean> {
        await this.#middleware.getEthApp().openEthApp();
        return true;
    }

    async #readRunningApp(): Promise<{ appName: string; version?: string } | null> {
        try {
            return await this.#middleware.getEthApp().getAppNameAndVersion();
        } catch (error) {
            if (isLedgerDeviceLockedError(error)) {
                throw error;
            }

            return null;
        }
    }

    /**
     * If the Ethereum app is not active, ask the device to open it (BOLOS APDU),
     * then fail fast with a clear error so the UI does not hang on the wrong app.
     */
    async ensureEthereumAppOpenOrThrow(): Promise<void> {
        let running = await this.#readRunningApp();
        logger.log('⚙️ Running app', running);

        if (running && isEthereumLedgerAppName(running.appName)) {
            return;
        }

        this.attemptMakeApp();
        throw new Error(LEDGER_ERR_OPEN_ETHEREUM_APP);
    }

    async updateTransportMethod(transportType: string | Transport): Promise<boolean> {
        if (typeof transportType !== 'string') {
            this.#middleware.setTransport(transportType);
            this.isDeviceConnected = true;
            return true;
        }

        const t = transportType.toLowerCase();
        if (t !== 'webhid' && t !== 'hid') {
            throw new Error(ledgerUnsupportedTransportMessage(transportType));
        }

        const transport = await openLedgerWebHidTransport();
        this.#middleware.setTransport(transport);
        this.isDeviceConnected = true;
        return true;
    }

    async getPublicKey(params: GetPublicKeyParams): Promise<GetPublicKeyResponse> {
        return this.#middleware.getEthApp().getAddress(params.hdPath, false, true);
    }

    async deviceSignTransaction(
        params: LedgerSignTransactionParams,
    ): Promise<LedgerSignTransactionResponse> {
        const app = this.#middleware.getEthApp();
        try {
            return await app.clearSignTransaction(params.hdPath, params.tx, {
                externalPlugins: true,
                erc20: true,
                nft: true,
            });
        } catch (error) {
            if (isUserRejectedLedgerError(error)) {
                throw error;
            }
            return app.signTransaction(params.hdPath, params.tx, null);
        }
    }

    async deviceSignMessage(params: LedgerSignMessageParams): Promise<LedgerSignMessageResponse> {
        return this.#middleware.getEthApp().signPersonalMessage(params.hdPath, params.message);
    }

    async deviceSignTypedData(
        params: LedgerSignTypedDataParams,
    ): Promise<LedgerSignTypedDataResponse> {
        const app = this.#middleware.getEthApp();
        try {
            return await app.signEIP712Message(params.hdPath, params.message);
        } catch (error) {
            if (!isInsNotSupportedError(error)) {
                throw error;
            }

            const sanitizedMessage = TypedDataUtils.sanitizeData(
                params.message as Parameters<typeof TypedDataUtils.sanitizeData>[0],
            );

            const domainSeparatorHex = TypedDataUtils.hashStruct(
                'EIP712Domain',
                sanitizedMessage.domain,
                sanitizedMessage.types,
                SignTypedDataVersion.V4,
            ).toString('hex');

            const hashStructMessageHex = TypedDataUtils.hashStruct(
                sanitizedMessage.primaryType as string,
                sanitizedMessage.message,
                sanitizedMessage.types,
                SignTypedDataVersion.V4,
            ).toString('hex');

            return app.signEIP712HashedMessage(
                params.hdPath,
                domainSeparatorHex,
                hashStructMessageHex,
            );
        }
    }
}
