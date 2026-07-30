import { JsonRpcProvider } from 'ethers';
import { resolveChainConfig } from '../config';
import { ChainData } from '../shared/types/Chain';
import { getRpcUrlByNetwork } from '../shared/utils/rpc';

type RpcOverrides = {
    rpcUrls?: Record<string, string>;
    customNetworks?: Array<{ chain_id: number; rpcUrl: string; version?: number }>;
};

/**
 * Single place where chain RPC providers are constructed. All providers are
 * created with the same options (static network, batching disabled — several
 * public RPCs reject batched requests).
 */
export function createRpcProvider(rpcUrl: string, chainId: number): JsonRpcProvider {
    return new JsonRpcProvider(rpcUrl, chainId, {
        staticNetwork: true,
        batchMaxCount: 1,
    });
}

/**
 * Resolve the effective RPC URL for a chain (user custom > configured default)
 * and build a provider for it. Throws when the chain is unknown.
 */
export function makeProvider(chainId: number, overrides: RpcOverrides = {}): JsonRpcProvider {
    const chain = resolveChainConfig(chainId, overrides.customNetworks);

    if (!chain) {
        throw new Error(`chainId not found: ${chainId}`);
    }

    const rpcUrl = getRpcUrlByNetwork(chain as ChainData, overrides);

    if (!rpcUrl) {
        throw new Error('Network not supported');
    }

    return createRpcProvider(rpcUrl, chainId);
}
