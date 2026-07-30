import { getReduxStore } from '../store/store';

/**
 * Local custom-token registry and hidden-token flags, stored in preferences.
 * Replaces the old backend addCustomToken / showToken / hideToken mutations.
 *
 * - preferences.customTokens: Record<chainId, CustomToken[]>
 * - preferences.hiddenTokens: Record<`${chainId}:${tokenAddress}`, boolean>
 */

export type CustomToken = {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logo?: string;
};

function getPreferences(): any {
    return getReduxStore()?.getState()?.globalState?.preferences ?? {};
}

export function getCustomTokens(chainId: number): CustomToken[] {
    const map = getPreferences().customTokens ?? {};
    return map[String(chainId)] ?? [];
}

export function buildCustomTokensPreference(
    chainId: number,
    token: CustomToken,
): Record<string, CustomToken[]> {
    const map = { ...(getPreferences().customTokens ?? {}) };
    const key = String(chainId);
    const existing: CustomToken[] = map[key] ?? [];

    if (
        existing.some(entry => entry.address.toLowerCase() === token.address.toLowerCase())
    ) {
        return map;
    }

    map[key] = [...existing, { ...token, address: token.address.toLowerCase() }];
    return map;
}

export function hiddenTokenKey(chainId: number, tokenAddress: string): string {
    return `${chainId}:${(tokenAddress ?? '').toLowerCase()}`;
}

export function isTokenHidden(chainId: number, tokenAddress: string): boolean {
    const map = getPreferences().hiddenTokens ?? {};
    return Boolean(map[hiddenTokenKey(chainId, tokenAddress)]);
}

export function buildHiddenTokensPreference(
    chainId: number,
    tokenAddress: string,
    hidden: boolean,
): Record<string, boolean> {
    const map = { ...(getPreferences().hiddenTokens ?? {}) };
    map[hiddenTokenKey(chainId, tokenAddress)] = hidden;
    return map;
}
