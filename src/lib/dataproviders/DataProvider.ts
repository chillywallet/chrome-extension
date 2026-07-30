import { DataProviderConfig, resolveApiKey, resolveChainConfig } from '../../config';
import { ChainConfig } from '../../config/types';
import { CoinHolding } from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import { getReduxStore } from '../../store/store';
import { NftPage, TxPage } from './types';

/**
 * Pluggable per-chain indexer used for token discovery, transaction history
 * and NFTs. Implementations map free explorer APIs (Etherscan V2, Blockscout,
 * BlockVision, ...) into the UI's existing data shapes.
 *
 * Which provider a chain uses is configured in src/config/chains.ts and can be
 * overridden at runtime through `preferences.customNetworks`.
 */
export interface DataProvider {
    readonly kind: string;

    /**
     * Token discovery: which tokens (including the native coin) the address
     * holds. Balances may be stale or zero — live balances still come from
     * on-chain reads via TransactionController.getTokenBalance.
     */
    getTokenHoldings(address: string): Promise<CoinHolding[]>;

    /** Paged wallet transaction history (page is 1-based). */
    getTransactions(
        address: string,
        page: number,
        size: number,
        tokenAddress?: string,
    ): Promise<TxPage>;

    /** Paged NFT holdings. */
    getNFTs(address: string, search: string, page: number, size: number): Promise<NftPage>;
}

/** Raised when a provider requires a (free) API key that has not been configured. */
export class MissingApiKeyError extends Error {
    readonly apiKeyRef: string;

    constructor(apiKeyRef: string) {
        super(
            `A free ${apiKeyRef} API key is required for this network. ` +
                'Add it in Developer Settings.',
        );
        this.name = 'MissingApiKeyError';
        this.apiKeyRef = apiKeyRef;
    }
}

export type ProviderContext = {
    chain: ChainConfig;
    config: DataProviderConfig;
    /** Resolves the API key for the provider ('' when not needed/configured). */
    apiKey: string;
};

type ProviderFactory = (context: ProviderContext) => DataProvider;

const factories: Record<string, ProviderFactory> = {};

/** Adapters self-register here (see index.ts). */
export function registerDataProvider(kind: string, factory: ProviderFactory) {
    factories[kind] = factory;
}

const cache = new Map<string, DataProvider>();

function getUserApiKeys(): Record<string, string> | undefined {
    return getReduxStore()?.getState()?.globalState?.preferences?.apiKeys;
}

function getUserOverrides() {
    return getReduxStore()?.getState()?.globalState?.preferences?.customNetworks;
}

/**
 * Returns the (cached) data provider for a chain, honoring user overrides.
 * Throws when the chain is unknown or its provider kind is 'none'/unregistered.
 */
export function getDataProvider(chainId: number): DataProvider {
    const chain = resolveChainConfig(chainId, getUserOverrides());

    if (!chain) {
        throw new Error(`chainId not found: ${chainId}`);
    }

    const config = chain.dataProvider;

    if (!config || config.kind === 'none') {
        throw new Error(`No data provider configured for chain ${chainId}`);
    }

    const apiKey = resolveApiKey(config.apiKeyRef, getUserApiKeys());
    const cacheKey = `${chainId}:${config.kind}:${config.baseUrl}:${apiKey}`;
    const cached = cache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const factory = factories[config.kind];

    if (!factory) {
        throw new Error(`Unknown data provider kind: ${config.kind}`);
    }

    logger.log(`📡 DataProvider[${config.kind}] for chain ${chainId} → ${config.baseUrl}`);
    const provider = factory({ chain, config, apiKey });
    cache.set(cacheKey, provider);
    return provider;
}

/** Test helper. */
export function clearDataProviderCache() {
    cache.clear();
}
