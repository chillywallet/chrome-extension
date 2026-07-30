import type { Json } from '@metamask/utils';

export type TrezorSerializedState = Record<string, Json>;

export function createTrezorEmptySerialized(): TrezorSerializedState {
    return {
        hdPath: "m/44'/60'/0'/0",
        accounts: [],
        page: 0,
        paths: {},
        perPage: 5,
        unlockedAccount: 0,
        trezorDiscoveryId: '',
    };
}
