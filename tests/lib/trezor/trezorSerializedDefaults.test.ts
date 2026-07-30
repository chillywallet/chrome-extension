import { createTrezorEmptySerialized } from '../../../src/lib/trezor/trezorSerializedDefaults';

describe('createTrezorEmptySerialized', () => {
    it('returns the default empty serialized state shape', () => {
        const state = createTrezorEmptySerialized();
        expect(state).toEqual({
            hdPath: "m/44'/60'/0'/0",
            accounts: [],
            page: 0,
            paths: {},
            perPage: 5,
            unlockedAccount: 0,
            trezorDiscoveryId: '',
        });
    });

    it('returns a fresh instance on each call', () => {
        const a = createTrezorEmptySerialized();
        const b = createTrezorEmptySerialized();
        expect(a).not.toBe(b);
    });
});
