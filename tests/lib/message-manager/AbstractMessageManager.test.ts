import { AbstractMessageManager } from '../../../src/lib/message-manager/AbstractMessageManager';

class TestMessageManager extends AbstractMessageManager<any, any, any> {
    override name = 'TestMessageManager';
    async prepMessageForSigning(messageParams: any) {
        const { internalId: _internalId, ...rest } = messageParams;
        return rest;
    }
    async addUnapprovedMessage(messageParams: any, _req: any) {
        const msg = this.createUnapprovedMessage(messageParams, 'sig' as any, undefined);
        await this.addMessage(msg as any);
        return msg.id;
    }
    addRequest(params: any, req: any) {
        return this.addRequestToMessageParams(params, req);
    }
}

describe('AbstractMessageManager', () => {
    it('starts with no unapproved messages', () => {
        const mgr = new TestMessageManager();
        expect(mgr.getUnapprovedMessagesCount()).toBe(0);
        expect(mgr.getUnapprovedMessages()).toEqual({});
        expect(mgr.getAllMessages()).toEqual([]);
    });

    it('addUnapprovedMessage stores an unapproved message', async () => {
        const mgr = new TestMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        expect(typeof id).toBe('string');
        expect(mgr.getUnapprovedMessagesCount()).toBe(1);
        expect(mgr.getMessage(id)).toBeDefined();
    });

    it('rejectMessage sets status to rejected and emits finished', async () => {
        const mgr = new TestMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        const finished = jest.fn();
        mgr.hub.on(`${id}:finished`, finished);
        mgr.rejectMessage(id);
        expect(finished).toHaveBeenCalled();
        expect(mgr.getMessage(id)!.status).toBe('rejected');
    });

    it('approveMessage sets status to approved and returns params without internalId', async () => {
        const mgr = new TestMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        const result = await mgr.approveMessage({ internalId: id, from: '0xa', data: '0xff' } as any);
        expect((result as any).internalId).toBeUndefined();
        expect(mgr.getMessage(id)!.status).toBe('approved');
    });

    it('setMessageStatusInProgress sets status to inProgress', async () => {
        const mgr = new TestMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        mgr.setMessageStatusInProgress(id);
        expect(mgr.getMessage(id)!.status).toBe('inProgress');
    });

    it('setMessageStatusSigned sets rawSig and status', async () => {
        const mgr = new TestMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        mgr.setMessageStatusSigned(id, '0xsig');
        expect(mgr.getMessage(id)!.status).toBe('signed');
        expect(mgr.getMessage(id)!.rawSig).toBe('0xsig');
    });

    it('setMetadata throws when message not found', () => {
        const mgr = new TestMessageManager();
        expect(() => mgr.setMetadata('not-real', { a: 1 } as any)).toThrow(/not found/);
    });

    it('setMetadata updates metadata when present', async () => {
        const mgr = new TestMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        mgr.setMetadata(id, { foo: 'bar' } as any);
        expect(mgr.getMessage(id)!.metadata).toEqual({ foo: 'bar' });
    });

    it('addRequestToMessageParams adds requestId and origin when req provided', () => {
        const mgr = new TestMessageManager();
        const updated = mgr.addRequest({ from: '0xa', data: '0xff' }, { id: 42, origin: 'site' });
        expect(updated.requestId).toBe(42);
        expect(updated.origin).toBe('site');
    });

    it('waitForFinishStatus resolves on signed', async () => {
        const mgr = new TestMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        const promise = mgr.waitForFinishStatus({ internalId: id, from: '0xa' } as any, 'Personal');
        mgr.setMessageStatusSigned(id, '0xsig');
        await expect(promise).resolves.toBe('0xsig');
    });

    it('waitForFinishStatus rejects on rejected', async () => {
        const mgr = new TestMessageManager();
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        const promise = mgr.waitForFinishStatus({ internalId: id, from: '0xa' } as any, 'Personal');
        mgr.rejectMessage(id);
        await expect(promise).rejects.toThrow(/User denied/);
    });

    it('setMessageStatus throws when message id not found', () => {
        const mgr = new TestMessageManager();
        expect(() => (mgr as any).setMessageStatus('nope', 'signed')).toThrow(/not found/);
    });

    it('runs security check if provided', async () => {
        const securityProviderRequest = jest.fn(async () => ({ malicious: false } as any));
        const mgr = new TestMessageManager(undefined, undefined, securityProviderRequest);
        const id = await mgr.addUnapprovedMessage({ from: '0xa', data: '0xff' }, undefined);
        expect(securityProviderRequest).toHaveBeenCalled();
        expect(mgr.getMessage(id)!.securityProviderResponse).toEqual({ malicious: false });
    });
});
