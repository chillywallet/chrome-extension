import { DEFAULT_API_KEYS } from './apiKeys';
import { CHAINS } from './chains';
import { ChainConfig, ChainUserOverride, DataProviderConfig } from './types';

export * from './apiKeys';
export * from './chains';
export * from './defaults';
export * from './types';

/**
 * Resolve the effective configuration for a chain, applying user overrides
 * (from preferences) on top of the committed defaults.
 *
 * Priority: user override > committed default.
 */
export function resolveChainConfig(
    chainId: number,
    overrides?: ChainUserOverride[],
): ChainConfig | undefined {
    const base = CHAINS.find(chain => chain.chain_id === chainId);
    if (!base) {
        return undefined;
    }

    const override = overrides?.find(o => o.chain_id === chainId);
    if (!override) {
        return base;
    }

    const rpcUrl = override.rpcUrl?.trim();
    const dataProvider: DataProviderConfig = override.dataProvider
        ? { ...base.dataProvider, ...override.dataProvider }
        : base.dataProvider;

    return {
        ...base,
        ...(rpcUrl ? { rpcUrl, rpcUrls: [rpcUrl, ...base.rpcUrls] } : {}),
        dataProvider,
    };
}

/**
 * Resolve an API key by reference name: user-supplied key (preferences.apiKeys)
 * wins over the committed default. Returns '' when no key is available.
 */
export function resolveApiKey(apiKeyRef?: string, userApiKeys?: Record<string, string>): string {
    if (!apiKeyRef) {
        return '';
    }
    return userApiKeys?.[apiKeyRef]?.trim() || DEFAULT_API_KEYS[apiKeyRef] || '';
}
