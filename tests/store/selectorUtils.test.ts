import {
    getAccountsCaveatFromPermission,
    getAccountsFromPermission,
    getAccountsFromSubject,
    getAccountsPermissionFromSubject,
    getAllAccounts,
    getAccountsByWalletId,
    getConnectedAccountsForTab,
    findWalletForAddress,
    getRpcUrlOnUIScript,
} from '../../src/store/selectorUtils';
import { getReduxStore } from '../../src/store/store';

jest.mock('../../src/store/store', () => ({
    getReduxStore: jest.fn(),
}));

describe('selectorUtils pure helpers', () => {
    it('getAccountsCaveatFromPermission returns the matching caveat', () => {
        const perm: any = {
            caveats: [{ type: 'restrictReturnedAccounts', value: ['0xa'] }],
        };
        const result = getAccountsCaveatFromPermission(perm);
        expect(result).toEqual({ type: 'restrictReturnedAccounts', value: ['0xa'] });
    });

    it('getAccountsCaveatFromPermission returns false when no caveats', () => {
        expect(getAccountsCaveatFromPermission({} as any)).toBe(false);
    });

    it('getAccountsFromPermission returns caveat values', () => {
        const perm: any = {
            caveats: [{ type: 'restrictReturnedAccounts', value: ['0xa'] }],
        };
        expect(getAccountsFromPermission(perm)).toEqual(['0xa']);
    });

    it('getAccountsFromPermission returns [] when no caveat', () => {
        expect(getAccountsFromPermission({} as any)).toEqual([]);
    });

    it('getAccountsPermissionFromSubject and getAccountsFromSubject', () => {
        const subject: any = {
            permissions: {
                eth_accounts: {
                    caveats: [{ type: 'restrictReturnedAccounts', value: ['0xb'] }],
                },
            },
        };
        expect(getAccountsPermissionFromSubject(subject).caveats).toBeDefined();
        expect(getAccountsFromSubject(subject)).toEqual(['0xb']);
    });
});

describe('selectorUtils store-backed helpers', () => {
    const ACC1 = '0xabc';

    beforeEach(() => {
        (getReduxStore as jest.Mock).mockReset();
    });

    it('getConnectedAccountsForTab returns [] when no origin', () => {
        expect(getConnectedAccountsForTab()).toEqual([]);
    });

    it('getConnectedAccountsForTab matches addresses', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    subjects: {
                        'https://dapp': {
                            permissions: {
                                eth_accounts: {
                                    caveats: [
                                        { type: 'restrictReturnedAccounts', value: [ACC1] },
                                    ],
                                },
                            },
                        },
                    },
                    internalAccounts: {
                        accounts: {
                            id1: { address: ACC1 },
                        },
                    },
                },
            }),
        });
        const accounts = getConnectedAccountsForTab('https://dapp');
        expect(accounts).toHaveLength(1);
    });

    it('findWalletForAddress returns the wallet when found', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    internalWallets: { wallets: { kid: { id: 'kid' } } },
                    keyrings: [{ id: 'kid', accounts: [ACC1] }],
                },
            }),
        });
        expect(findWalletForAddress(ACC1)).toEqual({ id: 'kid' });
    });

    it('findWalletForAddress returns null when not found', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    internalWallets: { wallets: {} },
                    keyrings: [],
                },
            }),
        });
        expect(findWalletForAddress(ACC1)).toBeNull();
    });

    it('getRpcUrlOnUIScript returns empty when no state', () => {
        (getReduxStore as jest.Mock).mockReturnValue({ getState: () => undefined });
        expect(getRpcUrlOnUIScript({} as any)).toBe('');
    });

    it('getRpcUrlOnUIScript returns the chain default rpc', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    preferences: { rpcUrls: {}, customNetworks: [] },
                },
            }),
        });
        const network = { chain_id: 1, rpcUrl: 'https://default.example' } as any;
        expect(getRpcUrlOnUIScript(network)).toBe('https://default.example');
    });

    it('getRpcUrlOnUIScript falls back when rpcUrls/customNetworks are missing', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: { preferences: {} },
            }),
        });
        const network = { chain_id: 9999, rpcUrl: 'https://defaulted' } as any;
        expect(getRpcUrlOnUIScript(network)).toBe('https://defaulted');
    });

    it('getAllAccounts returns [] when getReduxStore returns undefined', () => {
        (getReduxStore as jest.Mock).mockReturnValue(undefined);
        expect(getAllAccounts()).toEqual([]);
    });

    it('getAllAccounts returns [] when state is missing', () => {
        (getReduxStore as jest.Mock).mockReturnValue({ getState: () => undefined });
        expect(getAllAccounts()).toEqual([]);
    });

    it('getAllAccounts filters out deleted accounts', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    internalAccounts: {
                        accounts: {
                            a: { address: '0xa', metadata: {} },
                            b: { address: '0xb', metadata: { deleted: true } },
                        },
                    },
                },
            }),
        });
        const out = getAllAccounts();
        expect(out).toHaveLength(1);
        expect(out[0].address).toBe('0xa');
    });

    it('getAllAccounts returns [] when accounts dictionary is missing', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: { internalAccounts: {} },
            }),
        });
        expect(getAllAccounts()).toEqual([]);
    });

    it('getAccountsByWalletId returns [] when keyring not found', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    internalAccounts: {
                        accounts: { a: { address: '0xa', metadata: {} } },
                    },
                    keyrings: [{ id: 'other', accounts: ['0xa'] }],
                },
            }),
        });
        expect(getAccountsByWalletId('missing')).toEqual([]);
    });

    it('getAccountsByWalletId returns accounts in keyring order', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    internalAccounts: {
                        accounts: {
                            a: { address: '0xA', metadata: {} },
                            b: { address: '0xB', metadata: {} },
                        },
                    },
                    keyrings: [{ id: 'kid', accounts: ['0xB', '0xA'] }],
                },
            }),
        });
        const accounts = getAccountsByWalletId('kid');
        expect(accounts.map((a: any) => a.address)).toEqual(['0xB', '0xA']);
    });

    it('getAccountsByWalletId skips addresses not present in internalAccounts', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    internalAccounts: {
                        accounts: { a: { address: '0xa', metadata: {} } },
                    },
                    keyrings: [{ id: 'kid', accounts: ['0xa', '0xmissing'] }],
                },
            }),
        });
        expect(getAccountsByWalletId('kid')).toHaveLength(1);
    });

    it('getAccountsByWalletId returns [] when keyrings is missing', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    internalAccounts: { accounts: {} },
                },
            }),
        });
        expect(getAccountsByWalletId('kid')).toEqual([]);
    });

    it('getConnectedAccountsForTab returns [] when no subject matches the origin', () => {
        (getReduxStore as jest.Mock).mockReturnValue({
            getState: () => ({
                globalState: {
                    subjects: {},
                    internalAccounts: { accounts: {} },
                },
            }),
        });
        expect(getConnectedAccountsForTab('https://nope')).toEqual([]);
    });
});
