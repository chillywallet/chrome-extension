import {
    applyTrezorDiscoveryIdFromPagingRows,
    mergeTrezorSerializedPreserveTrezorDiscovery,
    removeTrezorPathsForChecksum,
} from '../../../src/lib/trezor/trezorSerializedMerge';

jest.mock('../../../src/lib/WalletUtils', () => ({
    getUUIDFromAddress: (a: string) => `uuid-${a.toLowerCase()}`,
}));

describe('mergeTrezorSerializedPreserveTrezorDiscovery', () => {
    it('keeps previous trezorDiscoveryId while applying bridge fields', () => {
        const out = mergeTrezorSerializedPreserveTrezorDiscovery(
            { trezorDiscoveryId: 'discovery-2', paths: {} },
            { trezorDiscoveryId: '', paths: { '0x1': 0 } as any },
        );
        expect(out.trezorDiscoveryId).toBe('discovery-2');
        expect(out.paths).toEqual({ '0x1': 0 });
    });
});

describe('applyTrezorDiscoveryIdFromPagingRows', () => {
    it('writes trezorDiscoveryId from row 0', () => {
        const target: any = {};
        applyTrezorDiscoveryIdFromPagingRows(target, [
            { address: '0xDEAD', index: 0 },
        ]);
        expect(target.trezorDiscoveryId).toBe('uuid-0xdead');
    });
});

describe('removeTrezorPathsForChecksum', () => {
    it('removes path entry by checksum address', () => {
        const data: any = { paths: { '0xAaa': 0, '0xBbb': 1 } };
        removeTrezorPathsForChecksum(data, '0xAaa');
        expect(data.paths).toEqual({ '0xBbb': 1 });
    });

    it('no-ops when paths is missing', () => {
        const data: any = {};
        removeTrezorPathsForChecksum(data, '0xAaa');
        expect(data.paths).toBeUndefined();
    });

    it('no-ops when paths is an array', () => {
        const data: any = { paths: [] as any };
        removeTrezorPathsForChecksum(data, '0xAaa');
        expect(Array.isArray(data.paths)).toBe(true);
    });
});
