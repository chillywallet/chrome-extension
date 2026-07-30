import SafeEventEmitter from '@metamask/safe-event-emitter';
import { EthereumRpcError } from 'eth-rpc-errors';
import { TEN_SECONDS_IN_MILLISECONDS } from '../shared/constants/number';
import { deserializeBigInt, serializeBigInt } from './bigintSerializer';

const MAX = Number.MAX_SAFE_INTEGER;
let idCounter = Math.round(Math.random() * MAX);

function createRandomId() {
    idCounter %= MAX;
    return idCounter++;
}

class DisconnectError extends Error {}

class RPCClient {
    constructor(connectionStream) {
        this.connectionStream = connectionStream;
        this.notificationChannel = new SafeEventEmitter();
        this.uncaughtErrorChannel = new SafeEventEmitter();
        this.requests = new Map();
        this.connectionStream.on('data', this.handleResponse.bind(this));
        this.connectionStream.on('end', this.close.bind(this));
        this.responseHandled = {};
        this.DisconnectError = DisconnectError;
    }

    send(id, payload, cb) {
        this.requests.set(id, cb);
        this.connectionStream.write(payload);
        this.responseHandled[id] = false;
        if (payload.method === 'getState') {
            setTimeout(() => {
                if (!this.responseHandled[id] && cb) {
                    delete this.responseHandled[id];
                    return cb(new Error('No response from RPC'), null);
                }

                delete this.responseHandled[id];
                // needed for linter to pass
                return true;
            }, TEN_SECONDS_IN_MILLISECONDS);
        }
    }

    onNotification(handler) {
        this.notificationChannel.addListener('notification', data => {
            handler(data);
        });
    }

    onUncaughtError(handler) {
        this.uncaughtErrorChannel.addListener('error', error => {
            handler(error);
        });
    }

    close() {
        this.notificationChannel.removeAllListeners();
        this.uncaughtErrorChannel.removeAllListeners();
        // fail all unfinished requests
        for (const [id, handler] of this.requests) {
            if (!this.responseHandled[id]) {
                this.responseHandled[id] = true;
                handler(new DisconnectError('disconnected'));
            }
        }
    }

    handleResponse(data) {
        const { id, result, error, method, params } = data;
        const isNotification = id === undefined && error === undefined;
        const cb = this.requests.get(id);

        this.responseHandled[id] = true;

        if (method && params && !isNotification) {
            // dont handle server-side to client-side requests
            return;
        }
        if (method && params && isNotification) {
            // handle servier-side to client-side notification
            // Deserialize bigint values in notification params
            const deserializedData = {
                ...data,
                params: deserializeBigInt(params),
            };
            this.notificationChannel.emit('notification', deserializedData);
            return;
        }

        if (error) {
            const e = new EthereumRpcError(error.code, error.message, error.data);
            // preserve the stack from serializeError
            e.stack = error.stack;
            if (cb) {
                this.requests.delete(id);
                cb(e);
                return;
            }
            this.uncaughtErrorChannel.emit('error', e);
            return;
        }

        if (!cb) {
            // not found in request list
            return;
        }

        this.requests.delete(id);

        // Deserialize bigint values in result before calling callback
        const deserializedResult = deserializeBigInt(result);
        cb(null, deserializedResult);
    }
}

const createRPCClientFactory = connectionStream => {
    const metaRPCClient = new RPCClient(connectionStream);
    return new Proxy(metaRPCClient, {
        get: (object, property) => {
            if (object[property]) {
                return object[property];
            }
            return (...p) => {
                const cb = p[p.length - 1];
                const params = p.slice(0, -1);
                // Serialize bigint values in params before sending
                const serializedParams = serializeBigInt(params);
                const id = createRandomId();
                const payload = {
                    jsonrpc: '2.0',
                    method: property,
                    params: serializedParams,
                    id,
                };
                object.send(id, payload, cb);
            };
        },
    });
};

export default createRPCClientFactory;
