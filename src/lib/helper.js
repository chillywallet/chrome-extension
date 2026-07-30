const solidityTypes = () => {
    const types = ['bool', 'address', 'string', 'bytes', 'int', 'uint', 'fixed', 'ufixed'];

    const ints = Array.from(new Array(32)).map((_, index) => `int${(index + 1) * 8}`);
    const uints = Array.from(new Array(32)).map((_, index) => `uint${(index + 1) * 8}`);
    const bytes = Array.from(new Array(32)).map((_, index) => `bytes${index + 1}`);

    /**
     * fixed and ufixed
     * This value type also can be declared keywords such as ufixedMxN and fixedMxN.
     * The M represents the amount of bits that the type takes,
     * with N representing the number of decimal points that are available.
     *  M has to be divisible by 8, and a number from 8 to 256.
     * N has to be a value between 0 and 80, also being inclusive.
     */
    const fixedM = Array.from(new Array(32)).map((_, index) => `fixed${(index + 1) * 8}`);
    const ufixedM = Array.from(new Array(32)).map((_, index) => `ufixed${(index + 1) * 8}`);
    const fixed = Array.from(new Array(80)).map((_, index) =>
        fixedM.map(aFixedM => `${aFixedM}x${index + 1}`),
    );
    const ufixed = Array.from(new Array(80)).map((_, index) =>
        ufixedM.map(auFixedM => `${auFixedM}x${index + 1}`),
    );

    return [...types, ...ints, ...uints, ...bytes, ...fixed.flat(), ...ufixed.flat()];
};

const SOLIDITY_TYPES = solidityTypes();

const stripArrayType = potentialArrayType => potentialArrayType.replace(/\[[[0-9]*\]*/gu, '');

export const stripOneLayerofNesting = potentialArrayType =>
    potentialArrayType.replace(/\[(\d*)\]/u, '');

const isArrayType = potentialArrayType => potentialArrayType.match(/\[[[0-9]*\]*/u) !== null;

const isSolidityType = type => SOLIDITY_TYPES.includes(type);

export const sanitizeMessage = (msg, primaryType, types) => {
    if (!types) {
        throw new Error(`Invalid types definition`);
    }

    // Primary type can be an array.
    const isArray = primaryType && isArrayType(primaryType);
    if (isArray) {
        return {
            value: msg.map(value =>
                sanitizeMessage(value, stripOneLayerofNesting(primaryType), types),
            ),
            type: primaryType,
        };
    } else if (isSolidityType(primaryType)) {
        return { value: msg, type: primaryType };
    }

    // If not, assume to be struct
    const baseType = isArray ? stripArrayType(primaryType) : primaryType;

    const baseTypeDefinitions = types[baseType];
    if (!baseTypeDefinitions) {
        throw new Error(`Invalid primary type definition`);
    }

    const sanitizedStruct = {};
    const msgKeys = Object.keys(msg);
    msgKeys.forEach(msgKey => {
        const definedType = Object.values(baseTypeDefinitions).find(
            baseTypeDefinition => baseTypeDefinition.name === msgKey,
        );

        if (!definedType) {
            return;
        }

        sanitizedStruct[msgKey] = sanitizeMessage(msg[msgKey], definedType.type, types);
    });
    return { value: sanitizedStruct, type: primaryType };
};
