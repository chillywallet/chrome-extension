import { KeyringTypes } from '../../controller/KeyringController';
import { TrezorOffscreenKeyring } from './TrezorOffscreenKeyring';

export function trezorOffscreenKeyringBuilder(): TrezorOffscreenKeyring {
    return new TrezorOffscreenKeyring();
}

trezorOffscreenKeyringBuilder.type = KeyringTypes.trezor;
