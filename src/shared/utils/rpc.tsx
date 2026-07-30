import { ChainData } from '../types/Chain';

type RpcUrlsMap = Record<string, string>;

type CustomNetwork = {
    chain_id: number;
    /** Optional: an entry may override only the data provider (see ChainUserOverride). */
    rpcUrl?: string;
    version?: number;
};

type GetRpcUrlOptions = {
    /**
     * Map of chain_id -> RPC URL coming from remote config (optional).
     */
    rpcUrls?: RpcUrlsMap;

    /**
     * User-defined custom networks coming from preferences (optional).
     */
    customNetworks?: CustomNetwork[];

    /**
     * If true, ignores user-defined RPC URLs and only uses remote/default.
     */
    skipUserRpcUrl?: boolean;
};

/**
 * Get the effective RPC URL for a given network.
 *
 * Priority (highest → lowest):
 * 1. User custom RPC URL (unless `skipUserRpcUrl` is true)
 * 2. Remote RPC URL (if provided)
 * 3. Default RPC URL from the chain config
 */
export const getRpcUrlByNetwork = (
    network: ChainData,
    options: GetRpcUrlOptions = {},
): string => {
    if (!network) {
        return '';
    }

    const { rpcUrls, customNetworks, skipUserRpcUrl = false } = options;

    // 1. Default RPC URL from chain config
    const defaultRpcUrl = network.rpcUrl;

    // 2. Remote RPC URL (by chain_id)
    const remoteUrl = rpcUrls?.[network.chain_id.toString()];

    // 3. User-defined custom RPC URL
    let userRpcUrl = '';
    if (!skipUserRpcUrl && Array.isArray(customNetworks)) {
        userRpcUrl =
            customNetworks.find(cn => cn.chain_id === network.chain_id)?.rpcUrl?.trim() ?? '';
    }

    const finalRpcUrl = userRpcUrl || remoteUrl || defaultRpcUrl;
    return finalRpcUrl ?? '';
};

