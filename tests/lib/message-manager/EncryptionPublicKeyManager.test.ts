import { EncryptionPublicKeyManager } from '../../../src/lib/message-manager/EncryptionPublicKeyManager';

const VALID_ADDRESS = '0x0123456789abcdef0123456789abcdef01234567';

describe('EncryptionPublicKeyManager', () => {
    it('addUnapprovedMessage stores the message', async () => {
        const mgr = new EncryptionPublicKeyManager();
        const id = await mgr.addUnapprovedMessage({ from: VALID_ADDRESS }, { id: 1 });
        expect(mgr.getMessage(id)!.status).toBe('unapproved');
    });

    it('addUnapprovedMessage emits unapprovedMessage event', async () => {
        const mgr = new EncryptionPublicKeyManager();
        const handler = jest.fn();
        mgr.hub.on('unapprovedMessage', handler);
        await mgr.addUnapprovedMessage({ from: VALID_ADDRESS });
        expect(handler).toHaveBeenCalled();
    });

    it('addUnapprovedMessageAsync rejects on invalid from', async () => {
        const mgr = new EncryptionPublicKeyManager();
        await expect(mgr.addUnapprovedMessageAsync({ from: 'bad' } as any)).rejects.toThrow();
    });

    it('prepMessageForSigning returns from from data field and strips internalId', async () => {
        const mgr = new EncryptionPublicKeyManager();
        const res = await mgr.prepMessageForSigning({
            internalId: 'x',
            from: VALID_ADDRESS,
            data: '0xkey',
        } as any);
        expect(res.from).toBe('0xkey');
        expect((res as any).internalId).toBeUndefined();
    });

    it('addUnapprovedMessageAsync resolves with rawSig on `received`', async () => {
        const mgr = new EncryptionPublicKeyManager();
        const p = mgr.addUnapprovedMessageAsync({ from: VALID_ADDRESS });
        await new Promise(r => setTimeout(r, 0));
        const id = mgr.getAllMessages()[0].id;
        mgr.hub.emit(`${id}:finished`, { status: 'received', rawSig: '0xPUBKEY' });
        await expect(p).resolves.toBe('0xPUBKEY');
    });

    it('addUnapprovedMessageAsync rejects on `rejected`', async () => {
        const mgr = new EncryptionPublicKeyManager();
        const p = mgr.addUnapprovedMessageAsync({ from: VALID_ADDRESS });
        await new Promise(r => setTimeout(r, 0));
        const id = mgr.getAllMessages()[0].id;
        mgr.hub.emit(`${id}:finished`, { status: 'rejected' });
        await expect(p).rejects.toThrow(/User denied/);
    });

    it('addUnapprovedMessageAsync rejects on unknown status', async () => {
        const mgr = new EncryptionPublicKeyManager();
        const p = mgr.addUnapprovedMessageAsync({ from: VALID_ADDRESS });
        await new Promise(r => setTimeout(r, 0));
        const id = mgr.getAllMessages()[0].id;
        mgr.hub.emit(`${id}:finished`, { status: 'mystery' });
        await expect(p).rejects.toThrow(/Unknown problem/);
    });
});
