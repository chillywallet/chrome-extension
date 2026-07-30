import { CHAINS, CHAIN_CONFIG_ETHEREUM } from '../config/chains';
import { Chain, ChainData } from '../shared/types/Chain';

export const DEFAULT_CHAIN = CHAIN_CONFIG_ETHEREUM;

/**
 * The runtime chain list, derived from the committed registry in
 * src/config/chains.ts. Entries are ChainConfig objects, which extend the
 * legacy ChainData shape, so all existing consumers keep working.
 */
export const CURRENT_CHAINS: ChainData[] = CHAINS;

export const getCurrentChainByChain = (chain: Chain) => {
    return CURRENT_CHAINS.find(_chain => _chain.chain_key === chain);
};

export const getCurrentChainByChainId = (chainId: number) => {
    const chain = CURRENT_CHAINS.find(_chain => _chain.chain_id === chainId);

    if (!chain) {
        throw new Error(`chainId not found: ${chainId}`);
    }

    return chain;
};

export const getCurrentChainByPlatformId = (platformId: number) => {
    const chain = CURRENT_CHAINS.find(_chain => _chain.platform_id === platformId);

    if (!chain) {
        throw new Error(`platformId not found: ${platformId}`);
    }

    return chain;
};

export function getPlatformIdByChainData(_chain: ChainData) {
    if (_chain) {
        return _chain.platform_id;
    }

    return DEFAULT_CHAIN.platform_id;
}

export function getCurrentChains() {
    return CURRENT_CHAINS;
}
