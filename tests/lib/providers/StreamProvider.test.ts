import { Duplex } from 'readable-stream';
import { AbstractStreamProvider, StreamProvider } from '../../../src/lib/providers/StreamProvider';

jest.mock('nanoid', () => ({ nanoid: () => 'fixed-id' }));

jest.mock('@metamask/object-multiplex', () => {
    const { Duplex } = require('readable-stream');
    return {
        __esModule: true,
        default: class FakeObjectMultiplex extends Duplex {
            constructor() {
                super({ objectMode: true });
            }
            _read() {}
            _write(_chunk: any, _enc: any, cb: any) {
                cb();
            }
            createStream(_name: string) {
                const s = new Duplex({ objectMode: true });
                s._read = () => {};
                s._write = (_c: any, _e: any, cb: any) => cb();
                return s;
            }
        },
    };
});

const mockStreamMiddleware = jest.fn();

jest.mock('@metamask/json-rpc-middleware-stream', () => {
    const { Duplex } = require('readable-stream');
    const EventEmitter = require('events');
    return {
        createStreamMiddleware: (..._args: any[]) => {
            const stream: any = new Duplex({ objectMode: true });
            stream._read = () => {};
            stream._write = (_c: any, _e: any, cb: any) => cb();
            return {
                events: new EventEmitter(),
                middleware: mockStreamMiddleware,
                stream,
            };
        },
    };
});

jest.mock('../../../src/lib/permissions', () => ({
    NOTIFICATION_NAMES: {
        accountsChanged: 'metamask_accountsChanged',
        unlockStateChanged: 'metamask_unlockStateChanged',
        chainChanged: 'metamask_chainChanged',
    },
}));

jest.mock('../../../src/shared/constants/app', () => ({
    MESSAGE_TYPE: { GET_PROVIDER_STATE: 'chilly_getProviderState' },
}));

function makeStream() {
    const s = new Duplex({ objectMode: true });
    s._read = () => {};
    s._write = (_chunk: any, _enc: any, cb: any) => cb();
    return s;
}

function stubLog() {
    return {
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
    };
}

class TestStreamProvider extends AbstractStreamProvider {
    callHandleChain(opts: any) {
        this._handleChainChanged(opts);
    }
    async runInit() {
        return this._initializeStateAsync();
    }
    getJsonRpcConnection() {
        return this._jsonRpcConnection;
    }
}

