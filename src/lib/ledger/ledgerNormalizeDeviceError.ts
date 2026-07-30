import {
    LEDGER_DEVICE_MSG_APP_INCOMPATIBILITY,
    LEDGER_DEVICE_MSG_COMMAND_UNAVAILABLE,
    LEDGER_DEVICE_MSG_INSTALL_OPEN_ETHEREUM,
    LEDGER_DEVICE_MSG_INTERNAL_DEVICE_ERROR,
    LEDGER_DEVICE_MSG_INVALID_PARAMETERS,
    LEDGER_DEVICE_MSG_INVALID_REQUEST_LENGTH,
    LEDGER_DEVICE_MSG_LICENSING_FAILED,
    LEDGER_DEVICE_MSG_PIN_NOT_CONFIGURED,
    LEDGER_DEVICE_MSG_RECOVERY_MODE,
    LEDGER_DEVICE_MSG_REQUEST_REFUSED,
    LEDGER_DEVICE_MSG_STOPPED_RESPONDING,
    LEDGER_DEVICE_MSG_TX_VALIDATION_FAILED,
    LEDGER_DEVICE_MSG_TRANSPORT_STUCK,
    LEDGER_DEVICE_MSG_UNEXPECTED_STATE,
    LEDGER_DEVICE_MSG_UNLOCK_APPROVE,
    LEDGER_DEVICE_MSG_UNLOCK_PIN_ETHEREUM,
    LEDGER_DEVICE_MSG_USER_DECLINED,
    LEDGER_ERR_GENERIC_FALLBACK,
} from './ledgerErrorMessages';
import { isLedgerTransportStuckError } from './ledgerTransportRecovery';

const LEDGER_DEVICE_LINE = /^Ledger device:\s*(.+?)\s*\(0x[0-9a-f]+\)\s*$/i;

function hexStatusFromParenSuffix(message: string): number | undefined {
    const match = /\((0x[0-9a-f]+)\)\s*$/i.exec(message.trim());
    return match !== null ? Number.parseInt(match[1].slice(2), 16) : undefined;
}

/**
 * Ledger APDU-derived {@link TransportStatusError} codes from `@ledgerhq/errors`
 * mapped to concise user-facing strings (no redundant "Ledger device:" prefix).
 */
function messageForLedgerStatusCode(code: number): string | undefined {
    switch (code) {
        case 0x5515:
            return LEDGER_DEVICE_MSG_UNLOCK_PIN_ETHEREUM;
        case 0x6985:
            return LEDGER_DEVICE_MSG_USER_DECLINED;
        case 0x6982:
            return LEDGER_DEVICE_MSG_UNLOCK_APPROVE;
        case 0x5501:
            return LEDGER_DEVICE_MSG_USER_DECLINED;
        case 0x5502:
            return LEDGER_DEVICE_MSG_PIN_NOT_CONFIGURED;
        case 0x5123:
            return LEDGER_DEVICE_MSG_INSTALL_OPEN_ETHEREUM;
        case 0x6700:
            return LEDGER_DEVICE_MSG_INVALID_REQUEST_LENGTH;
        case 0x6800:
            return LEDGER_DEVICE_MSG_REQUEST_REFUSED;
        case 0x6a80:
            return LEDGER_DEVICE_MSG_TX_VALIDATION_FAILED;
        case 0x6b00:
            return LEDGER_DEVICE_MSG_INVALID_PARAMETERS;
        case 0x6d00:
            return LEDGER_DEVICE_MSG_COMMAND_UNAVAILABLE;
        case 0x6e00:
            return LEDGER_DEVICE_MSG_APP_INCOMPATIBILITY;
        case 0x6f42:
            return LEDGER_DEVICE_MSG_LICENSING_FAILED;
        case 0xb007:
            return LEDGER_DEVICE_MSG_UNEXPECTED_STATE;
        case 0x6faa:
            return LEDGER_DEVICE_MSG_STOPPED_RESPONDING;
        case 0x662f:
            return LEDGER_DEVICE_MSG_RECOVERY_MODE;
        default:
            if (code >= 0x6f00 && code <= 0x6fff) {
                return LEDGER_DEVICE_MSG_INTERNAL_DEVICE_ERROR;
            }
            return undefined;
    }
}

function ledgerDeviceFormattedCoreMessage(message: string): string | undefined {
    const m = LEDGER_DEVICE_LINE.exec(message.trim());
    return m !== null ? m[1].trim() : undefined;
}

function readStatusCode(input: unknown, rawMessage: string): number | undefined {
    if (
        typeof input === 'object' &&
        input !== null &&
        typeof (input as { statusCode?: unknown }).statusCode === 'number' &&
        Number.isInteger((input as { statusCode: number }).statusCode)
    ) {
        return (input as { statusCode: number }).statusCode;
    }
    return hexStatusFromParenSuffix(rawMessage);
}

/**
 * Turn `@ledgerhq` / transport errors such as {@code Ledger device: Locked device (0x5515)}
 * into concise copy suitable for toast or extension UI.
 */
export function normalizeLedgerDeviceErrorMessage(input: unknown): string {
    const rawMessage =
        typeof input === 'string' ? input : input instanceof Error ? input.message : String(input);

    if (isLedgerTransportStuckError(input) || isLedgerTransportStuckError(rawMessage)) {
        return LEDGER_DEVICE_MSG_TRANSPORT_STUCK;
    }

    const code = readStatusCode(input, rawMessage);

    if (code !== undefined) {
        const mapped = messageForLedgerStatusCode(code);
        if (mapped !== undefined) {
            return mapped;
        }
    }

    const core = ledgerDeviceFormattedCoreMessage(rawMessage);
    if (core !== undefined) {
        return core.endsWith('.') ? core : `${core}.`;
    }

    return rawMessage.trim() || LEDGER_ERR_GENERIC_FALLBACK;
}
