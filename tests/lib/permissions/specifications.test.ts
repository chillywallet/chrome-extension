import {
    getCaveatSpecifications,
    getPermissionSpecifications,
    unrestrictedMethods,
} from '../../../src/lib/permissions/specifications';

const internalAccounts = () => [
    { address: '0xabc', smartAddress: '0xdef' } as any,
];

describe('unrestrictedMethods', () => {
    it('contains common eth methods', () => {
        expect(unrestrictedMethods).toContain('eth_chainId');
        expect(unrestrictedMethods).toContain('eth_blockNumber');
    });
});

describe('getCaveatSpecifications', () => {
    it('exposes a restrictReturnedAccounts spec with decorator and validator', () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        const spec = specs.restrictReturnedAccounts;
        expect(typeof spec.decorator).toBe('function');
        expect(typeof spec.validator).toBe('function');
    });

    it('decorator filters returned accounts via the caveat value', async () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        const decorated = specs.restrictReturnedAccounts.decorator(
            async () => [{ address: '0xabc', smartAddress: '0xdef' }],
            { value: ['0xabc'] },
        );
        const result = await decorated({});
        expect(result).toContain('0xabc');
        expect(result).not.toContain('0xdef');
    });

    it('validator throws when caveat value is empty', () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.restrictReturnedAccounts.validator({ value: [] }, 'origin', 'target'),
        ).toThrow();
    });

    it('validator throws when account is unknown', () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.restrictReturnedAccounts.validator(
                { value: ['0xnotknown'] },
                'origin',
                'target',
            ),
        ).toThrow(/unrecognized/);
    });

    it('validator accepts a known account address', () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.restrictReturnedAccounts.validator(
                { value: ['0xabc'] },
                'origin',
                'target',
            ),
        ).not.toThrow();
    });
});

describe('getPermissionSpecifications', () => {
    it('exposes an eth_accounts permission with factory and validator', () => {
        const specs = getPermissionSpecifications({ getInternalAccounts: internalAccounts });
        const spec = specs.eth_accounts;
        expect(typeof spec.factory).toBe('function');
        expect(typeof spec.validator).toBe('function');
        expect(typeof spec.methodImplementation).toBe('function');
    });

    it('factory throws when approvedAccounts missing', () => {
        const specs = getPermissionSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.eth_accounts.factory({ target: 'eth_accounts' } as any, {} as any),
        ).toThrow(/approved accounts/);
    });

    it('validator throws when caveats are malformed', () => {
        const specs = getPermissionSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.eth_accounts.validator(
                { caveats: [] } as any,
                'origin',
                'target',
            ),
        ).toThrow();
    });

    it('methodImplementation returns internal accounts', async () => {
        const specs = getPermissionSpecifications({ getInternalAccounts: internalAccounts });
        const result = await specs.eth_accounts.methodImplementation({} as any);
        expect(result).toHaveLength(1);
    });

    it('factory constructs a permission with the restrictReturnedAccounts caveat', () => {
        const specs = getPermissionSpecifications({ getInternalAccounts: internalAccounts });
        const permission = specs.eth_accounts.factory(
            { target: 'eth_accounts', invoker: 'https://dapp.example' } as any,
            { approvedAccounts: ['0xabc'] } as any,
        );
        expect(permission.caveats).toEqual([
            { type: 'restrictReturnedAccounts', value: ['0xabc'] },
        ]);
    });

    it('validator throws when caveats are missing entirely', () => {
        const specs = getPermissionSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.eth_accounts.validator({} as any, 'origin', 'target'),
        ).toThrow(/Invalid caveats/);
    });

    it('validator throws when caveat type is wrong', () => {
        const specs = getPermissionSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.eth_accounts.validator(
                { caveats: [{ type: 'somethingElse', value: ['0xabc'] }] } as any,
                'origin',
                'target',
            ),
        ).toThrow(/Invalid caveats/);
    });

    it('validator passes when caveats are well-formed', () => {
        const specs = getPermissionSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.eth_accounts.validator(
                {
                    caveats: [
                        { type: 'restrictReturnedAccounts', value: ['0xabc'] },
                    ],
                } as any,
                'origin',
                'target',
            ),
        ).not.toThrow();
    });
});

describe('getCaveatSpecifications - additional cases', () => {
    it('validator throws when accounts contains a non-string entry', () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.restrictReturnedAccounts.validator(
                { value: [123 as any] },
                'origin',
                'target',
            ),
        ).toThrow(/Expected an array of Ethereum addresses/);
    });

    it('validator throws when accounts is not an array', () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.restrictReturnedAccounts.validator(
                { value: 'not-an-array' as any },
                'origin',
                'target',
            ),
        ).toThrow(/non-empty array/);
    });

    it('validator accepts a known smart account address', () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        expect(() =>
            specs.restrictReturnedAccounts.validator(
                { value: ['0xdef'] },
                'origin',
                'target',
            ),
        ).not.toThrow();
    });

    it('decorator includes smart account addresses when in caveat value', async () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        const decorated = specs.restrictReturnedAccounts.decorator(
            async () => [{ address: '0xabc', smartAddress: '0xdef' }],
            { value: ['0xabc', '0xdef'] },
        );
        const result = await decorated({});
        expect(result).toEqual(expect.arrayContaining(['0xabc', '0xdef']));
    });

    it('decorator skips smart address when missing', async () => {
        const specs = getCaveatSpecifications({ getInternalAccounts: internalAccounts });
        const decorated = specs.restrictReturnedAccounts.decorator(
            async () => [{ address: '0xabc' }],
            { value: ['0xabc'] },
        );
        const result = await decorated({});
        expect(result).toEqual(['0xabc']);
    });
});
