/**
 * Committed API key defaults for the free data providers.
 *
 * All keys here are OPTIONAL and free to obtain. Leave a value empty to ship
 * without it; the corresponding provider surfaces a MissingApiKeyError and the
 * UI degrades gracefully ("add a free API key in Settings").
 *
 * User-supplied keys are stored in `preferences.apiKeys` and take precedence
 * over these defaults (see resolveApiKey in src/config/index.ts).
 *
 * - etherscan:   free key from https://etherscan.io/apis (works for all
 *                Etherscan V2 multichain endpoints)
 * - blockvision: free key from https://blockvision.org (Monad indexer)
 */
/**
 * Build-time defaults. `dotenv-webpack` substitutes these from the target's .env file
 * (e.g. .env.debug), which is how e2e runs supply a key headlessly — there is no UI in a
 * Playwright run. Absent an .env entry these resolve to undefined and fall back to ''.
 * A user-supplied key in preferences.apiKeys still wins over anything here.
 */
export const DEFAULT_API_KEYS: Record<string, string> = {
    etherscan: process.env.ETHERSCAN_API_KEY || '',
    blockvision: process.env.BLOCKVISION_API_KEY || '',
};

/** Presentation metadata for the Developer Settings key editor. */
export type ApiKeyInfo = {
    apiKeyRef: string;
    label: string;
    /** Where the user obtains a free key. */
    signupUrl: string;
    description: string;
};

export const API_KEY_INFO: ApiKeyInfo[] = [
    {
        apiKeyRef: 'etherscan',
        label: 'Etherscan',
        signupUrl: 'https://etherscan.io/apis',
        description:
            'One free key works across every Etherscan V2 chain — Monad (monadscan), BSC, Polygon, Arbitrum, Avalanche and the testnets.',
    },
    {
        apiKeyRef: 'blockvision',
        label: 'BlockVision',
        signupUrl: 'https://blockvision.org',
        description:
            'Optional. A dedicated Monad indexer with richer NFT data — only needed if you switch a Monad chain to BlockVision below.',
    },
];
