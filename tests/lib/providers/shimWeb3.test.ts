import { shimWeb3 } from '../../../src/lib/providers/shimWeb3';

describe('shimWeb3', () => {
    let originalWeb3: any;
    beforeEach(() => {
        originalWeb3 = (window as any).web3;
        delete (window as any).web3;
    });
    afterEach(() => {
        try {
            delete (window as any).web3;
        } catch {
            // ignore
        }
        if (originalWeb3 !== undefined) {
            (window as any).web3 = originalWeb3;
        }
    });

    it('does nothing if window.web3 already exists', () => {
        (window as any).web3 = { foo: 'bar' };
        const provider: any = { request: jest.fn() };
        shimWeb3(provider);
        expect((window as any).web3.foo).toBe('bar');
    });

    it('installs a shim with currentProvider when web3 is missing', () => {
        const provider: any = { request: jest.fn(() => Promise.resolve()) };
        const log = { warn: jest.fn(), error: jest.fn(), debug: jest.fn(), log: jest.fn(), info: jest.fn(), trace: jest.fn() };
        shimWeb3(provider, log);
        expect((window as any).web3).toBeDefined();
        expect((window as any).web3.currentProvider).toBe(provider);
    });

    it('logs a deprecation warning on first currentProvider access', () => {
        const provider: any = { request: jest.fn(() => Promise.resolve()) };
        const log = { warn: jest.fn(), error: jest.fn(), debug: jest.fn(), log: jest.fn(), info: jest.fn(), trace: jest.fn() };
        shimWeb3(provider, log);
        const _ = (window as any).web3.currentProvider;
        // access twice, only one warn expected
        const __ = (window as any).web3.currentProvider;
        expect(log.warn).toHaveBeenCalledTimes(1);
    });

    it('logs an error and calls request for other property access', () => {
        const provider: any = { request: jest.fn(() => Promise.resolve()) };
        const log = { warn: jest.fn(), error: jest.fn(), debug: jest.fn(), log: jest.fn(), info: jest.fn(), trace: jest.fn() };
        shimWeb3(provider, log);
        const _ = (window as any).web3.unknownThing;
        expect(log.error).toHaveBeenCalled();
        expect(provider.request).toHaveBeenCalledWith({ method: 'chilly_logWeb3ShimUsage' });
    });

    it('proxies sets and warns', () => {
        const provider: any = { request: jest.fn(() => Promise.resolve()) };
        const log = { warn: jest.fn(), error: jest.fn(), debug: jest.fn(), log: jest.fn(), info: jest.fn(), trace: jest.fn() };
        shimWeb3(provider, log);
        (window as any).web3.foo = 'bar';
        expect(log.warn).toHaveBeenCalled();
    });

    it('logs via debug when provider.request rejects on shim-usage logging', async () => {
        const err = new Error('rpc-down');
        const provider: any = { request: jest.fn(() => Promise.reject(err)) };
        const log = { warn: jest.fn(), error: jest.fn(), debug: jest.fn(), log: jest.fn(), info: jest.fn(), trace: jest.fn() };
        shimWeb3(provider, log);
        const _ = (window as any).web3.unknownThing;
        // wait for the rejected promise's catch handler to run
        await Promise.resolve();
        await Promise.resolve();
        expect(log.debug).toHaveBeenCalledWith('Chilly: Failed to log web3 shim usage.', err);
    });
});
