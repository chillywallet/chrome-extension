import {
    getPermittedAccountsByOrigin,
    getChangedAccounts,
} from '../../../src/lib/permissions/selectors';

describe('getPermittedAccountsByOrigin', () => {
    it('builds an origin -> accounts map from caveats', () => {
        // selector is memoized; pass fresh state each call
        const state = {
            subjects: {
                'https://a.example': {
                    origin: 'https://a.example',
                    permissions: {
                        eth_accounts: {
                            caveats: [
                                {
                                    type: 'restrictReturnedAccounts',
                                    value: ['0xabc'],
                                },
                            ],
                        },
                    },
                },
            },
        };
        const result = getPermittedAccountsByOrigin(state as any);
        expect(result.get('https://a.example')).toEqual(['0xabc']);
    });

    it('skips subjects without restrictReturnedAccounts caveat', () => {
        const state = {
            subjects: {
                'https://x.example': {
                    origin: 'https://x.example',
                    permissions: {
                        eth_accounts: { caveats: [{ type: 'other' }] },
                    },
                },
            },
        };
        const result = getPermittedAccountsByOrigin(state as any);
        expect(result.size).toBe(0);
    });
});

describe('getChangedAccounts', () => {
    it('returns the new map when previous is undefined', () => {
        const next = new Map([['a', ['x']]]);
        expect(getChangedAccounts(next, undefined as any)).toBe(next);
    });

    it('returns empty when maps are reference-equal', () => {
        const map = new Map([['a', ['x']]]);
        expect(getChangedAccounts(map, map).size).toBe(0);
    });

    it('reports diffs for origins with changed account refs', () => {
        const prev = new Map([['a', ['x']]]);
        const next = new Map([['a', ['x', 'y']]]);
        const diff = getChangedAccounts(next, prev);
        expect(diff.get('a')).toEqual(['x', 'y']);
    });

    it('reports removed origins as empty arrays', () => {
        const prev = new Map([['a', ['x']]]);
        const next = new Map<string, string[]>();
        const diff = getChangedAccounts(next, prev);
        expect(diff.get('a')).toEqual([]);
    });

    it('reports new origins as additions', () => {
        const prev = new Map<string, string[]>();
        const next = new Map([['b', ['y']]]);
        const diff = getChangedAccounts(next, prev);
        expect(diff.get('b')).toEqual(['y']);
    });
});

describe('extra branch coverage', () => {
    it('skips subjects without a permissions.eth_accounts key (covers `?? []` fallback)', () => {
        const state = {
            subjects: {
                'https://nopermissions.example': {
                    origin: 'https://nopermissions.example',
                    permissions: {},
                },
            },
        };
        const result = getPermittedAccountsByOrigin(state as any);
        expect(result.size).toBe(0);
    });

    it('treats identical origin->accounts refs as unchanged in diff', () => {
        const shared = ['x'];
        const prev = new Map([['a', shared]]);
        const next = new Map([['a', shared]]);
        const diff = getChangedAccounts(next, prev);
        // No new origins, no changed refs → empty diff
        expect(diff.size).toBe(0);
    });
});
