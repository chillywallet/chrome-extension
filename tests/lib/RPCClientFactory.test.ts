import EventEmitter from 'events';
import createRPCClientFactory from '../../src/lib/RPCClientFactory';

class FakeStream extends EventEmitter {
    written: any[] = [];
    write(payload: any) {
        this.written.push(payload);
    }
}

describe('createRPCClientFactory', () => {
    it('returns a proxy that exposes the underlying client API', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        expect(typeof client.send).toBe('function');
        expect(typeof client.onNotification).toBe('function');
        expect(typeof client.onUncaughtError).toBe('function');
    });

    it('forwards arbitrary method calls as a JSON-RPC request', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const cb = jest.fn();
        client.fooMethod('a', 1, cb);
        expect(stream.written.length).toBe(1);
        const payload = stream.written[0];
        expect(payload.jsonrpc).toBe('2.0');
        expect(payload.method).toBe('fooMethod');
        expect(payload.params).toEqual(['a', 1]);
        expect(typeof payload.id).toBe('number');
    });

    it('routes responses to the original callback', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const cb = jest.fn();
        client.someMethod(cb);
        const payload = stream.written[0];
        stream.emit('data', { id: payload.id, result: { ok: true } });
        expect(cb).toHaveBeenCalledWith(null, { ok: true });
    });

    it('converts RPC error responses to EthereumRpcError instances', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const cb = jest.fn();
        client.failMethod(cb);
        const payload = stream.written[0];
        stream.emit('data', {
            id: payload.id,
            error: { code: -32000, message: 'bad', data: {} },
        });
        expect(cb).toHaveBeenCalledTimes(1);
        const [err] = cb.mock.calls[0];
        expect(err.message).toBe('bad');
    });

    it('emits server-side notifications via notificationChannel', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const handler = jest.fn();
        client.onNotification(handler);
        stream.emit('data', { method: 'updateState', params: { v: 1 } });
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ method: 'updateState' }));
    });

    it('emits uncaught errors when error has no associated id', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const handler = jest.fn();
        client.onUncaughtError(handler);
        stream.emit('data', { error: { code: -32000, message: 'orphan' } });
        expect(handler).toHaveBeenCalled();
    });

    it('fails outstanding requests with DisconnectError on close', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const cb = jest.fn();
        client.willHang(cb);
        stream.emit('end');
        expect(cb).toHaveBeenCalled();
        const err = cb.mock.calls[0][0];
        expect(err).toBeInstanceOf(Error);
    });

    it('times out a getState request when no response arrives in 10s', () => {
        jest.useFakeTimers();
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const cb = jest.fn();
        client.getState(cb);
        jest.advanceTimersByTime(11_000);
        expect(cb).toHaveBeenCalledWith(expect.any(Error), null);
        jest.useRealTimers();
    });

    it('does not call back twice when getState response arrives before timeout', () => {
        jest.useFakeTimers();
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const cb = jest.fn();
        client.getState(cb);
        const payload = stream.written[0];
        stream.emit('data', { id: payload.id, result: { ok: true } });
        jest.advanceTimersByTime(11_000);
        expect(cb).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });

    it('ignores server-side request messages (method + params + id present)', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        const handler = jest.fn();
        client.onNotification(handler);
        // id present → not a notification, but method+params → server-side request → ignored
        stream.emit('data', { id: 99, method: 'serverCall', params: { x: 1 } });
        expect(handler).not.toHaveBeenCalled();
    });

    it('skips response with no callback (silent drop)', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        // No request → no callback registered
        // Should not throw
        stream.emit('data', { id: 12345, result: 'x' });
    });

    it('proxy returns existing properties directly without invoking send', () => {
        const stream = new FakeStream() as any;
        const client = createRPCClientFactory(stream);
        // accessing `requests` (existing field on RPCClient) returns the map, not a sender fn
        expect(client.requests).toBeInstanceOf(Map);
    });
});