describe('StreamProvider', () => {
    describe('module exports', () => {
        it('exports the StreamProvider and AbstractStreamProvider classes', () => {
            expect(typeof StreamProvider).toBe('function');
            expect(typeof AbstractStreamProvider).toBe('function');
        });
    });

    describe('constructor', () => {
        it('throws when the connection stream is not a duplex', () => {
            expect(
                () =>
                    new TestStreamProvider({} as any, {
                        jsonRpcStreamName: 'jr',
                        logger: stubLog(),
                    }),
            ).toThrow(/duplex/i);
        });

        it('wires up an instance with a real duplex stream', () => {
            const stream = makeStream();
            const provider = new TestStreamProvider(stream, {
                jsonRpcStreamName: 'jr',
                logger: stubLog(),
            });
            expect(provider).toBeInstanceOf(AbstractStreamProvider);
            expect(provider.getJsonRpcConnection()).toBeDefined();
        });
    });

    describe('chain change handling', () => {
        function buildProvider() {
            const log = stubLog();
            const provider = new TestStreamProvider(makeStream(), {
                jsonRpcStreamName: 'jr',
                logger: log,
            });
            return { provider, log };
        }

        it('ignores invalid chainId', () => {
            const { provider, log } = buildProvider();
            provider.callHandleChain({ chainId: 'not-hex', networkVersion: '1' });
            expect(log.error).toHaveBeenCalled();
        });

        it('disconnects (recoverably) when networkVersion is "loading"', () => {
            const { provider } = buildProvider();
            // Initialize so isConnected=true; then _handleDisconnect(true) clears isConnected.
            (provider as any)._initializeState({
                accounts: [],
                chainId: '0x1',
                isUnlocked: false,
            });
            const spy = jest.fn();
            provider.on('disconnect', spy);
            provider.callHandleChain({ chainId: '0x1', networkVersion: 'loading' });
            expect(spy).toHaveBeenCalled();
        });

        it('updates chain when both fields are valid', () => {
            const { provider } = buildProvider();
            // Initialize state so chainChanged actually fires
            (provider as any)._initializeState({
                accounts: [],
                chainId: '0x1',
                isUnlocked: false,
                networkVersion: '1',
            });
            const spy = jest.fn();
            provider.on('chainChanged', spy);
            provider.callHandleChain({ chainId: '0x5', networkVersion: '5' });
            expect(spy).toHaveBeenCalledWith('0x5');
        });
    });

    describe('notification handling', () => {
        it('forwards accountsChanged from the JSON-RPC connection', () => {
            const provider = new TestStreamProvider(makeStream(), {
                jsonRpcStreamName: 'jr',
                logger: stubLog(),
            });
            (provider as any)._initializeState({
                accounts: ['0xa'],
                chainId: '0x1',
                isUnlocked: true,
            });
            const spy = jest.fn();
            provider.on('accountsChanged', spy);
            provider.getJsonRpcConnection().events.emit('notification', {
                method: 'metamask_accountsChanged',
                params: ['0xb'],
            });
            expect(spy).toHaveBeenCalledWith(['0xb']);
        });

        it('forwards generic eth_subscription notification as message event', () => {
            const provider = new TestStreamProvider(makeStream(), {
                jsonRpcStreamName: 'jr',
                logger: stubLog(),
            });
            (provider as any)._initializeState({
                accounts: [],
                chainId: '0x1',
                isUnlocked: false,
            });
            const spy = jest.fn();
            provider.on('message', spy);
            provider.getJsonRpcConnection().events.emit('notification', {
                method: 'eth_subscription',
                params: { result: { foo: 'bar' } },
            });
            expect(spy).toHaveBeenCalledWith({
                type: 'eth_subscription',
                data: { result: { foo: 'bar' } },
            });
        });

        it('destroys the stream on CHILLY_STREAM_FAILURE', () => {
            const stream = makeStream();
            const destroySpy = jest.spyOn(stream, 'destroy');
            const provider = new TestStreamProvider(stream, {
                jsonRpcStreamName: 'jr',
                logger: stubLog(),
            });
            provider.getJsonRpcConnection().events.emit('notification', {
                method: 'CHILLY_STREAM_FAILURE',
                params: undefined,
            });
            expect(destroySpy).toHaveBeenCalled();
        });

        it('handles unlockStateChanged notification', () => {
            const provider = new TestStreamProvider(makeStream(), {
                jsonRpcStreamName: 'jr',
                logger: stubLog(),
            });
            provider.getJsonRpcConnection().events.emit('notification', {
                method: 'metamask_unlockStateChanged',
                params: { isUnlocked: true, accounts: [] },
            });
            // No throw means it was handled by the unlock branch.
            expect((provider as any)._state.isUnlocked).toBe(true);
        });
    });

    describe('initialize / _initializeStateAsync', () => {
        it('StreamProvider.initialize logs an error when request rejects', async () => {
            const log = stubLog();
            const provider = new StreamProvider(makeStream(), {
                jsonRpcStreamName: 'jr',
                logger: log,
            });
            // Force `request` to reject to exercise the error path.
            jest.spyOn(provider, 'request').mockRejectedValueOnce(new Error('no state'));
            await provider.initialize();
            expect(log.error).toHaveBeenCalled();
        });

        it('StreamProvider.initialize wires state when request resolves', async () => {
            const provider = new StreamProvider(makeStream(), {
                jsonRpcStreamName: 'jr',
                logger: stubLog(),
            });
            jest.spyOn(provider, 'request').mockResolvedValueOnce({
                accounts: ['0xa'],
                chainId: '0x5',
                isUnlocked: true,
                networkVersion: '5',
            } as any);
            await provider.initialize();
            expect(provider.chainId).toBe('0x5');
        });
    });

    describe('stream disconnect handling', () => {
        it('emits an error event when a listener is attached', () => {
            const provider = new TestStreamProvider(makeStream(), {
                jsonRpcStreamName: 'jr',
                logger: stubLog(),
            });
            const errSpy = jest.fn();
            provider.on('error', errSpy);
            (provider as any)._handleStreamDisconnect('TestStream', new Error('boom'));
            expect(errSpy).toHaveBeenCalled();
        });

        it('does not throw when no error listener is attached', () => {
            const provider = new TestStreamProvider(makeStream(), {
                jsonRpcStreamName: 'jr',
                logger: stubLog(),
            });
            expect(() =>
                (provider as any)._handleStreamDisconnect('TestStream', null),
            ).not.toThrow();
        });
    });
});
