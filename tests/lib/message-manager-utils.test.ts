import {
    normalizeMessageData,
    validateSignMessageData,
    validateTypedSignMessageDataV1,
    validateTypedSignMessageDataV3V4,
    validateEncryptionPublicKeyMessageData,
    validateDecryptedMessageData,
} from '../../src/lib/message-manager/utils';

const VALID = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';

describe('message-manager/utils', () => {
    describe('normalizeMessageData', () => {
        it('passes hex through with prefix', () => {
            expect(normalizeMessageData('0xdeadbeef')).toBe('0xdeadbeef');
        });

        it('passes already-hex strings without prefix through', () => {
            expect(normalizeMessageData('deadbeef')).toBe('0xdeadbeef');
        });
    });

    describe('validateSignMessageData', () => {
        it('accepts valid input', () => {
            expect(() =>
                validateSignMessageData({ from: VALID, data: '0xabc' } as any),
            ).not.toThrow();
        });

        it('rejects invalid from', () => {
            expect(() =>
                validateSignMessageData({ from: 'bad', data: '0xabc' } as any),
            ).toThrow(/Invalid "from"/);
        });

        it('rejects missing data', () => {
            expect(() =>
                validateSignMessageData({ from: VALID } as any),
            ).toThrow(/data/i);
        });
    });

    describe('validateTypedSignMessageDataV1', () => {
        it('rejects when data is not an array', () => {
            expect(() =>
                validateTypedSignMessageDataV1({ from: VALID, data: 'not-array' } as any),
            ).toThrow(/array/);
        });

        it('rejects invalid EIP712 v1 data', () => {
            expect(() =>
                validateTypedSignMessageDataV1({ from: VALID, data: [] } as any),
            ).toThrow();
        });
    });

    describe('validateTypedSignMessageDataV3V4', () => {
        it('rejects when data is missing/invalid', () => {
            expect(() =>
                validateTypedSignMessageDataV3V4({ from: VALID, data: null } as any, '0x1'),
            ).toThrow();
        });

        it('rejects invalid JSON in string data', () => {
            expect(() =>
                validateTypedSignMessageDataV3V4({ from: VALID, data: '{bad json' } as any, '0x1'),
            ).toThrow(/JSON/i);
        });

        it('rejects non-EIP712 object', () => {
            expect(() =>
                validateTypedSignMessageDataV3V4(
                    { from: VALID, data: { unrelated: 'object' } } as any,
                    '0x1',
                ),
            ).toThrow(/EIP-712/);
        });

        it('rejects null chainId', () => {
            const data = {
                types: { EIP712Domain: [{ name: 'name', type: 'string' }] },
                domain: { name: 't' },
                primaryType: 'EIP712Domain',
                message: {},
            };
            expect(() =>
                validateTypedSignMessageDataV3V4(
                    { from: VALID, data: data as any } as any,
                    undefined,
                ),
            ).toThrow(/Current chainId/);
        });
    });

    describe('validateEncryptionPublicKeyMessageData / validateDecryptedMessageData', () => {
        it('accepts valid address', () => {
            expect(() =>
                validateEncryptionPublicKeyMessageData({ from: VALID } as any),
            ).not.toThrow();
            expect(() =>
                validateDecryptedMessageData({ from: VALID } as any),
            ).not.toThrow();
        });

        it('rejects invalid address', () => {
            expect(() =>
                validateEncryptionPublicKeyMessageData({ from: 'bad' } as any),
            ).toThrow();
            expect(() =>
                validateDecryptedMessageData({ from: 'bad' } as any),
            ).toThrow();
        });
    });
});
