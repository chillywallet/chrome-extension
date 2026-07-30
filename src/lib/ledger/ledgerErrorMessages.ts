/**
 * User-facing Ledger / WebHID error copy (single source of truth).
 */

// --- WebHID transport (`openLedgerWebHidTransport`) ---

export const LEDGER_ERR_WEBHID_NOT_SUPPORTED_BROWSER =
    'WebHID is not supported in this browser.' as const;

export const LEDGER_ERR_COULD_NOT_OPEN_DEVICE =
    'Could not open your Ledger. Unlock it, open the Ethereum app if needed, reconnect USB, then try again.' as const;

// --- Permission prompt (`ensureLedgerWebHidPermission`) ---

export const LEDGER_ERR_WEBHID_NOT_AVAILABLE =
    'WebHID is not available. Use Chrome or Edge with a USB-connected Ledger, or enable WebHID.' as const;

export const LEDGER_ERR_NO_LEDGER_SELECTED =
    'No Ledger was selected. Plug in your device via USB, unlock it, then try again.' as const;

// --- Bridge (`LedgerWebHidBridge`) ---

export const LEDGER_ERR_OPEN_ETHEREUM_APP =
    'Open the Ethereum app on your Ledger, then try again.' as const;

export function ledgerUnsupportedTransportMessage(transportType: string): string {
    return `Unsupported Ledger transport "${transportType}". Use WebHID (USB).`;
}

// --- Offscreen RPC (`offscreenLedgerMessageHandler`) ---

export const LEDGER_ERR_EIP712_V4_ONLY =
    'Ledger: Only EIP-712 V4 typed data signing is supported' as const;

export const LEDGER_ERR_INVALID_ADDRESS_PAGE_DIRECTION = 'Invalid address page direction.' as const;

export function ledgerUnknownOpMessage(method: string): string {
    return `Unknown Ledger op: ${method}`;
}

// --- UI → offscreen client (`ledgerOffscreenPort`) ---

export const LEDGER_ERR_OFFSCREEN_INVALID_RESPONSE =
    'Ledger offscreen returned an invalid response.' as const;

export const LEDGER_ERR_OFFSCREEN_GENERIC = 'Ledger offscreen error' as const;

export function ledgerOffscreenRpcTimeoutMessage(timeoutMs: number): string {
    return `Ledger request timed out after ${Math.round(timeoutMs / 1000)}s. Unlock your Ledger, open the Ethereum app, and try again.`;
}

// --- Connect hardware wallet UI ---

export const LEDGER_ERR_COULD_NOT_CONNECT = 'Could not connect Ledger.' as const;

// --- Keyring controller ---

export const LEDGER_ERR_WALLET_NOT_FOUND = 'Ledger wallet not found.' as const;

export const LEDGER_ERR_SELECT_AT_LEAST_ONE_ADDRESS =
    'Select at least one Ledger address.' as const;

export const LEDGER_ERR_NO_SESSION_BEFORE_IMPORT =
    'No Ledger session. Connect your device and load addresses before importing.' as const;

// --- Device status normalization (`ledgerNormalizeDeviceError`) ---

export const LEDGER_ERR_GENERIC_FALLBACK = 'Something went wrong with your Ledger.' as const;

/** Unlock / PIN / Ethereum app prompt */
export const LEDGER_DEVICE_MSG_UNLOCK_PIN_ETHEREUM =
    'Unlock your Ledger with your PIN and try again. Open the Ethereum app if you are prompted.' as const;

export const LEDGER_DEVICE_MSG_USER_DECLINED = 'You declined this action on your Ledger.' as const;

export const LEDGER_DEVICE_MSG_UNLOCK_APPROVE =
    'Unlock your Ledger, open the Ethereum app, approve the request on the device, then try again.' as const;

export const LEDGER_DEVICE_MSG_PIN_NOT_CONFIGURED =
    'PIN is not configured on your Ledger.' as const;

export const LEDGER_DEVICE_MSG_INSTALL_OPEN_ETHEREUM =
    'Install and open the Ethereum app on your Ledger, then try again.' as const;

export const LEDGER_DEVICE_MSG_INVALID_REQUEST_LENGTH =
    'The device reported invalid request length.' as const;

export const LEDGER_DEVICE_MSG_REQUEST_REFUSED = 'The device refused the request.' as const;

export const LEDGER_DEVICE_MSG_TX_VALIDATION_FAILED =
    'The Ledger could not validate this transaction. Check the recipient, amount, and network.' as const;

export const LEDGER_DEVICE_MSG_INVALID_PARAMETERS =
    'The device reported invalid parameters.' as const;

export const LEDGER_DEVICE_MSG_COMMAND_UNAVAILABLE =
    'This command is not available. Open the Ethereum app on your Ledger and try again.' as const;

export const LEDGER_DEVICE_MSG_APP_INCOMPATIBILITY =
    'The Ethereum app reported an incompatibility—update the Ethereum app if possible.' as const;

export const LEDGER_DEVICE_MSG_LICENSING_FAILED = 'Licensing check failed on the device.' as const;

export const LEDGER_DEVICE_MSG_UNEXPECTED_STATE =
    'Your Ledger is in an unexpected state. Unlock it or reconnect USB, then try again.' as const;

/** WebHID transport still has a pending exchange after unplug or deny mid-sign. */
export const LEDGER_DEVICE_MSG_TRANSPORT_STUCK =
    'Your Ledger connection was interrupted. Reconnect USB, unlock the device, open the Ethereum app, then try again.' as const;

export const LEDGER_DEVICE_MSG_STOPPED_RESPONDING = 'Your Ledger stopped responding.' as const;

export const LEDGER_DEVICE_MSG_RECOVERY_MODE = 'Your Ledger is in recovery mode.' as const;

export const LEDGER_DEVICE_MSG_INTERNAL_DEVICE_ERROR =
    'Your Ledger reported an internal device error.' as const;

export const LEDGER_ERR_DEVICE_NOT_CONNECTED =
    'Please connect your Ledger wallet, unlock it, and open the Ethereum app on your device. Then try again.' as const;
