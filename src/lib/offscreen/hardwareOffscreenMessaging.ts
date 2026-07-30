/** Message targets for the shared MV3 offscreen document (Ledger + Trezor). */
export const HARDWARE_OFFSCREEN_MESSAGE = {
    bootTargetExtension: '__chilly-offscreen-extension-boot-target',
    /** Ledger RPC handled in the extension offscreen document (`src/offscreen.ts`). */
    rpcLedgerTarget: '__chilly-offscreen-ledger-rpc-target',
    /** Trezor RPC handled in the extension offscreen document (`src/offscreen.ts`). */
    rpcTrezorTarget: '__chilly-offscreen-trezor-rpc-target',
} as const;
