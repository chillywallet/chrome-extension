import requestAccounts from '../../../src/lib/rpc-method-middleware/request-accounts';

const invoke = async (hooks: any, origin = 'site.com') => {
    const res: any = {};
    const end = jest.fn();
    await requestAccounts.implementation({} as any, res, () => undefined as any, end, {
        origin,
        ...hooks,
    });
    return { res, end };
};

describe('request-accounts handler', () => {
    it('returns accounts when permission is granted', async () => {
        const { res, end } = await invoke({
            getAccounts: jest.fn(async () => ['0xa']),
            getUnlockPromise: jest.fn(async () => undefined),
            hasPermission: jest.fn(() => true),
            requestAccountsPermission: jest.fn(),
        });
        expect(res.result).toEqual(['0xa']);
        expect(end).toHaveBeenCalled();
    });

    it('requests permission and returns accounts when no permission yet', async () => {
        const requestAccountsPermission = jest.fn(async () => undefined);
        const { res } = await invoke({
            getAccounts: jest.fn(async () => ['0xa', '0xb']),
            getUnlockPromise: jest.fn(),
            hasPermission: jest.fn(() => false),
            requestAccountsPermission,
        });
        expect(requestAccountsPermission).toHaveBeenCalled();
        expect(res.result).toEqual(['0xa', '0xb']);
    });

    it('writes error when requestAccountsPermission throws', async () => {
        const err = new Error('rejected');
        const { res } = await invoke({
            getAccounts: jest.fn(async () => []),
            getUnlockPromise: jest.fn(),
            hasPermission: jest.fn(() => false),
            requestAccountsPermission: jest.fn().mockRejectedValueOnce(err),
        });
        expect(res.error).toBe(err);
    });

    it('writes internal error when accounts is empty after permission grant', async () => {
        const { res } = await invoke({
            getAccounts: jest.fn(async () => []),
            getUnlockPromise: jest.fn(),
            hasPermission: jest.fn(() => false),
            requestAccountsPermission: jest.fn(async () => undefined),
        });
        expect(res.error).toBeDefined();
        expect(res.error.message).toMatch(/unexpectedly unavailable/);
    });

    it('rejects on concurrent locks per origin', async () => {
        const slow = new Promise(resolve => setTimeout(resolve, 50));
        const hooks = {
            getAccounts: jest.fn(async () => ['0xa']),
            getUnlockPromise: jest.fn(async () => slow),
            hasPermission: jest.fn(() => true),
            requestAccountsPermission: jest.fn(),
        };
        const first = invoke(hooks, 'concurrent.test');
        const second = invoke(hooks, 'concurrent.test');
        const [_a, b] = await Promise.all([first, second]);
        expect(b.res.error).toBeDefined();
    });
});
