export const CaveatTypes = Object.freeze({
    restrictReturnedAccounts: 'restrictReturnedAccounts' as const,
});

export const RestrictedMethods = Object.freeze({
    eth_accounts: 'eth_accounts',
} as const);
