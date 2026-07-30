import { BaseProvider } from '../../../src/lib/providers/BaseProvider';

class TestProvider extends BaseProvider {
    constructor(opts: any = {}) {
        super(opts);
    }
    initState(initialState?: any) {
        this._initializeState(initialState);
    }
    callHandleAccountsChanged(accounts: any, isEth?: boolean) {
        this._handleAccountsChanged(accounts, isEth);
    }
    callHandleUnlock(opts: any) {
        this._handleUnlockStateChanged(opts);
    }
    callHandleChain(opts: any) {
        this._handleChainChanged(opts);
    }
    callHandleDisconnect(recoverable: boolean, msg?: string) {
        this._handleDisconnect(recoverable, msg);
    }
    callHandleConnect(chainId: string) {
        this._handleConnect(chainId);
    }
    getState() {
        return this._state;
    }
}

const stubLog = () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
});

describe('BaseProvider', () => {
    it('initializes with default state', () => {
        const p = new TestProvider({ logger: stubLog() });
        const s = p.getState();
        expect(s.isConnected).toBe(false);
        expect(s.isUnlocked).toBe(false);
        expect(s.initialized).toBe(false);
        expect(p.chainId).toBeNull();
        expect(p.selectedAddress).toBeNull();
    });

    it('request rejects on invalid args', async () => {
        const p = new TestProvider({ logger: stubLog() });
        await expect(p.request(null as any)).rejects.toBeDefined();
        await expect(p.request([] as any)).rejects.toBeDefined();
    });

    it('request rejects on invalid method', async () => {
        const p = new TestProvider({ logger: stubLog() });
        await expect(p.request({ method: '' } as any)).rejects.toBeDefined();
        await expect(p.request({ method: 123 } as any)).rejects.toBeDefined();
    });

    it('request rejects on invalid params', async () => {
        const p = new TestProvider({ logger: stubLog() });
        await expect(p.request({ method: 'foo', params: 'bad' as any })).rejects.toBeDefined();
    });

    it('isConnected reflects state', () => {
        const p = new TestProvider({ logger: stubLog() });
        expect(p.isConnected()).toBe(false);
        p.callHandleConnect('0x1');
        expect(p.isConnected()).toBe(true);
    });

    it('_initializeState throws if called twice', () => {
        const p = new TestProvider({ logger: stubLog() });
        p.initState();
        expect(() => p.initState()).toThrow(/already initialized/);
    });

    it('_initializeState with full data wires chain and accounts', () => {
        const p = new TestProvider({ logger: stubLog() });
        p.initState({
            accounts: ['0x1234'],
            chainId: '0x5',
            isUnlocked: true,
        });
        expect(p.chainId).toBe('0x5');
        expect(p.selectedAddress).toBe('0x1234');
        const s = p.getState();
        expect(s.isUnlocked).toBe(true);
        expect(s.initialized).toBe(true);
    });

    it('_handleChainChanged logs error on invalid chainId', () => {
        const log = stubLog();
        const p = new TestProvider({ logger: log });
        p.callHandleChain({ chainId: 'not-hex' });
        expect(log.error).toHaveBeenCalled();
    });

    it('_handleAccountsChanged emits accountsChanged only after initialization', () => {
        const p = new TestProvider({ logger: stubLog() });
        const emitted = jest.fn();
        p.on('accountsChanged', emitted);
        p.callHandleAccountsChanged(['0xa']);
        expect(emitted).not.toHaveBeenCalled();
        p.initState({ accounts: ['0xa'], chainId: '0x1', isUnlocked: true });
        p.callHandleAccountsChanged(['0xb']);
        expect(emitted).toHaveBeenCalledWith(['0xb']);
    });

    it('_handleAccountsChanged falls back to empty on non-array input', () => {
        const log = stubLog();
        const p = new TestProvider({ logger: log });
        p.callHandleAccountsChanged('not-array' as any);
        expect(log.error).toHaveBeenCalled();
    });

    it('_handleAccountsChanged falls back to empty on non-string account', () => {
        const log = stubLog();
        const p = new TestProvider({ logger: log });
        p.callHandleAccountsChanged([42] as any);
        expect(log.error).toHaveBeenCalled();
    });

    it('_handleUnlockStateChanged ignores non-boolean', () => {
        const log = stubLog();
        const p = new TestProvider({ logger: log });
        p.callHandleUnlock({ isUnlocked: 'yes' });
        expect(log.error).toHaveBeenCalled();
    });

    it('_handleUnlockStateChanged updates state when toggled', () => {
        const p = new TestProvider({ logger: stubLog() });
        p.callHandleUnlock({ accounts: ['0xa'], isUnlocked: true });
        expect(p.getState().isUnlocked).toBe(true);
    });

    it('_handleDisconnect emits and clears state for permanent disconnect', () => {
        const p = new TestProvider({ logger: stubLog() });
        p.callHandleConnect('0x1');
        const emitted = jest.fn();
        p.on('disconnect', emitted);
        p.callHandleDisconnect(false);
        expect(emitted).toHaveBeenCalled();
        expect(p.getState().isPermanentlyDisconnected).toBe(true);
    });

    it('_handleDisconnect with recoverable=true emits but does not clear', () => {
        const p = new TestProvider({ logger: stubLog() });
        p.callHandleConnect('0x1');
        const emitted = jest.fn();
        p.on('disconnect', emitted);
        p.callHandleDisconnect(true);
        expect(emitted).toHaveBeenCalled();
        expect(p.getState().isPermanentlyDisconnected).toBe(false);
    });

    describe('additional branches', () => {
        // Override the public `request` flow so the request mock returns deterministically.
        class RpcCapableProvider extends BaseProvider {
            // expose rpcEngine to manipulate it from tests
            public _engine: any;
            constructor(opts: any = {}) {
                super(opts);
                this._engine = this._rpcEngine;
            }
            getState() {
                return this._state;
            }
            callRpcRequest(payload: any, cb: any) {
                return this._rpcRequest(payload, cb);
            }
            callHandleChain(opts?: any) {
                this._handleChainChanged(opts);
            }
            callHandleConnect(c: string) {
                this._handleConnect(c);
            }
            callHandleDisconnect(rec: boolean) {
                this._handleDisconnect(rec);
            }
            callHandleAccountsChanged(accounts: any, isEth?: boolean) {
                this._handleAccountsChanged(accounts, isEth);
            }
            callHandleUnlock(opts: any) {
                this._handleUnlockStateChanged(opts);
            }
            initState(initialState?: any) {
                this._initializeState(initialState);
            }
        }

        it('constructor accepts no arguments and uses default console logger', () => {
            const p = new RpcCapableProvider();
            expect(p.isConnected()).toBe(false);
        });

        it('request accepts undefined params (covers payload normalisation branch)', async () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            // Stub the rpc engine handle so the request resolves quickly.
            p._engine.handle = (_payload: any, cb: any) =>
                cb(null, { jsonrpc: '2.0', id: 1, result: 'ok' });
            const out = await p.request<string>({ method: 'noop' });
            expect(out).toBe('ok');
        });

        it('request rejects when params is null (params === null branch)', async () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            await expect(
                p.request({ method: 'foo', params: null as any }),
            ).rejects.toBeDefined();
        });

        it('request forwards params when an array is provided (payload uses params branch)', async () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            let received: any;
            p._engine.handle = (payload: any, cb: any) => {
                received = payload;
                cb(null, { jsonrpc: '2.0', id: 1, result: 'ok' });
            };
            await p.request<string>({ method: 'foo', params: [1, 2] });
            expect(received.params).toEqual([1, 2]);
        });

        it('request rejects when params is null and stuck inside the invalid-params branch via primitive', async () => {
            // params=123 (a primitive) → typeof !== 'object' is true → throws invalidRequest.
            const p = new RpcCapableProvider({ logger: stubLog() });
            await expect(
                p.request({ method: 'foo', params: 123 as any }),
            ).rejects.toBeDefined();
        });

        it('_rpcRequest sets default jsonrpc when missing', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            const captured: any[] = [];
            p._engine.handle = (payload: any, _cb: any) => captured.push(payload);
            p.callRpcRequest({ method: 'foo' }, () => undefined);
            expect(captured[0].jsonrpc).toBe('2.0');
        });

        it('_rpcRequest wraps the callback for eth_accounts and updates internal state', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.initState({ accounts: ['0xa'], chainId: '0x1', isUnlocked: true });
            p._engine.handle = (_payload: any, cb: any) => {
                // Provider returns a new account list.
                cb(null, { jsonrpc: '2.0', id: 1, result: ['0xb'] });
            };
            const innerCb = jest.fn();
            p.callRpcRequest({ method: 'eth_accounts' }, innerCb);
            expect(innerCb).toHaveBeenCalled();
            // selectedAddress was updated via the wrapped handler.
            expect(p.selectedAddress).toBe('0xb');
        });

        it('_rpcRequest wraps the callback for eth_requestAccounts (non-eth_accounts variant)', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.initState({ accounts: ['0xa'], chainId: '0x1', isUnlocked: true });
            p._engine.handle = (_payload: any, cb: any) => {
                cb(null, { jsonrpc: '2.0', id: 1, result: ['0xc'] });
            };
            const innerCb = jest.fn();
            p.callRpcRequest({ method: 'eth_requestAccounts' }, innerCb);
            expect(innerCb).toHaveBeenCalled();
            expect(p.selectedAddress).toBe('0xc');
        });

        it('_rpcRequest falls back to empty list when eth_accounts response has no result', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.initState({ accounts: ['0xa'], chainId: '0x1', isUnlocked: true });
            p._engine.handle = (_payload: any, cb: any) => {
                // Response missing the result field → response.result ?? [] branch.
                cb(null, { jsonrpc: '2.0', id: 1 });
            };
            const innerCb = jest.fn();
            p.callRpcRequest({ method: 'eth_accounts' }, innerCb);
            expect(innerCb).toHaveBeenCalled();
            expect(p.selectedAddress).toBeNull();
        });

        it('_rpcRequest forwards batch (array) payloads without wrapping', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            const captured: any[] = [];
            p._engine.handle = (payload: any, _cb: any) => captured.push(payload);
            p.callRpcRequest(
                [
                    { method: 'a' },
                    { method: 'b' },
                ] as any,
                () => undefined,
            );
            expect(Array.isArray(captured[0])).toBe(true);
        });

        it('_handleChainChanged defaults to {} when called with no arguments', () => {
            const log = stubLog();
            const p = new RpcCapableProvider({ logger: log });
            // No args → destructured chainId is undefined → invalid chainId path.
            p.callHandleChain();
            expect(log.error).toHaveBeenCalled();
        });

        it('_handleChainChanged with the same chainId does not re-emit chainChanged', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.initState({ accounts: [], chainId: '0x1', isUnlocked: true });
            const emitted = jest.fn();
            p.on('chainChanged', emitted);
            p.callHandleChain({ chainId: '0x1' });
            expect(emitted).not.toHaveBeenCalled();
        });

        it('_handleChainChanged emits chainChanged when initialized and chain id changes', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.initState({ accounts: [], chainId: '0x1', isUnlocked: true });
            const emitted = jest.fn();
            p.on('chainChanged', emitted);
            p.callHandleChain({ chainId: '0x2' });
            expect(emitted).toHaveBeenCalledWith('0x2');
        });

        it('_handleDisconnect is a no-op when already permanently disconnected and not connected', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.callHandleConnect('0x1');
            p.callHandleDisconnect(false); // permanent
            const emitted = jest.fn();
            p.on('disconnect', emitted);
            // Now neither connected nor recoverable → early return.
            p.callHandleDisconnect(false);
            expect(emitted).not.toHaveBeenCalled();
        });

        it('_handleAccountsChanged warns when eth_accounts updates a non-null account list', () => {
            const log = stubLog();
            const p = new RpcCapableProvider({ logger: log });
            // Seed with a non-null accounts state.
            p.initState({ accounts: ['0xa'], chainId: '0x1', isUnlocked: true });
            p.callHandleAccountsChanged(['0xb'], true);
            // The error log "eth_accounts unexpectedly updated accounts" must have fired.
            const errors = (log.error as jest.Mock).mock.calls.map(c => c[0]);
            expect(errors.some(m => /eth_accounts/i.test(String(m)))).toBe(true);
        });

        it('_handleAccountsChanged keeps the existing selectedAddress when first account is unchanged', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.initState({ accounts: ['0xa', '0xb'], chainId: '0x1', isUnlocked: true });
            const emitted = jest.fn();
            p.on('accountsChanged', emitted);
            // Same first element but different tail → still selectedAddress 0xa.
            p.callHandleAccountsChanged(['0xa', '0xc']);
            expect(p.selectedAddress).toBe('0xa');
            expect(emitted).toHaveBeenCalledWith(['0xa', '0xc']);
        });

        it('_handleUnlockStateChanged defaults accounts to [] when none provided', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.initState({ accounts: ['0xa'], chainId: '0x1', isUnlocked: false });
            // Switch isUnlocked without providing accounts → falls back to [].
            p.callHandleUnlock({ isUnlocked: true });
            expect(p.getState().isUnlocked).toBe(true);
            expect(p.getState().accounts).toEqual([]);
        });

        it('_handleUnlockStateChanged is a no-op when the isUnlocked value is unchanged', () => {
            const p = new RpcCapableProvider({ logger: stubLog() });
            p.initState({ accounts: ['0xa'], chainId: '0x1', isUnlocked: true });
            p.callHandleUnlock({ accounts: ['0xb'], isUnlocked: true });
            // Accounts state stays since the value did not change.
            expect(p.getState().accounts).toEqual(['0xa']);
        });
    });
});
