import {
    createPendingNonceMiddleware,
    createPendingTxMiddleware,
    formatTxMetaForRpcResult,
} from '../../src/lib/createPendingMiddleware';

describe('formatTxMetaForRpcResult', () => {
    it('formats a legacy transaction', () => {
        const result = formatTxMetaForRpcResult({
            r: '0xr',
            s: '0xs',
            v: '0xv',
            hash: '0xhash',
            txParams: {
                to: '0xto',
                data: '0xdata',
                nonce: 5,
                gas: '0x5208',
                from: '0xfrom',
                value: '0x10',
                gasPrice: '0x1',
            },
        });

        expect(result.type).toBe('0x0');
        expect(result.gasPrice).toBe('0x1');
        expect(result.nonce).toBe('5');
        expect(result.input).toBe('0xdata');
        expect(result.value).toBe('0x10');
        expect(result.blockHash).toBeNull();
    });

    it('formats an EIP-1559 transaction', () => {
        const result = formatTxMetaForRpcResult({
            txParams: {
                to: '0xto',
                from: '0xfrom',
                nonce: 1,
                maxFeePerGas: '0x100',
                maxPriorityFeePerGas: '0x1',
            },
            txReceipt: { blockHash: '0xb', blockNumber: '0x1', transactionIndex: '0x0' },
        });

        expect(result.type).toBe('0x2');
        expect(result.maxFeePerGas).toBe('0x100');
        expect(result.maxPriorityFeePerGas).toBe('0x1');
        expect(result.gasPrice).toBe('0x100');
        expect(result.blockHash).toBe('0xb');
    });

    it('defaults missing input and value', () => {
        const result = formatTxMetaForRpcResult({
            txParams: { from: '0x', nonce: 0, gasPrice: '0x1' },
        });
        expect(result.input).toBe('0x');
        expect(result.value).toBe('0x0');
        expect(result.accessList).toBeNull();
    });
});

describe('createPendingNonceMiddleware', () => {
    it('returns pending nonce when method matches', async () => {
        const getPendingNonce = jest.fn(async () => '0x5');
        const middleware = createPendingNonceMiddleware({ getPendingNonce });

        const req: any = {
            method: 'eth_getTransactionCount',
            params: ['0xaddr', 'pending'],
        };
        const res: any = {};
        await new Promise<void>(resolve => middleware(req, res, () => resolve(), () => resolve()));
        expect(res.result).toBe('0x5');
        expect(getPendingNonce).toHaveBeenCalled();
    });

    it('calls next for non-matching methods', async () => {
        const middleware = createPendingNonceMiddleware({
            getPendingNonce: jest.fn(),
        });
        let nextCalled = false;
        await new Promise<void>(resolve =>
            middleware(
                { method: 'foo', params: [] } as any,
                {} as any,
                () => {
                    nextCalled = true;
                    resolve();
                },
                () => resolve(),
            ),
        );
        expect(nextCalled).toBe(true);
    });

    it('calls next when blockRef is not pending', async () => {
        const middleware = createPendingNonceMiddleware({
            getPendingNonce: jest.fn(),
        });
        let nextCalled = false;
        await new Promise<void>(resolve =>
            middleware(
                { method: 'eth_getTransactionCount', params: ['0xa', 'latest'] } as any,
                {} as any,
                () => {
                    nextCalled = true;
                    resolve();
                },
                () => resolve(),
            ),
        );
        expect(nextCalled).toBe(true);
    });
});

describe('createPendingTxMiddleware', () => {
    it('returns formatted tx when found', async () => {
        const getPendingTransactionByHash = jest.fn(() => ({
            txParams: { from: '0xa', gasPrice: '0x1' },
        }));
        const middleware = createPendingTxMiddleware({
            getPendingTransactionByHash,
        });

        const res: any = {};
        await new Promise<void>(resolve =>
            middleware(
                { method: 'eth_getTransactionByHash', params: ['0xhash'] } as any,
                res,
                () => resolve(),
                () => resolve(),
            ),
        );
        expect(res.result).toBeDefined();
    });

    it('calls next for non-matching methods', async () => {
        const middleware = createPendingTxMiddleware({
            getPendingTransactionByHash: jest.fn(),
        });
        let nextCalled = false;
        await new Promise<void>(resolve =>
            middleware(
                { method: 'foo', params: [] } as any,
                {} as any,
                () => {
                    nextCalled = true;
                    resolve();
                },
                () => resolve(),
            ),
        );
        expect(nextCalled).toBe(true);
    });

    it('calls next when tx is unknown', async () => {
        const middleware = createPendingTxMiddleware({
            getPendingTransactionByHash: () => undefined,
        });
        let nextCalled = false;
        await new Promise<void>(resolve =>
            middleware(
                { method: 'eth_getTransactionByHash', params: ['0xhash'] } as any,
                {} as any,
                () => {
                    nextCalled = true;
                    resolve();
                },
                () => resolve(),
            ),
        );
        expect(nextCalled).toBe(true);
    });
});
