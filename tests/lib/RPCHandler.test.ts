import createRPCHandler from '../../src/lib/RPCHandler';

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const makeWritableStream = (overrides: Partial<any> = {}) => ({
    writable: true,
    destroyed: false,
    write: jest.fn(),
    ...overrides,
});

describe('createRPCHandler', () => {
    it('returns method-not-found error for unknown methods', async () => {
        const api = {};
        const outStream = makeWritableStream();
        const handler = createRPCHandler(api, outStream, undefined, undefined);

        await handler({ id: 1, method: 'unknown', params: [] });
        expect(outStream.write).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 1,
                error: expect.objectContaining({ code: expect.any(Number) }),
            }),
        );
    });

    it('calls API method and writes result with deserialized params and serialized result', async () => {
        const api = {
            sum: jest.fn(async (a: number, b: number) => a + b),
        };
        const outStream = makeWritableStream();
        const handler = createRPCHandler(api, outStream, undefined, undefined);

        await handler({ id: 2, method: 'sum', params: [1, 2] });
        expect(api.sum).toHaveBeenCalledWith(1, 2);
        expect(outStream.write).toHaveBeenCalledWith({
            jsonrpc: '2.0',
            result: 3,
            id: 2,
        });
    });

    it('writes serialized error when API method throws', async () => {
        const api = {
            boom: jest.fn(async () => {
                throw new Error('nope');
            }),
        };
        const outStream = makeWritableStream();
        const handler = createRPCHandler(api, outStream, undefined, undefined);

        await handler({ id: 3, method: 'boom', params: [] });
        expect(outStream.write).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 3,
                error: expect.any(Object),
            }),
        );
    });

    it('returns early when stream is not writable', async () => {
        const api = { foo: jest.fn() };
        const outStream = makeWritableStream({ writable: false });
        const handler = createRPCHandler(api, outStream, undefined, undefined);

        await handler({ id: 4, method: 'foo', params: [] });
        expect(outStream.write).not.toHaveBeenCalled();
        expect(api.foo).not.toHaveBeenCalled();
    });

    it('persists store state after non-getState method', async () => {
        const api = { foo: jest.fn(async () => 'x') };
        const outStream = makeWritableStream();
        const store = { getState: jest.fn(() => ({ count: 1 })) };
        const localStoreApiWrapper = { set: jest.fn() };

        const handler = createRPCHandler(api, outStream, store, localStoreApiWrapper);
        await handler({ id: 5, method: 'foo', params: [] });

        expect(localStoreApiWrapper.set).toHaveBeenCalledWith({ count: 1 });
    });

    it('does not persist store state after getState method', async () => {
        const api = { getState: jest.fn(async () => ({ count: 2 })) };
        const outStream = makeWritableStream();
        const store = { getState: jest.fn(() => ({ count: 2 })) };
        const localStoreApiWrapper = { set: jest.fn() };

        const handler = createRPCHandler(api, outStream, store, localStoreApiWrapper);
        await handler({ id: 6, method: 'getState', params: [] });

        expect(localStoreApiWrapper.set).not.toHaveBeenCalled();
    });
});
