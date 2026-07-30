import {
    EMITTED_NOTIFICATIONS,
    NOOP,
    createRpcWarningMiddleware,
    getDefaultExternalMiddleware,
    getRpcPromiseCallback,
    isValidChainId,
    isValidNetworkVersion,
} from '../../../src/lib/providers/utils';

const stubLog = () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    trace: jest.fn(),
});

describe('providers/utils', () => {
    it('exposes EMITTED_NOTIFICATIONS', () => {
        expect(EMITTED_NOTIFICATIONS).toContain('eth_subscription');
    });

    it('NOOP returns undefined', () => {
        expect(NOOP()).toBeUndefined();
    });

    it('isValidChainId requires 0x prefix', () => {
        expect(isValidChainId('0x1')).toBe(true);
        expect(isValidChainId('1')).toBe(false);
        expect(isValidChainId(1)).toBe(false);
        expect(isValidChainId('')).toBe(false);
    });

    it('isValidNetworkVersion accepts non-empty strings', () => {
        expect(isValidNetworkVersion('1')).toBe(true);
        expect(isValidNetworkVersion('')).toBe(false);
        expect(isValidNetworkVersion(1)).toBe(false);
    });

    describe('createRpcWarningMiddleware', () => {
        it('warns once for deprecated eth_decrypt', () => {
            const log = stubLog();
            const mw = createRpcWarningMiddleware(log);
            const next = jest.fn();
            mw({ method: 'eth_decrypt' } as any, {} as any, next);
            mw({ method: 'eth_decrypt' } as any, {} as any, next);
            expect(log.warn).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledTimes(2);
        });

        it('warns once for deprecated eth_getEncryptionPublicKey', () => {
            const log = stubLog();
            const mw = createRpcWarningMiddleware(log);
            mw({ method: 'eth_getEncryptionPublicKey' } as any, {} as any, jest.fn());
            expect(log.warn).toHaveBeenCalled();
        });

        it('warns for wallet_watchAsset with ERC721 type', () => {
            const log = stubLog();
            const mw = createRpcWarningMiddleware(log);
            mw(
                {
                    method: 'wallet_watchAsset',
                    params: { type: 'ERC721' },
                } as any,
                {} as any,
                jest.fn(),
            );
            expect(log.warn).toHaveBeenCalled();
        });

        it('does not warn for unrelated methods', () => {
            const log = stubLog();
            const mw = createRpcWarningMiddleware(log);
            mw({ method: 'eth_chainId' } as any, {} as any, jest.fn());
            expect(log.warn).not.toHaveBeenCalled();
        });

        it('handles wallet_watchAsset without params', () => {
            const log = stubLog();
            const mw = createRpcWarningMiddleware(log);
            mw({ method: 'wallet_watchAsset' } as any, {} as any, jest.fn());
            expect(log.warn).not.toHaveBeenCalled();
        });

        it('warns for wallet_watchAsset with ERC1155 type', () => {
            const log = stubLog();
            const mw = createRpcWarningMiddleware(log);
            mw(
                { method: 'wallet_watchAsset', params: { type: 'ERC1155' } } as any,
                {} as any,
                jest.fn(),
            );
            expect(log.warn).toHaveBeenCalled();
        });
    });

    describe('getDefaultExternalMiddleware', () => {
        it('returns an array of middleware', () => {
            const middleware = getDefaultExternalMiddleware();
            expect(Array.isArray(middleware)).toBe(true);
            expect(middleware.length).toBeGreaterThanOrEqual(3);
        });

        it('error middleware sets response.error for non-string method', () => {
            const log = stubLog();
            const [, errorMw] = getDefaultExternalMiddleware(log);
            const response: any = {};
            const next = jest.fn((cb: any) => cb && cb(jest.fn()));
            errorMw({ method: 42 } as any, response, next as any);
            expect(response.error).toBeDefined();
        });

        it('error middleware sets response.error for empty method', () => {
            const log = stubLog();
            const [, errorMw] = getDefaultExternalMiddleware(log);
            const response: any = {};
            const next = jest.fn((cb: any) => cb && cb(jest.fn()));
            errorMw({ method: '' } as any, response, next as any);
            expect(response.error).toBeDefined();
        });

        it('error middleware logs warning when next reports an error', () => {
            const log = stubLog();
            const [, errorMw] = getDefaultExternalMiddleware(log);
            const response: any = { error: { message: 'fail' } };
            const next = jest.fn((cb: any) => cb && cb(jest.fn()));
            errorMw({ method: 'eth_chainId' } as any, response, next as any);
            expect(log.warn).toHaveBeenCalled();
        });

        it('error middleware does not warn when next has no error', () => {
            const log = stubLog();
            const [, errorMw] = getDefaultExternalMiddleware(log);
            const response: any = {};
            const next = jest.fn((cb: any) => cb && cb(jest.fn()));
            errorMw({ method: 'eth_chainId' } as any, response, next as any);
            expect(log.warn).not.toHaveBeenCalled();
        });

        it('uses console by default', () => {
            const middleware = getDefaultExternalMiddleware();
            expect(middleware.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('getRpcPromiseCallback', () => {
        it('resolves with the unwrapped result', () => {
            const resolve = jest.fn();
            const reject = jest.fn();
            const cb = getRpcPromiseCallback(resolve, reject);
            cb(null as any, { result: 42 } as any);
            expect(resolve).toHaveBeenCalledWith(42);
        });

        it('rejects on error', () => {
            const resolve = jest.fn();
            const reject = jest.fn();
            const cb = getRpcPromiseCallback(resolve, reject);
            const err = new Error('boom');
            cb(err, {} as any);
            expect(reject).toHaveBeenCalledWith(err);
        });

        it('rejects on response.error', () => {
            const resolve = jest.fn();
            const reject = jest.fn();
            const cb = getRpcPromiseCallback(resolve, reject);
            cb(null as any, { error: { message: 'bad' } } as any);
            expect(reject).toHaveBeenCalled();
        });

        it('returns the whole response when unwrapResult=false', () => {
            const resolve = jest.fn();
            const reject = jest.fn();
            const cb = getRpcPromiseCallback(resolve, reject, false);
            cb(null as any, { result: 1 } as any);
            expect(resolve).toHaveBeenCalledWith({ result: 1 });
        });
    });
});
