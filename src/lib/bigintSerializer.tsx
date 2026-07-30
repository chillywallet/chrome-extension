/**
 * Type definition for serialized BigInt values.
 * BigInt values are serialized to this format { __bigint: string } for JSON compatibility.
 */
export type SerializedBigInt = {
    __bigint: string;
};

/**
 * Recursively transforms a type by replacing all bigint values with SerializedBigInt
 */
export type SerializeBigInt<T> = T extends bigint
    ? SerializedBigInt
    : T extends Array<infer U>
    ? Array<SerializeBigInt<U>>
    : T extends object
    ? {
        [K in keyof T]: SerializeBigInt<T[K]>;
    }
    : T;

/**
 * Recursively transforms a type by replacing all SerializedBigInt values with bigint
 */
export type DeserializeBigInt<T> = T extends SerializedBigInt
    ? bigint
    : T extends Array<infer U>
    ? Array<DeserializeBigInt<U>>
    : T extends object
    ? {
        [K in keyof T]: DeserializeBigInt<T[K]>;
    }
    : T;

/**
 * Serializes bigint values to a special marker object that can be JSON serialized.
 * Converts bigint to {__bigint: string} format.
 */
export function serializeBigInt<T>(value: T): SerializeBigInt<T> {
    if (value === null || value === undefined) {
        return value as SerializeBigInt<T>;
    }

    // Preserve binary data (Buffer, Uint8Array, other typed arrays) as arrays of numbers.
    // We only care about transforming bigint values; binary payloads should not be walked
    // as plain objects, otherwise consumers expecting Array/Buffer will receive plain objects.
    // Note: Buffer is a subclass of Uint8Array, so the ArrayBuffer.isView check covers it.
    if (typeof value === 'object' && ArrayBuffer.isView(value)) {
        // DataView is a special view that shouldn't be converted here; it is rarely used
        // for payloads we send over RPC, so we let it fall through.
        if ((value as any) instanceof DataView) {
            // eslint-disable-next-line no-restricted-syntax
            return value as SerializeBigInt<T>;
        }

        // Convert typed arrays (including Buffer, Uint8Array, etc.) to a plain number array
        // so they remain Array-like on the receiving side.
        return Array.from(value as any) as SerializeBigInt<T>;
    }

    if (typeof value === 'bigint') {
        return { __bigint: value.toString() } as SerializeBigInt<T>;
    }

    if (Array.isArray(value)) {
        return value.map(serializeBigInt) as SerializeBigInt<T>;
    }

    if (typeof value === 'object') {
        // Skip the marker object itself to avoid double serialization
        if ('__bigint' in value && Object.keys(value).length === 1) {
            return value as SerializeBigInt<T>;
        }
        const result: any = {};
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                result[key] = serializeBigInt((value as any)[key]);
            }
        }
        return result as SerializeBigInt<T>;
    }

    return value as SerializeBigInt<T>;
}

/**
 * Deserializes bigint marker objects back to bigint values.
 * Converts {__bigint: string} back to bigint.
 */
export function deserializeBigInt<T>(value: T): DeserializeBigInt<T> {
    if (value === null || value === undefined) {
        return value as DeserializeBigInt<T>;
    }

    // Check if this is a bigint marker object
    if (typeof value === 'object' && '__bigint' in value && Object.keys(value).length === 1) {
        return BigInt((value as SerializedBigInt).__bigint) as DeserializeBigInt<T>;
    }

    if (Array.isArray(value)) {
        return value.map(deserializeBigInt) as DeserializeBigInt<T>;
    }

    if (typeof value === 'object') {
        const result: any = {};
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                result[key] = deserializeBigInt((value as any)[key]);
            }
        }
        return result as DeserializeBigInt<T>;
    }

    return value as DeserializeBigInt<T>;
}
