import { selectHooks, createMethodMiddleware } from '../../src/lib/createMethodMiddleware';
import { UNSUPPORTED_RPC_METHODS } from '../../src/shared/constants/network';

jest.mock('nanoid', () => ({ nanoid: () => 'fixed-id' }));

describe('selectHooks', () => {
    it('returns undefined when hookNames is not provided', () => {
        expect(selectHooks({ a: 1 }, undefined as any)).toBeUndefined();
    });

    it('returns only requested hooks', () => {
        const hooks = { a: 1, b: 2, c: 3 };
        expect(selectHooks(hooks, { a: true, c: true })).toEqual({ a: 1, c: 3 });
    });

    it('returns undefined hooks for missing names', () => {
        const hooks = { a: 1 } as any;
        expect(selectHooks(hooks, { a: true, b: true })).toEqual({ a: 1, b: undefined });
    });
});

describe('createMethodMiddleware', () => {
    it('throws when expected hooks are missing', () => {
        // Passing an empty hooks object should fail with a list of missing names.
        expect(() => createMethodMiddleware({})).toThrow(/Missing expected hooks/);
    });

    it('rejects unsupported RPC methods with methodNotSupported', async () => {
        // Build a hooks bag that satisfies all expected hooks (use no-op fns).
        // The simplest way: discover required hooks by introspecting the error.
        let mw: any;
        try {
            createMethodMiddleware({});
        } catch (err: any) {
            const missing = err.message
                .split('\n')
                .filter((s: string) => s && !s.startsWith('Missing'));
            const hooks: Record<string, any> = {};
            missing.forEach((name: string) => (hooks[name] = jest.fn()));
            mw = createMethodMiddleware(hooks);
        }

        // Pick any method from UNSUPPORTED_RPC_METHODS to validate the rejection branch.
        const [unsupportedMethod] = Array.from(UNSUPPORTED_RPC_METHODS.values());
        if (!unsupportedMethod) {
            // If no unsupported methods are configured, skip the assertion
            return;
        }

        const end = jest.fn();
        await mw({ method: unsupportedMethod }, {}, jest.fn(), end);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ code: expect.any(Number) }));
    });

    it('falls through via next() for unknown methods', async () => {
        let mw: any;
        try {
            createMethodMiddleware({});
        } catch (err: any) {
            const missing = err.message
                .split('\n')
                .filter((s: string) => s && !s.startsWith('Missing'));
            const hooks: Record<string, any> = {};
            missing.forEach((name: string) => (hooks[name] = jest.fn()));
            mw = createMethodMiddleware(hooks);
        }

        const next = jest.fn();
        const end = jest.fn();
        await mw({ method: 'definitely_not_a_real_method' }, {}, next, end);
        expect(next).toHaveBeenCalled();
    });

    const buildHooksAndMw = (overrides: Record<string, any> = {}) => {
        let mw: any;
        let hooks: Record<string, any> = {};
        try {
            createMethodMiddleware({});
        } catch (err: any) {
            const missing = err.message
                .split('\n')
                .filter((s: string) => s && !s.startsWith('Missing'));
            missing.forEach((name: string) => (hooks[name] = jest.fn()));
        }
        hooks = { ...hooks, ...overrides };
        mw = createMethodMiddleware(hooks);
        return { mw, hooks };
    };

    it('invokes a known handler and resolves successfully', async () => {
        // eth_accounts is one of the simplest handlers, returning getAccounts()
        const getAccounts = jest.fn(async () => ['0xabc']);
        const { mw } = buildHooksAndMw({ getAccounts });

        const res: any = {};
        const end = jest.fn();
        const next = jest.fn();
        await mw({ method: 'eth_accounts' }, res, next, end);
        expect(getAccounts).toHaveBeenCalled();
        expect(res.result).toEqual(['0xabc']);
        expect(end).toHaveBeenCalled();
    });

    it('returns error via end() when handler throws', async () => {
        const boom = new Error('handler-explosion');
        const getAccounts = jest.fn(async () => {
            throw boom;
        });
        const { mw } = buildHooksAndMw({ getAccounts });

        const end = jest.fn();
        const next = jest.fn();
        await mw({ method: 'eth_accounts' }, {}, next, end);
        expect(end).toHaveBeenCalledWith(boom);
    });
});
