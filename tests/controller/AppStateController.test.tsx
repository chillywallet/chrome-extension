import AppStateController from '../../src/controller/AppStateController';

function buildMessenger() {
    return {
        call: jest.fn(() => Promise.resolve()),
    } as any;
}

describe('AppStateController', () => {
    it('starts with no currentPopupId', () => {
        const c = new AppStateController({
            state: {} as any,
            messenger: buildMessenger(),
            isUnlocked: () => true,
        });
        expect(c.getCurrentPopupId()).toBeUndefined();
    });

    it('setCurrentPopupId persists the value', () => {
        const c = new AppStateController({
            state: {} as any,
            messenger: buildMessenger(),
            isUnlocked: () => true,
        });
        c.setCurrentPopupId(42);
        expect(c.getCurrentPopupId()).toBe(42);
    });

    it('getUnlockPromise resolves immediately when isUnlocked is true', async () => {
        const c = new AppStateController({
            state: {} as any,
            messenger: buildMessenger(),
            isUnlocked: () => true,
        });
        await expect(c.getUnlockPromise()).resolves.toBeUndefined();
    });

    it('getUnlockPromise queues a callback when locked, and handleUnlock drains it', async () => {
        const messenger = buildMessenger();
        const c = new AppStateController({
            state: {} as any,
            messenger,
            isUnlocked: () => false,
        });
        const promise = c.getUnlockPromise();
        expect(c.waitingForUnlock).toHaveLength(1);
        expect(messenger.call).toHaveBeenCalledWith(
            'ApprovalController:addRequest',
            expect.objectContaining({ type: expect.any(String) }),
            true,
        );
        c.handleUnlock();
        await expect(promise).resolves.toBeUndefined();
        expect(c.waitingForUnlock).toHaveLength(0);
    });

    it('handleUnlock with no queue still calls _acceptApproval safely', () => {
        const messenger = buildMessenger();
        const c = new AppStateController({
            state: {} as any,
            messenger,
            isUnlocked: () => false,
        });
        c.handleUnlock();
        // No throw is enough
    });

    it('_requestApproval is a no-op when already pending', () => {
        const messenger = buildMessenger();
        const c = new AppStateController({
            state: {} as any,
            messenger,
            isUnlocked: () => false,
        });
        c._requestApproval();
        c._requestApproval();
        expect(messenger.call).toHaveBeenCalledTimes(1);
    });

    it('_requestApproval resets _approvalRequestId when addRequest rejects', async () => {
        const messenger = {
            call: jest.fn(() => Promise.reject(new Error('boom'))),
        } as any;
        const c = new AppStateController({
            state: {} as any,
            messenger,
            isUnlocked: () => false,
        });
        c._requestApproval();
        // Wait for the .catch handler to run
        await Promise.resolve();
        await Promise.resolve();
        expect(c._approvalRequestId).toBe('');
    });

    it('_acceptApproval logs and clears id when acceptRequest throws', () => {
        const messenger = {
            call: jest.fn((action: string) => {
                if (action === 'ApprovalController:acceptRequest') {
                    throw new Error('reject failed');
                }
                return Promise.resolve();
            }),
        } as any;
        const c = new AppStateController({
            state: {} as any,
            messenger,
            isUnlocked: () => false,
        });
        // Seed an in-progress approval request id
        c._approvalRequestId = 'some-id';
        expect(() => c._acceptApproval()).not.toThrow();
        expect(c._approvalRequestId).toBe('');
    });
});
