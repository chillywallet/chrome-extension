import type { Json } from '@metamask/utils';

export type LedgerSerializedState = Record<string, Json>;

export function createLedgerEmptySerialized(): LedgerSerializedState {
    return {
        hdPath: "m/44'/60'/0'/0/0",
        accounts: [],
        deviceId: '',
        accountDetails: {},
        implementFullBIP44: false,
        ledgerDiscoveryId: '',
    };
}
