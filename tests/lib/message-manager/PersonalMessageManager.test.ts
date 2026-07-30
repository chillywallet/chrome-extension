import { PersonalMessageManager } from '../../../src/lib/message-manager/PersonalMessageManager';

const VALID_ADDRESS = '0x0123456789abcdef0123456789abcdef01234567';

describe('PersonalMessageManager', () => {
    it('adds an unapproved message with normalized data', async () => {
        const mgr = new PersonalMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: VALID_ADDRESS, data: '0xff' }, { id: 1, origin: 'site.com' });
        const msg = mgr.getMessage(id)!;
        expect(msg.status).toBe('unapproved');
        expect(msg.messageParams.data.startsWith('0x')).toBe(true);
        expect((msg.messageParams as any).requestId).toBe(1);
        expect((msg.messageParams as any).origin).toBe('site.com');
    });

    it('emits unapprovedMessage event on add', async () => {
        const mgr = new PersonalMessageManager();
        const handler = jest.fn();
        mgr.hub.on('unapprovedMessage', handler);
        await mgr.addUnapprovedMessage({ from: VALID_ADDRESS, data: '0xff' });
        expect(handler).toHaveBeenCalled();
    });

    it('prepMessageForSigning removes internalId', async () => {
        const mgr = new PersonalMessageManager();
        const res = await mgr.prepMessageForSigning({ internalId: 'x', from: VALID_ADDRESS, data: '0xff' } as any);
        expect((res as any).internalId).toBeUndefined();
        expect(res.from).toBe(VALID_ADDRESS);
    });

    it('throws on invalid messageParams', async () => {
        const mgr = new PersonalMessageManager();
        await expect(
            mgr.addUnapprovedMessage({ from: 'bad-addr', data: '0xff' } as any),
        ).rejects.toThrow();
    });
});
