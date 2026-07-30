import { DecryptMessageManager } from '../../../src/lib/message-manager/DecryptMessageManager';

const VALID_ADDRESS = '0x0123456789abcdef0123456789abcdef01234567';

describe('DecryptMessageManager', () => {
    it('addUnapprovedMessage stores the message', async () => {
        const mgr = new DecryptMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: VALID_ADDRESS, data: '0xfeed' }, { id: 1 });
        const msg = mgr.getMessage(id)!;
        expect(msg.status).toBe('unapproved');
    });

    it('addUnapprovedMessage emits unapprovedMessage event', async () => {
        const mgr = new DecryptMessageManager();
        const handler = jest.fn();
        mgr.hub.on('unapprovedMessage', handler);
        await mgr.addUnapprovedMessage({ from: VALID_ADDRESS, data: '0xfeed' });
        expect(handler).toHaveBeenCalled();
    });

    it('addUnapprovedMessageAsync rejects on invalid params', async () => {
        const mgr = new DecryptMessageManager();
        await expect(
            mgr.addUnapprovedMessageAsync({ from: 'bad', data: '0xfeed' } as any),
        ).rejects.toThrow();
    });

    it('prepMessageForSigning removes internalId', async () => {
        const mgr = new DecryptMessageManager();
        const res = await mgr.prepMessageForSigning({
            internalId: 'x',
            from: VALID_ADDRESS,
            data: '0xff',
        } as any);
        expect((res as any).internalId).toBeUndefined();
    });

    it('addUnapprovedMessageAsync resolves with rawSig on `decrypted`', async () => {
        const mgr = new DecryptMessageManager();
        const p = mgr.addUnapprovedMessageAsync({ from: VALID_ADDRESS, data: '0xfeed' });
        // Wait one tick so the inner addUnapprovedMessage assigns a message id.
        await new Promise(r => setTimeout(r, 0));
        const id = mgr.getAllMessages()[0].id;
        mgr.hub.emit(`${id}:finished`, { status: 'decrypted', rawSig: '0xRAW' });
        await expect(p).resolves.toBe('0xRAW');
    });

    it('addUnapprovedMessageAsync rejects on `rejected`', async () => {
        const mgr = new DecryptMessageManager();
        const p = mgr.addUnapprovedMessageAsync({ from: VALID_ADDRESS, data: '0xfeed' });
        await new Promise(r => setTimeout(r, 0));
        const id = mgr.getAllMessages()[0].id;
        mgr.hub.emit(`${id}:finished`, { status: 'rejected' });
        await expect(p).rejects.toThrow(/denied message decryption/);
    });

    it('addUnapprovedMessageAsync rejects on `errored`', async () => {
        const mgr = new DecryptMessageManager();
        const p = mgr.addUnapprovedMessageAsync({ from: VALID_ADDRESS, data: '0xfeed' });
        await new Promise(r => setTimeout(r, 0));
        const id = mgr.getAllMessages()[0].id;
        mgr.hub.emit(`${id}:finished`, { status: 'errored' });
        await expect(p).rejects.toThrow(/cannot be decrypted/);
    });

    it('addUnapprovedMessageAsync rejects with "Unknown problem" on unknown status', async () => {
        const mgr = new DecryptMessageManager();
        const p = mgr.addUnapprovedMessageAsync({ from: VALID_ADDRESS, data: '0xfeed' });
        await new Promise(r => setTimeout(r, 0));
        const id = mgr.getAllMessages()[0].id;
        mgr.hub.emit(`${id}:finished`, { status: 'mystery' });
        await expect(p).rejects.toThrow(/Unknown problem/);
    });
});
