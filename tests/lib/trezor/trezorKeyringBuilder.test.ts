import { KeyringTypes } from '../../../src/controller/KeyringController';
import { trezorOffscreenKeyringBuilder } from '../../../src/lib/trezor/trezorKeyringBuilder';
import { TrezorOffscreenKeyring } from '../../../src/lib/trezor/TrezorOffscreenKeyring';

jest.mock('../../../src/lib/trezor/trezorOffscreenPort', () => ({
    trezorOffscreenRpc: jest.fn(),
}));

beforeEach(() => {
    Object.defineProperty(global, 'crypto', {
        configurable: true,
        value: { randomUUID: () => 'trezor-instance-uuid' },
    });
});

describe('trezorOffscreenKeyringBuilder', () => {
    it('produces a new TrezorOffscreenKeyring instance', () => {
        const kr = trezorOffscreenKeyringBuilder();
        expect(kr).toBeInstanceOf(TrezorOffscreenKeyring);
    });

    it('exposes the trezor keyring type', () => {
        expect(trezorOffscreenKeyringBuilder.type).toBe(KeyringTypes.trezor);
    });

    it('TrezorOffscreenKeyring exposes the trezor type', () => {
        const kr = new TrezorOffscreenKeyring();
        expect(kr.type).toBe(KeyringTypes.trezor);
    });
});
