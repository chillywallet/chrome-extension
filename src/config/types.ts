import { ChainData } from '../shared/types/Chain';

/**
 * Provider kinds supported by the pluggable data/price/swap layers.
 *
 * - dataProvider: indexer used for token discovery, transaction history and NFTs.
 * - priceProvider: source of USD prices, charts and top-coin lists.
 * - swapProvider: DEX aggregator used for swap quotes.
 *
 * All providers are free APIs. Some require a free user-supplied API key,
 * referenced by name via `apiKeyRef` and resolved from `preferences.apiKeys`
 * (with committed defaults in src/config/apiKeys.ts).
 */
export type DataProviderKind = 'etherscan' | 'blockscout' | 'blockvision' | 'none';
export type PriceProviderKind = 'defillama' | 'coingecko' | 'none';
export type SwapProviderKind = 'openocean' | 'none';

export type DataProviderConfig = {
    kind: DataProviderKind;
    /** API root, e.g. 'https://api.etherscan.io/v2/api' or a Blockscout instance root. */
    baseUrl: string;
    /** Name of the key in the api-key store ('etherscan' | 'blockvision' | ...). Never the key itself. */
    apiKeyRef?: string;
};

export type PriceProviderConfig = {
    kind: PriceProviderKind;
    /** DefiLlama chain slug used in `coins.llama.fi` keys, e.g. 'ethereum', 'avax'. */
    llamaSlug?: string;
    /** CoinGecko asset-platform id, e.g. 'ethereum', 'polygon-pos'. */
    coingeckoPlatform?: string;
    /**
     * CoinGecko id of the native *gas* coin, used to build the `coingecko:{id}`
     * DefiLlama key. Note this is often not the chain's headline token — gas on
     * Optimism and Linea is ETH, not OP or LINEA.
     */
    nativeCoingeckoId?: string;
};

export type SwapProviderConfig = {
    kind: SwapProviderKind;
    /** Chain slug in the aggregator's URL scheme, e.g. OpenOcean 'eth', 'bsc', 'monad'. */
    providerChainSlug?: string;
};

/**
 * Full per-chain configuration. Extends the legacy runtime ChainData shape so
 * existing consumers keep working unchanged, and adds the pluggable provider
 * configuration on top.
 */
export type ChainConfig = ChainData & {
    /**
     * Public RPC endpoints, most-preferred first. NOTE: only `rpcUrl` (which must
     * mirror rpcUrls[0]) is actually dialled — there is no automatic failover, because
     * the dapp path needs a real JsonRpcProvider (web3.tsx calls provider.send) and
     * ethers' FallbackProvider is not a drop-in. Treat the rest as vetted alternatives
     * to switch to by hand, or via the per-chain custom RPC in settings.
     */
    rpcUrls: string[];
    dataProvider: DataProviderConfig;
    priceProvider: PriceProviderConfig;
    swapProvider: SwapProviderConfig;
};

/** Per-chain user override, stored in preferences (extends legacy customNetworks entries). */
export type ChainUserOverride = {
    chain_id: number;
    rpcUrl?: string;
    dataProvider?: Partial<DataProviderConfig>;
    version?: number;
};
