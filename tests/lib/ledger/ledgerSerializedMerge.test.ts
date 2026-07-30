import {
    applyLedgerDiscoveryIdFromPagingRows,
    mergeLedgerSerializedPreserveLedgerDiscovery,
    removeLedgerAccountDetailsForChecksum,
} from '../../../src/lib/ledger/ledgerSerializedMerge';

jest.mock('../../../src/lib/WalletUtils', () => ({
    getUUIDFromAddress: (a: string) => `uuid-${a.toLowerCase()}`,
}));

describe('mergeLedgerSerializedPreserveLedgerDiscovery', () => {
    it('keeps previous ledgerDiscoveryId while applying bridge fields', () => {
        const out = mergeLedgerSerializedPreserveLedgerDiscovery(
            { ledgerDiscoveryId: 'discovery-1', accounts: [] },
            { ledgerDiscoveryId: '', accounts: ['0xa'] },
        );
        expect(out.ledgerDiscoveryId).toBe('discovery-1');
        expect(out.accounts).toEqual(['0xa']);
    });
});

describe('applyLedgerDiscoveryIdFromPagingRows', () => {
    it('writes ledgerDiscoveryId from row 0', () => {
        const target: any = {};
        applyLedgerDiscoveryIdFromPagingRows(target, [
            { address: '0xABCD', index: 0 },
            { address: '0xZZZZ', index: 1 },
        ]);
        expect(target.ledgerDiscoveryId).toBe('uuid-0xabcd');
    });
});

describe('removeLedgerAccountDetailsForChecksum', () => {
    it('removes the specified checksum entry from accountDetails', () => {
        const data: any = {
            accountDetails: {
                '0xAaa': { x: 1 },
                '0xBbb': { y: 2 },
            },
        };
        removeLedgerAccountDetailsForChecksum(data, '0xAaa');
        expect(data.accountDetails).toEqual({ '0xBbb': { y: 2 } });
    });

    it('no-ops when accountDetails is missing', () => {
        const data: any = {};
        removeLedgerAccountDetailsForChecksum(data, '0xAaa');
        expect(data.accountDetails).toBeUndefined();
    });

    it('no-ops when accountDetails is an array', () => {
        const data: any = { accountDetails: [] as any };
        removeLedgerAccountDetailsForChecksum(data, '0xAaa');
        expect(Array.isArray(data.accountDetails)).toBe(true);
    });
});
