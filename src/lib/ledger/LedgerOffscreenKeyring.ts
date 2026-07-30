import { KeyringTypes } from '../../controller/KeyringController';
import { BaseHardwareOffscreenKeyring } from '../offscreen/BaseHardwareOffscreenKeyring';

import { ledgerOffscreenRpc } from './ledgerOffscreenPort';
import type { LedgerSerializedState } from './ledgerSerializedDefaults';
import { createLedgerEmptySerialized } from './ledgerSerializedDefaults';
import {
    applyLedgerDiscoveryIdFromPagingRows,
    mergeLedgerSerializedPreserveLedgerDiscovery,
    removeLedgerAccountDetailsForChecksum,
} from './ledgerSerializedMerge';

/** Runs real MetaMask Ledger keyring (+ iframe/USB bridge) inside the offscreen document. */
export class LedgerOffscreenKeyring extends BaseHardwareOffscreenKeyring<LedgerSerializedState> {
    readonly type: string = KeyringTypes.ledger;

    constructor() {
        super(createLedgerEmptySerialized(), {
            rpc: ledgerOffscreenRpc,
            mergeSerialized: mergeLedgerSerializedPreserveLedgerDiscovery,
            applyDiscoveryFromRows: applyLedgerDiscoveryIdFromPagingRows,
            removeAuxiliaryMapsForChecksum: removeLedgerAccountDetailsForChecksum,
        });
    }

    protected emptySerialized(): LedgerSerializedState {
        return createLedgerEmptySerialized();
    }
}
