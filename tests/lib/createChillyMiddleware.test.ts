import createChillyMiddleware from '../../src/lib/createChillyMiddleware';

describe('createChillyMiddleware', () => {
    it('returns a scaffolded middleware that handles web3_clientVersion', async () => {
        const mw = createChillyMiddleware({
            version: '1.2.3',
            getAccounts: jest.fn(async () => ['0x0']),
            getUnlockPromise: jest.fn(async () => undefined),
        });

        const next = jest.fn();
        const end = jest.fn();
        const res: any = {};
        mw({ id: 1, jsonrpc: '2.0', method: 'web3_clientVersion', params: [] } as any, res, next, end);
        await new Promise(r => setTimeout(r, 0));

        expect(res.result).toBe('Chilly/v1.2.3');
        expect(end).toHaveBeenCalled();
    });

    it('returns eth_syncing=false from scaffold', async () => {
        const mw = createChillyMiddleware({
            version: '0.0.1',
            getAccounts: jest.fn(async () => []),
            getUnlockPromise: jest.fn(async () => undefined),
        });

        const next = jest.fn();
        const end = jest.fn();
        const res: any = {};
        mw({ id: 1, jsonrpc: '2.0', method: 'eth_syncing', params: [] } as any, res, next, end);
        await new Promise(r => setTimeout(r, 0));

        expect(res.result).toBe(false);
        expect(end).toHaveBeenCalled();
    });

    it('passes unknown methods through to next', async () => {
        const mw = createChillyMiddleware({
            version: '0.0.1',
            getAccounts: jest.fn(async () => []),
            getUnlockPromise: jest.fn(async () => undefined),
        });

        const next = jest.fn();
        const end = jest.fn();
        const res: any = {};
        mw({ id: 1, jsonrpc: '2.0', method: 'eth_chainId', params: [] } as any, res, next, end);
        await new Promise(r => setTimeout(r, 0));

        expect(next).toHaveBeenCalled();
    });
});
