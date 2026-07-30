import {
    hardwarePreviewDispose,
    hardwarePreviewGetAddressPage,
    type HardwareAddressPreviewSession,
} from '../../../src/lib/offscreen/hardwareAddressPreview';

jest.mock('../../../src/lib/WalletUtils', () => ({
    getUUIDFromAddress: (a: string) => `uuid-${a.toLowerCase()}`,
}));

describe('hardwarePreviewGetAddressPage', () => {
    it('forwards to RPC, merges serialized, and writes discovery id from index 0', async () => {
        const session: HardwareAddressPreviewSession<any> = {
            instanceId: 'i-1',
            serialized: { ledgerDiscoveryId: 'prev', accounts: [] },
        };

        const rpc = jest.fn().mockResolvedValue({
            serialized: { ledgerDiscoveryId: '', accounts: ['0xA'] },
            accounts: [
                { address: '0xRoot', index: 0 },
                { address: '0xNext', index: 1, balance: null },
            ],
        });

        const rows = await hardwarePreviewGetAddressPage(
            session,
            'first',
            rpc as any,
            'ledgerDiscoveryId',
        );

        expect(rpc).toHaveBeenCalledWith('i-1', 'getAddressPage', {
            serialized: { ledgerDiscoveryId: 'prev', accounts: [] },
            direction: 'first',
        });
        expect(rows).toEqual([
            { address: '0xRoot', index: 0 },
            { address: '0xNext', index: 1 },
        ]);
        expect(session.serialized.ledgerDiscoveryId).toBe('uuid-0xroot');
        expect(session.serialized.accounts).toEqual(['0xA']);
    });

    it('preserves discovery id when no row at index 0 returned', async () => {
        const session: HardwareAddressPreviewSession<any> = {
            instanceId: 'i-1',
            serialized: { trezorDiscoveryId: 'keep-me' },
        };

        const rpc = jest.fn().mockResolvedValue({
            serialized: { trezorDiscoveryId: '' },
            accounts: [{ address: '0xRoot', index: 7 }],
        });

        await hardwarePreviewGetAddressPage(session, 'next', rpc as any, 'trezorDiscoveryId');
        expect(session.serialized.trezorDiscoveryId).toBe('keep-me');
    });
});

describe('hardwarePreviewDispose', () => {
    it('invokes rpc dispose with the given instance id', async () => {
        const rpc = jest.fn().mockResolvedValue(undefined);
        await hardwarePreviewDispose('inst-77', rpc as any);
        expect(rpc).toHaveBeenCalledWith('inst-77', 'dispose');
    });

    it('swallows rpc errors', async () => {
        const rpc = jest.fn().mockRejectedValue(new Error('port gone'));
        await expect(hardwarePreviewDispose('id', rpc as any)).resolves.toBeUndefined();
    });
});
