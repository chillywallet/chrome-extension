import { KeyringTypes } from '../../../src/controller/KeyringController';
import { ledgerOffscreenKeyringBuilder } from '../../../src/lib/ledger/ledgerKeyringBuilder';
import { LedgerOffscreenKeyring } from '../../../src/lib/ledger/LedgerOffscreenKeyring';

jest.mock('../../../src/lib/ledger/ledgerOffscreenPort', () => ({
    ledgerOffscreenRpc: jest.fn(),
}));

beforeEach(() => {
    Object.defineProperty(global, 'crypto', {
        configurable: true,
        value: { randomUUID: () => 'ledger-instance-uuid' },
    });
});

describe('ledgerOffscreenKeyringBuilder', () => {
    it('produces a new LedgerOffscreenKeyring instance', () => {
        const kr = ledgerOffscreenKeyringBuilder();
        expect(kr).toBeInstanceOf(LedgerOffscreenKeyring);
    });

    it('exposes the ledger keyring type', () => {
        expect(ledgerOffscreenKeyringBuilder.type).toBe(KeyringTypes.ledger);
    });

    it('LedgerOffscreenKeyring exposes the ledger type', () => {
        const kr = new LedgerOffscreenKeyring();
        expect(kr.type).toBe(KeyringTypes.ledger);
    });
});
