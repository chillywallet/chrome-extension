import {
    applyHardwareDiscoveryIdFromPagingRows,
    mergeHardwareSerializedPreserveDiscoveryField,
} from '../../../src/lib/offscreen/hardwareSerializedDiscoveryMerge';

jest.mock('../../../src/lib/WalletUtils', () => ({
    getUUIDFromAddress: (address: string) => `uuid-${address.toLowerCase()}`,
}));

type State = Record<string, any>;

describe('mergeHardwareSerializedPreserveDiscoveryField', () => {
    it('preserves a previous non-empty discoveryField value', () => {
        const prev: State = { ledgerDiscoveryId: 'keep-me', accounts: [] };
        const fromBridge: State = { ledgerDiscoveryId: '', accounts: ['0xa'] };
        const merged = mergeHardwareSerializedPreserveDiscoveryField(
            prev,
            fromBridge,
            'ledgerDiscoveryId',
        );
        expect(merged).toEqual({ ledgerDiscoveryId: 'keep-me', accounts: ['0xa'] });
        expect(merged).not.toBe(fromBridge);
    });

    it('overwrites with empty string when previous is empty', () => {
        const prev: State = { ledgerDiscoveryId: '', accounts: [] };
        const fromBridge: State = { ledgerDiscoveryId: 'something', accounts: [] };
        const merged = mergeHardwareSerializedPreserveDiscoveryField(
            prev,
            fromBridge,
            'ledgerDiscoveryId',
        );
        expect(merged.ledgerDiscoveryId).toBe('');
    });

    it('overwrites when previous is not a string', () => {
        const prev: State = { ledgerDiscoveryId: 123 as any, accounts: [] };
        const fromBridge: State = { ledgerDiscoveryId: 'bridge', accounts: [] };
        const merged = mergeHardwareSerializedPreserveDiscoveryField(
            prev,
            fromBridge,
            'ledgerDiscoveryId',
        );
        expect(merged.ledgerDiscoveryId).toBe('');
    });
});

describe('applyHardwareDiscoveryIdFromPagingRows', () => {
    it('sets discoveryField from row with index 0', () => {
        const target: State = {};
        applyHardwareDiscoveryIdFromPagingRows(
            target,
            [
                { address: '0xABCD', index: 0 },
                { address: '0xEEEE', index: 1 },
            ],
            'trezorDiscoveryId',
        );
        expect(target.trezorDiscoveryId).toBe('uuid-0xabcd');
    });

    it('is a no-op when no row at index 0', () => {
        const target: State = { trezorDiscoveryId: 'prev' };
        applyHardwareDiscoveryIdFromPagingRows(
            target,
            [{ address: '0xAAA', index: 5 }],
            'trezorDiscoveryId',
        );
        expect(target.trezorDiscoveryId).toBe('prev');
    });

    it('is a no-op when row 0 has an empty address', () => {
        const target: State = { trezorDiscoveryId: 'prev' };
        applyHardwareDiscoveryIdFromPagingRows(
            target,
            [{ address: '', index: 0 }],
            'trezorDiscoveryId',
        );
        expect(target.trezorDiscoveryId).toBe('prev');
    });
});
