import { KeyringTypes } from '../../controller/KeyringController';
import { BaseHardwareOffscreenKeyring } from '../offscreen/BaseHardwareOffscreenKeyring';

import type { TrezorSerializedState } from './trezorSerializedDefaults';
import { createTrezorEmptySerialized } from './trezorSerializedDefaults';
import {
    applyTrezorDiscoveryIdFromPagingRows,
    mergeTrezorSerializedPreserveTrezorDiscovery,
    removeTrezorPathsForChecksum,
} from './trezorSerializedMerge';
import { trezorOffscreenRpc } from './trezorOffscreenPort';

/** Runs MetaMask Trezor keyring + Connect bridge inside the offscreen document (MV3). */
export class TrezorOffscreenKeyring extends BaseHardwareOffscreenKeyring<TrezorSerializedState> {
    readonly type: string = KeyringTypes.trezor;

    constructor() {
        super(createTrezorEmptySerialized(), {
            rpc: trezorOffscreenRpc,
            mergeSerialized: mergeTrezorSerializedPreserveTrezorDiscovery,
            applyDiscoveryFromRows: applyTrezorDiscoveryIdFromPagingRows,
            removeAuxiliaryMapsForChecksum: removeTrezorPathsForChecksum,
        });
    }

    protected emptySerialized(): TrezorSerializedState {
        return createTrezorEmptySerialized();
    }
}
