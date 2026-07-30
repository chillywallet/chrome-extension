import { KeyringTypes } from '../../controller/KeyringController';
import { LedgerOffscreenKeyring } from './LedgerOffscreenKeyring';

export function ledgerOffscreenKeyringBuilder(): LedgerOffscreenKeyring {
    return new LedgerOffscreenKeyring();
}

ledgerOffscreenKeyringBuilder.type = KeyringTypes.ledger;
