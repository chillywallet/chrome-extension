import { createWalletMiddleware } from '../../src/lib/createWalletMiddleware';

const callMw = async (mw: any, method: string, params: any[]) => {
    const req: any = { id: 1, jsonrpc: '2.0', method, params };
    const res: any = {};
    const end = jest.fn();
    const next = jest.fn(cb => cb && cb());
    await mw(req, res, next, end);
    return { req, res, end, next };
};

const ADDR1 = '0x' + 'a'.repeat(40);
const ADDR2 = '0x' + 'b'.repeat(40);

describe('createWalletMiddleware', () => {
    it('throws if getAccounts is not provided', () => {
        expect(() => createWalletMiddleware({} as any)).toThrow(/getAccounts/);
    });

    it('eth_accounts returns the accounts from getAccounts', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
        });
        const { res } = await callMw(mw, 'eth_accounts', []);
        expect(res.result).toEqual([ADDR1]);
    });

    it('eth_sendTransaction calls processTransaction with normalized address', async () => {
        const processTransaction = jest.fn(async () => '0xhash');
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTransaction,
        });
        const { res } = await callMw(mw, 'eth_sendTransaction', [{ from: ADDR1.toUpperCase() }]);
        expect(processTransaction).toHaveBeenCalled();
        expect(res.result).toBe('0xhash');
    });

    it('eth_sendTransaction throws methodNotSupported without processTransaction', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
        });
        const { end } = await callMw(mw, 'eth_sendTransaction', [{ from: ADDR1 }]);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_sendTransaction rejects when from is unauthorized', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTransaction: jest.fn(async () => '0x'),
        });
        const { end } = await callMw(mw, 'eth_sendTransaction', [{ from: ADDR2 }]);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTransaction returns processSignTransaction result', async () => {
        const processSignTransaction = jest.fn(async () => '0xsigned');
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processSignTransaction,
        });
        const { res } = await callMw(mw, 'eth_signTransaction', [{ from: ADDR1 }]);
        expect(res.result).toBe('0xsigned');
    });

    it('eth_signTransaction without processor returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
        });
        const { end } = await callMw(mw, 'eth_signTransaction', [{ from: ADDR1 }]);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTypedData V1 invokes processTypedMessage', async () => {
        const processTypedMessage = jest.fn(async () => '0xsig');
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTypedMessage,
        });
        const { res } = await callMw(mw, 'eth_signTypedData', [[{ name: 'foo' }], ADDR1]);
        expect(processTypedMessage).toHaveBeenCalled();
        expect(res.result).toBe('0xsig');
    });

    it('eth_signTypedData V1 without handler returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
        });
        const { end } = await callMw(mw, 'eth_signTypedData', [[{ name: 'foo' }], ADDR1]);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTypedData_v3 invokes processTypedMessageV3', async () => {
        const processTypedMessageV3 = jest.fn(async () => '0xv3');
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTypedMessageV3,
        });
        const { res } = await callMw(mw, 'eth_signTypedData_v3', [ADDR1, '{"a":1}']);
        expect(processTypedMessageV3).toHaveBeenCalled();
        expect(res.result).toBe('0xv3');
    });

    it('eth_signTypedData_v4 invokes processTypedMessageV4', async () => {
        const processTypedMessageV4 = jest.fn(async () => '0xv4');
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTypedMessageV4,
        });
        const { res } = await callMw(mw, 'eth_signTypedData_v4', [ADDR1, '{"a":1}']);
        expect(processTypedMessageV4).toHaveBeenCalled();
        expect(res.result).toBe('0xv4');
    });

    it('personal_sign handles standard ordering (message first)', async () => {
        const processPersonalMessage = jest.fn(async () => '0xperson');
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processPersonalMessage,
        });
        const { res } = await callMw(mw, 'personal_sign', ['0xMSG', ADDR1]);
        expect(processPersonalMessage).toHaveBeenCalled();
        expect(res.result).toBe('0xperson');
    });

    it('personal_sign tolerates legacy ordering (address first)', async () => {
        const processPersonalMessage = jest.fn(async () => '0xperson');
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processPersonalMessage,
        });
        const { res } = await callMw(mw, 'personal_sign', [ADDR1, 'hello']);
        expect(processPersonalMessage).toHaveBeenCalled();
        expect((res as any).warning).toMatch(/param order/);
    });

    it('personal_sign without handler returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
        });
        const { end } = await callMw(mw, 'personal_sign', ['msg', ADDR1]);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_sendTransaction with invalid params returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTransaction: jest.fn(),
        });
        const { end } = await callMw(mw, 'eth_sendTransaction', []);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTransaction with invalid params returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processSignTransaction: jest.fn(),
        });
        const { end } = await callMw(mw, 'eth_signTransaction', []);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTypedData V1 with invalid params returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTypedMessage: jest.fn(),
        });
        const { end } = await callMw(mw, 'eth_signTypedData', []);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTypedData_v3 without handler returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
        });
        const { end } = await callMw(mw, 'eth_signTypedData_v3', [ADDR1, '{"a":1}']);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTypedData_v3 with invalid params returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTypedMessageV3: jest.fn(),
        });
        const { end } = await callMw(mw, 'eth_signTypedData_v3', []);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTypedData_v4 without handler returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
        });
        const { end } = await callMw(mw, 'eth_signTypedData_v4', [ADDR1, '{"a":1}']);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTypedData_v4 with invalid params returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTypedMessageV4: jest.fn(),
        });
        const { end } = await callMw(mw, 'eth_signTypedData_v4', []);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('personal_sign with invalid params returns error', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processPersonalMessage: jest.fn(),
        });
        const { end } = await callMw(mw, 'personal_sign', []);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_sendTransaction with missing from falls back to empty-string branch', async () => {
        // params[0] exists but no .from triggers the `params?.from || ''` fallback,
        // which causes validateAndNormalizeKeyholder to throw invalidParams.
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTransaction: jest.fn(async () => '0x'),
        });
        const { end } = await callMw(mw, 'eth_sendTransaction', [{}]);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('eth_signTransaction with missing from falls back to empty-string branch', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processSignTransaction: jest.fn(async () => '0x'),
        });
        const { end } = await callMw(mw, 'eth_signTransaction', [{}]);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('rejects with invalidParams when address is not a valid hex string', async () => {
        const mw: any = createWalletMiddleware({
            getAccounts: jest.fn(async () => [ADDR1]),
            getUnlockPromise: jest.fn(async () => undefined),
            processTransaction: jest.fn(async () => '0xhash'),
        });
        const { end } = await callMw(mw, 'eth_sendTransaction', [{ from: 'not-an-address' }]);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
});
