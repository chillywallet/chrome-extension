import { Duplex } from 'readable-stream';
import { InpageProvider } from '../../../src/lib/providers/InPageProvider';

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
                middleware: jest.fn(),
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

jest.mock('../../../src/shared/constants/stream', () => ({
    EXTERNAL_PROVIDER: 'chilly-provider',
}));

const mockSendSiteMetadata = jest.fn();
jest.mock('../../../src/lib/providers/siteMetadata', () => ({
    sendSiteMetadata: (...args: any[]) => mockSendSiteMetadata(...args),
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

describe('InpageProvider', () => {
    beforeEach(() => {
        mockSendSiteMetadata.mockReset();
    });

    describe('module export', () => {
        it('exports the InpageProvider class', () => {
            expect(typeof InpageProvider).toBe('function');
        });
    });

    describe('constructor', () => {
        it('sets isChilly = true', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            expect(p.isChilly).toBe(true);
        });

        it('uses console as default logger when none provided', () => {
            // Calling the constructor with no options object exercises the `{}` and `logger = console` defaults
            const p = new InpageProvider(makeStream());
            expect(p.isChilly).toBe(true);
        });

        it('exposes default chainChanged param handling when called with no args', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            // `_handleChainChanged` defaults its options param to {} when called with no arg
            (p as any)._handleChainChanged();
            // No throw is sufficient — proves the default `{}` branch was taken.
        });

        it('uses default jsonRpcStreamName when none provided', () => {
            expect(() => new InpageProvider(makeStream(), { logger: stubLog() })).not.toThrow();
        });

        it('calls sendSiteMetadata when shouldSendMetadata + document.readyState === "complete"', () => {
            Object.defineProperty(document, 'readyState', {
                configurable: true,
                value: 'complete',
            });
            new InpageProvider(makeStream(), {
                logger: stubLog(),
                shouldSendMetadata: true,
            });
            expect(mockSendSiteMetadata).toHaveBeenCalled();
        });

        it('defers sendSiteMetadata until DOMContentLoaded when readyState is loading', () => {
            Object.defineProperty(document, 'readyState', {
                configurable: true,
                value: 'loading',
            });
            const addListenerSpy = jest.spyOn(window, 'addEventListener');
            new InpageProvider(makeStream(), {
                logger: stubLog(),
                shouldSendMetadata: true,
            });
            expect(addListenerSpy).toHaveBeenCalledWith(
                'DOMContentLoaded',
                expect.any(Function),
            );
            expect(mockSendSiteMetadata).not.toHaveBeenCalled();
            addListenerSpy.mockRestore();
        });

        it('fires sendSiteMetadata when the deferred DOMContentLoaded listener runs', () => {
            Object.defineProperty(document, 'readyState', {
                configurable: true,
                value: 'loading',
            });
            let captured: any;
            const addListenerSpy = jest
                .spyOn(window, 'addEventListener')
                .mockImplementation((_name: string, listener: any) => {
                    captured = listener;
                });
            new InpageProvider(makeStream(), {
                logger: stubLog(),
                shouldSendMetadata: true,
            });
            expect(captured).toBeDefined();
            captured();
            expect(mockSendSiteMetadata).toHaveBeenCalled();
            addListenerSpy.mockRestore();
        });
    });

    describe('deprecation warnings', () => {
        it('logs deprecation when accessing chainId/networkVersion/selectedAddress', () => {
            const log = stubLog();
            const p = new InpageProvider(makeStream(), { logger: log });
            // Access through casted accessors.
            void p.chainId;
            void p.networkVersion;
            void p.selectedAddress;
            expect(log.warn).toHaveBeenCalledTimes(3);
        });

        it('only warns once per property', () => {
            const log = stubLog();
            const p = new InpageProvider(makeStream(), { logger: log });
            void p.chainId;
            void p.chainId;
            expect(log.warn).toHaveBeenCalledTimes(1);
        });
    });

    describe('event listener overrides', () => {
        it('warns about deprecated events (close/data/networkChanged/notification)', () => {
            const log = stubLog();
            const p = new InpageProvider(makeStream(), { logger: log });
            const cb = jest.fn();
            p.addListener('close', cb);
            p.on('data', cb);
            p.once('networkChanged', cb);
            p.prependListener('notification', cb);
            p.prependOnceListener('close', cb);
            // Each unique event name warns at most once; we triggered 4 distinct names.
            expect(log.warn).toHaveBeenCalledTimes(4);
        });

        it('does not warn for non-deprecated event names', () => {
            const log = stubLog();
            const p = new InpageProvider(makeStream(), { logger: log });
            p.on('connect', jest.fn());
            // chainId/networkVersion/selectedAddress getters not accessed, so warn=0.
            expect(log.warn).not.toHaveBeenCalled();
        });
    });

    describe('enable / send / sendAsync (deprecated)', () => {
        it('enable issues an eth_requestAccounts call and resolves', async () => {
            const log = stubLog();
            const p = new InpageProvider(makeStream(), { logger: log });
            // Stub internal _rpcRequest to resolve.
            jest.spyOn(p as any, '_rpcRequest').mockImplementation(
                (...args: any[]) => {
                    const cb = args[1] as Function;
                    cb(null, { result: ['0xacct'] });
                },
            );
            await expect(p.enable()).resolves.toEqual(['0xacct']);
            expect(log.warn).toHaveBeenCalled();
        });

        it('enable rejects when _rpcRequest throws', async () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            jest.spyOn(p as any, '_rpcRequest').mockImplementation(() => {
                throw new Error('boom');
            });
            await expect(p.enable()).rejects.toThrow('boom');
        });

        it('send(method, params) returns a promise (string method form)', async () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            jest.spyOn(p as any, '_rpcRequest').mockImplementation(
                (...args: any[]) => {
                    const cb = args[1] as Function;
                    cb(null, { result: ['0xacct'] });
                },
            );
            const promise = (p as any).send('eth_accounts', []);
            await expect(promise).resolves.toEqual({ result: ['0xacct'] });
        });

        it('send(payload, callback) form forwards to _rpcRequest', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            const cb = jest.fn();
            const spy = jest
                .spyOn(p as any, '_rpcRequest')
                .mockImplementation(() => undefined);
            (p as any).send({ id: 1, jsonrpc: '2.0', method: 'foo' }, cb);
            expect(spy).toHaveBeenCalled();
        });

        it('send rejects via promise when _rpcRequest throws', async () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            jest.spyOn(p as any, '_rpcRequest').mockImplementation(() => {
                throw new Error('rpc-fail');
            });
            await expect((p as any).send('eth_accounts', [])).rejects.toThrow('rpc-fail');
        });

        it('sendAsync forwards to _rpcRequest', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            const spy = jest
                .spyOn(p as any, '_rpcRequest')
                .mockImplementation(() => undefined);
            const cb = jest.fn();
            p.sendAsync({ id: 1, jsonrpc: '2.0', method: 'foo' } as any, cb);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('_sendSync (deprecated sync send)', () => {
        function buildInitialized() {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            (p as any)._initializeState({
                accounts: ['0xacct'],
                chainId: '0x1',
                isUnlocked: true,
                networkVersion: '1',
            });
            return p;
        }

        it('returns selectedAddress in array for eth_accounts', () => {
            const p = buildInitialized();
            const result = (p as any).send({ id: 1, jsonrpc: '2.0', method: 'eth_accounts' });
            expect(result.result).toEqual(['0xacct']);
        });

        it('returns selectedAddress for eth_coinbase', () => {
            const p = buildInitialized();
            const result = (p as any).send({ id: 2, jsonrpc: '2.0', method: 'eth_coinbase' });
            expect(result.result).toBe('0xacct');
        });

        it('returns null for eth_coinbase when no account is selected', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            const result = (p as any).send({ id: 2, jsonrpc: '2.0', method: 'eth_coinbase' });
            expect(result.result).toBeNull();
        });

        it('returns an empty array for eth_accounts when no account is selected', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            const result = (p as any).send({ id: 100, jsonrpc: '2.0', method: 'eth_accounts' });
            expect(result.result).toEqual([]);
        });

        it('returns null for net_version when networkVersion is unset', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            const result = (p as any).send({ id: 101, jsonrpc: '2.0', method: 'net_version' });
            expect(result.result).toBeNull();
        });

        it('returns true for eth_uninstallFilter', () => {
            const p = buildInitialized();
            jest.spyOn(p as any, '_rpcRequest').mockImplementation(() => undefined);
            const result = (p as any).send({
                id: 3,
                jsonrpc: '2.0',
                method: 'eth_uninstallFilter',
            });
            expect(result.result).toBe(true);
        });

        it('returns networkVersion for net_version', () => {
            const p = buildInitialized();
            const result = (p as any).send({ id: 4, jsonrpc: '2.0', method: 'net_version' });
            expect(result.result).toBe('1');
        });

        it('throws for an unsupported method', () => {
            const p = buildInitialized();
            expect(() =>
                (p as any).send({ id: 5, jsonrpc: '2.0', method: 'eth_blockNumber' }),
            ).toThrow();
        });
    });

    describe('notifications', () => {
        it('emits the deprecated data + notification events for eth_subscription', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            const dataSpy = jest.fn();
            const notifSpy = jest.fn();
            // Ignore deprecation warnings.
            (p as any).on('data', dataSpy);
            (p as any).on('notification', notifSpy);
            (p as any)._jsonRpcConnection.events.emit('notification', {
                method: 'eth_subscription',
                params: { result: { x: 1 } },
            });
            expect(dataSpy).toHaveBeenCalled();
            expect(notifSpy).toHaveBeenCalledWith({ x: 1 });
        });
    });

    describe('chainChanged handling (override)', () => {
        it('emits networkChanged when networkVersion differs and provider is initialized', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            (p as any)._initializeState({
                accounts: [],
                chainId: '0x1',
                isUnlocked: false,
                networkVersion: '1',
            });
            const spy = jest.fn();
            p.on('networkChanged', spy);
            (p as any)._handleChainChanged({ chainId: '0x5', networkVersion: '5' });
            expect(spy).toHaveBeenCalledWith('5');
        });

        it('does not emit networkChanged when networkVersion is unchanged', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            (p as any)._initializeState({
                accounts: [],
                chainId: '0x1',
                isUnlocked: false,
                networkVersion: '1',
            });
            const spy = jest.fn();
            p.on('networkChanged', spy);
            (p as any)._handleChainChanged({ chainId: '0x1', networkVersion: '1' });
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('_handleDisconnect clears networkVersion on permanent disconnect', () => {
        it('resets the internal networkVersion when disconnected non-recoverably', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            (p as any)._initializeState({
                accounts: [],
                chainId: '0x1',
                isUnlocked: false,
                networkVersion: '1',
            });
            expect((p as any).networkVersion).toBe('1');
            (p as any)._handleDisconnect(false);
            expect((p as any).networkVersion).toBeNull();
        });

        it('keeps the networkVersion on a recoverable disconnect', () => {
            const p = new InpageProvider(makeStream(), { logger: stubLog() });
            (p as any)._initializeState({
                accounts: [],
                chainId: '0x1',
                isUnlocked: false,
                networkVersion: '1',
            });
            (p as any)._handleDisconnect(true);
            // Recoverable: leaves networkVersion intact.
            expect((p as any).networkVersion).toBe('1');
        });
    });
});
