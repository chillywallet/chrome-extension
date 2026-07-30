import { createLedgerEmptySerialized } from '../../../src/lib/ledger/ledgerSerializedDefaults';

describe('createLedgerEmptySerialized', () => {
    it('returns the default empty serialized state shape', () => {
        const state = createLedgerEmptySerialized();
        expect(state).toEqual({
            hdPath: "m/44'/60'/0'/0/0",
            accounts: [],
            deviceId: '',
            accountDetails: {},
            implementFullBIP44: false,
            ledgerDiscoveryId: '',
        });
    });

    it('returns a fresh instance on each call', () => {
        const a = createLedgerEmptySerialized();
        const b = createLedgerEmptySerialized();
        expect(a).not.toBe(b);
        expect(a.accounts).not.toBe(b.accounts);
    });
});
