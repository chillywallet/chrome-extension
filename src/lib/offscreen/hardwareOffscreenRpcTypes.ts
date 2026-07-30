/** Service worker → MV3 offscreen document RPC (Ledger or Trezor envelope). */
export type HardwareOffscreenRpcFn = <T>(
    instanceId: string,
    method: string,
    payload?: unknown,
) => Promise<T>;
