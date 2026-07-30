import { ethErrors, serializeError } from 'eth-rpc-errors';
import logger from '../shared/utils/logger';
import { deserializeBigInt, serializeBigInt } from './bigintSerializer';
import { isStreamWritable } from './stream-utils';

const createRPCHandler = (api, outStream, store, localStoreApiWrapper) => {
    return async data => {
        if (!isStreamWritable(outStream)) {
            return;
        }
        if (!api[data.method]) {
            outStream.write({
                jsonrpc: '2.0',
                error: ethErrors.rpc.methodNotFound({
                    message: `${data.method} not found`,
                }),
                id: data.id,
            });
            return;
        }

        let result;
        let error;
        try {
            // Deserialize bigint values in params before calling the API method
            const deserializedParams = data.params ? deserializeBigInt(data.params) : [];
            result = await api[data.method](...deserializedParams);
        } catch (err) {
            error = err;
        } finally {
            if (store && data.method !== 'getState') {
                localStoreApiWrapper.set(store.getState());
            }
        }

        if (!isStreamWritable(outStream)) {
            if (error) {
                logger.error(error);
            }
            return;
        }

        if (error) {
            outStream.write({
                jsonrpc: '2.0',
                error: serializeError(error, { shouldIncludeStack: true }),
                id: data.id,
            });
        } else {
            // Serialize bigint values in result before sending
            const serializedResult = serializeBigInt(result);
            outStream.write({
                jsonrpc: '2.0',
                result: serializedResult,
                id: data.id,
            });
        }
    };
};

export default createRPCHandler;
