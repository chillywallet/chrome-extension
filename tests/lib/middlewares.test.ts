import createOriginMiddleware from '../../src/lib/createOriginMiddleware';
import createTabIdMiddleware from '../../src/lib/createTabIdMiddleware';
import createLoggerMiddleware from '../../src/lib/createLoggerMiddleware';
import createDupeReqFilterMiddleware from '../../src/lib/createDupeReqFilterMiddleware';
import createSelectedNetworkMiddleware from '../../src/lib/createSelectedNetworkMiddleware';
import createProviderMiddleware from '../../src/lib/createProviderMiddleware';

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('createOriginMiddleware', () => {
    it('appends origin to the request and calls next', () => {
        const mw = createOriginMiddleware({ origin: 'https://example.com' });
        const req: any = {};
        const next = jest.fn();
        mw(req, {}, next);
        expect(req.origin).toBe('https://example.com');
        expect(next).toHaveBeenCalled();
    });
});

describe('createTabIdMiddleware', () => {
    it('appends tabId to the request and calls next', () => {
        const mw = createTabIdMiddleware({ tabId: 42 });
        const req: any = {};
        const next = jest.fn();
        mw(req, {}, next);
        expect(req.tabId).toBe(42);
        expect(next).toHaveBeenCalled();
    });
});

describe('createLoggerMiddleware', () => {
    it('logs RPC responses', () => {
        const logger = require('../../src/shared/utils/logger').default;
        const mw = createLoggerMiddleware({ origin: 'https://o' });

        const req = { method: 'foo' };
        const res = { result: 'ok' };
        const next = jest.fn();
        const end = jest.fn();
        mw(req, res, next, end);
        // simulate the next callback being invoked by the engine
        const cb = jest.fn();
        next.mock.calls[0][0](cb);
        expect(logger.log).toHaveBeenCalled();
        expect(cb).toHaveBeenCalled();
    });

    it('logs RPC errors', () => {
        const logger = require('../../src/shared/utils/logger').default;
        logger.log.mockClear();
        logger.error.mockClear();
        const mw = createLoggerMiddleware({ origin: 'https://o' });

        const req = { method: 'foo' };
        const res = { error: new Error('boom') };
        const next = jest.fn();
        mw(req, res, next, jest.fn());
        const cb = jest.fn();
        next.mock.calls[0][0](cb);
        expect(logger.error).toHaveBeenCalled();
        expect(cb).toHaveBeenCalled();
    });
});

describe('createDupeReqFilterMiddleware', () => {
    it('passes through new ids and filters dupes', () => {
        const mw = createDupeReqFilterMiddleware();
        const next1 = jest.fn();
        const end1 = jest.fn();
        mw({ id: 1 }, {}, next1, end1);
        expect(next1).toHaveBeenCalled();

        const next2 = jest.fn();
        const end2 = jest.fn();
        mw({ id: 1 }, {}, next2, end2);
        expect(next2).not.toHaveBeenCalled();
        expect(end2).toHaveBeenCalled();
    });
});

describe('createSelectedNetworkMiddleware', () => {
    it('appends networkId to the request', () => {
        const controller = {
            getSelectedNetwork: () => ({ chain_id: 137 }),
        };
        const mw = createSelectedNetworkMiddleware(controller as any);
        const req: any = {};
        const next = jest.fn();
        mw(req, {}, next);
        expect(req.networkId).toBe(137);
        expect(next).toHaveBeenCalled();
    });
});

describe('createProviderMiddleware', () => {
    it('forwards request to provider.send and sets res.result', async () => {
        const send = jest.fn(async () => 'ok');
        const getProvider = () => ({ send } as any);

        const mw = createProviderMiddleware(getProvider);
        const req: any = { method: 'eth_chainId', params: [] };
        const res: any = {};
        const end = jest.fn();
        mw(req, res, jest.fn(), end);

        await new Promise(resolve => setTimeout(resolve, 0));
        expect(send).toHaveBeenCalledWith('eth_chainId', []);
        expect(res.result).toBe('ok');
        expect(end).toHaveBeenCalled();
    });

    it('sets res.error when provider fails', async () => {
        const send = jest.fn(async () => {
            throw new Error('nope');
        });
        const getProvider = () => ({ send } as any);

        const mw = createProviderMiddleware(getProvider);
        const req: any = { method: 'eth_chainId', params: [] };
        const res: any = {};
        const end = jest.fn();
        mw(req, res, jest.fn(), end);

        await new Promise(resolve => setTimeout(resolve, 0));
        expect(res.error).toBeInstanceOf(Error);
        expect(end).toHaveBeenCalled();
    });
});
