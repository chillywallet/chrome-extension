import {
    ApprovalController,
    ApprovalRequestNotFoundError,
    ApprovalRequestNotFoundError2,
    ApprovalRequestNoResultSupportError,
    NoApprovalFlowsError,
    EndInvalidFlowError,
    MissingApprovalFlowError,
    APPROVAL_TYPE_RESULT_ERROR,
    APPROVAL_TYPE_RESULT_SUCCESS,
} from '../../src/controller/ApprovalController';

jest.mock('@metamask/rpc-errors', () => ({
    rpcErrors: {
        internal: (msg: string) => new Error(msg),
        invalidRequest: (msg: string) => new Error(msg),
    },
}));

jest.mock('@metamask/utils', () => ({}));

jest.mock('nanoid', () => {
    let counter = 0;
    return {
        nanoid: () => `auto-id-${++counter}`,
    };
});

function makeRestrictedMessenger() {
    const { ControllerMessenger } = require('@metamask/base-controller');
    const cm = new ControllerMessenger();
    return cm.getRestricted({
        name: 'ApprovalController',
        allowedActions: [],
        allowedEvents: [],
    });
}

function build(opts: { typesExcludedFromRateLimiting?: string[] } = {}) {
    const showApprovalRequest = jest.fn();
    const controller = new ApprovalController({
        showApprovalRequest,
        typesExcludedFromRateLimiting: opts.typesExcludedFromRateLimiting ?? [],
        messenger: makeRestrictedMessenger(),
    } as any);
    return { controller, showApprovalRequest };
}

describe('ApprovalController', () => {
    describe('initialization & error classes', () => {
        it('constructs with default typesExcludedFromRateLimiting when option omitted', () => {
            const showApprovalRequest = jest.fn();
            const controller = new ApprovalController({
                showApprovalRequest,
                messenger: makeRestrictedMessenger(),
            } as any);
            expect(controller.state.pendingApprovals).toEqual({});
        });

        it('initializes with empty state', () => {
            const { controller } = build();
            expect(controller.state.pendingApprovals).toEqual({});
            expect(controller.state.pendingApprovalCount).toBe(0);
            expect(controller.state.approvalFlows).toEqual([]);
        });

        it('exposes APPROVAL_TYPE_RESULT_* constants', () => {
            expect(APPROVAL_TYPE_RESULT_SUCCESS).toBe('result_success');
            expect(APPROVAL_TYPE_RESULT_ERROR).toBe('result_error');
        });

        it('error classes carry the id/origin/type in their messages', () => {
            expect(new ApprovalRequestNotFoundError('xx').message).toContain('xx');
            expect(new ApprovalRequestNotFoundError2('org', 'tp').message).toContain('org');
            expect(new ApprovalRequestNoResultSupportError('a').message).toContain('a');
            expect(new NoApprovalFlowsError().message).toMatch(/No approval flows/);
            expect(new EndInvalidFlowError('id', ['x', 'y']).message).toContain('y');
            expect(new MissingApprovalFlowError('foo').message).toContain('foo');
        });
    });

    describe('add', () => {
        it('throws on missing origin/type', () => {
            const { controller } = build();
            expect(() => controller.add({ origin: '', type: 't' } as any)).toThrow(/origin/);
            expect(() => controller.add({ origin: 'o', type: '' } as any)).toThrow(/type/);
        });

        it('throws when requestData is not a plain object', () => {
            const { controller } = build();
            expect(() =>
                controller.add({
                    id: 'i',
                    origin: 'o',
                    type: 't',
                    requestData: [] as any,
                }),
            ).toThrow(/Request data must be a plain object/);
        });

        it('throws when requestState is not a plain object', () => {
            const { controller } = build();
            expect(() =>
                controller.add({
                    id: 'i',
                    origin: 'o',
                    type: 't',
                    requestState: [] as any,
                }),
            ).toThrow(/Request state must be a plain object/);
        });

        it('throws when adding a duplicate id', () => {
            const { controller } = build();
            controller.add({ id: 'dup', origin: 'o', type: 't' }).catch(() => {});
            expect(() =>
                controller.add({ id: 'dup', origin: 'o2', type: 't2' }),
            ).toThrow(/already exists/);
        });

        it('adds approval and updates state', () => {
            const { controller } = build();
            controller
                .add({ id: 'r1', origin: 'o', type: 't', requestData: { foo: 'bar' } })
                .catch(() => {});
            expect(controller.state.pendingApprovalCount).toBe(1);
            expect(controller.state.pendingApprovals.r1.requestData).toEqual({ foo: 'bar' });
            expect(controller.has({ id: 'r1' })).toBe(true);
        });

        it('replaces an existing approval for the same origin+type', async () => {
            const { controller } = build();
            const promise = controller.add({ id: 'r1', origin: 'o', type: 't' });
            // The first promise should reject when the second add deletes it.
            promise.catch(() => {});
            controller.add({ id: 'r2', origin: 'o', type: 't' });
            expect(controller.state.pendingApprovals.r1).toBeUndefined();
            expect(controller.state.pendingApprovals.r2).toBeDefined();
        });

        it('keeps multiple approvals for same origin+type when type is rate-limit-excluded', () => {
            const { controller } = build({ typesExcludedFromRateLimiting: ['t'] });
            controller.add({ id: 'r1', origin: 'o', type: 't' }).catch(() => {});
            controller.add({ id: 'r2', origin: 'o', type: 't' }).catch(() => {});
            expect(controller.state.pendingApprovalCount).toBe(2);
        });
    });

    describe('addAndShowApprovalRequest', () => {
        it('adds the request and invokes showApprovalRequest', () => {
            const { controller, showApprovalRequest } = build();
            controller
                .addAndShowApprovalRequest({ id: 'r1', origin: 'o', type: 't' })
                .catch(() => {});
            expect(showApprovalRequest).toHaveBeenCalled();
        });
    });

    describe('has', () => {
        it('returns false when no approvals match', () => {
            const { controller } = build();
            expect(controller.has({ id: 'x' })).toBe(false);
            expect(controller.has({ origin: 'o' })).toBe(false);
            expect(controller.has({ type: 't' })).toBe(false);
        });

        it('throws when no parameters provided', () => {
            const { controller } = build();
            expect(() => controller.has({})).toThrow();
        });

        it('throws when called without an opts argument (default {} branch)', () => {
            const { controller } = build();
            // @ts-expect-error intentionally omit the opts argument to hit the `= {}` default
            expect(() => controller.has()).toThrow();
        });

        it('throws on non-string id', () => {
            const { controller } = build();
            expect(() => controller.has({ id: 123 as any })).toThrow(/non-string id/);
        });

        it('throws on non-string origin', () => {
            const { controller } = build();
            expect(() => controller.has({ origin: 123 as any })).toThrow(/non-string origin/);
        });

        it('throws on non-string type', () => {
            const { controller } = build();
            expect(() => controller.has({ type: 123 as any })).toThrow(/non-string type/);
        });

        it('matches by type alone', () => {
            const { controller } = build();
            controller.add({ id: 'r', origin: 'o', type: 'eth_sign' }).catch(() => {});
            expect(controller.has({ type: 'eth_sign' })).toBe(true);
            expect(controller.has({ type: 'unknown' })).toBe(false);
        });

        it('matches by origin and origin+type', () => {
            const { controller } = build();
            controller.add({ id: 'r', origin: 'o1', type: 't' }).catch(() => {});
            expect(controller.has({ origin: 'o1' })).toBe(true);
            expect(controller.has({ origin: 'o1', type: 't' })).toBe(true);
            expect(controller.has({ origin: 'o1', type: 'other' })).toBe(false);
        });
    });

    describe('get / getApprovalCount / getTotalApprovalCount', () => {
        it('get returns the request and undefined for unknown id', () => {
            const { controller } = build();
            controller.add({ id: 'r1', origin: 'o', type: 't' }).catch(() => {});
            expect(controller.get('r1')!.origin).toBe('o');
            expect(controller.get('missing')).toBeUndefined();
        });

        it('getApprovalCount requires origin or type', () => {
            const { controller } = build();
            expect(() => controller.getApprovalCount()).toThrow();
        });

        it('counts by origin, by type, and by origin+type', () => {
            const { controller } = build({ typesExcludedFromRateLimiting: ['t'] });
            controller.add({ id: 'r1', origin: 'o', type: 't' }).catch(() => {});
            controller.add({ id: 'r2', origin: 'o', type: 't' }).catch(() => {});
            controller.add({ id: 'r3', origin: 'o', type: 'other' }).catch(() => {});

            expect(controller.getApprovalCount({ origin: 'o' })).toBe(3);
            expect(controller.getApprovalCount({ origin: 'o', type: 't' })).toBe(2);
            expect(controller.getApprovalCount({ type: 'other' })).toBe(1);
            expect(controller.getApprovalCount({ origin: 'unknown' })).toBe(0);
            expect(controller.getApprovalCount({ origin: 'unknown', type: 't' })).toBe(0);
            expect(controller.getTotalApprovalCount()).toBe(3);
        });
    });

    describe('accept', () => {
        it('resolves the request and removes it', async () => {
            const { controller } = build();
            const promise = controller.add({ id: 'r1', origin: 'o', type: 't' });
            const result = controller.accept('r1', 'ok');
            await expect(promise).resolves.toBe('ok');
            await expect(result).resolves.toEqual({ value: undefined });
            expect(controller.state.pendingApprovals.r1).toBeUndefined();
        });

        it('returns an AddResult when expectsResult is true and waitForResult', async () => {
            const { controller } = build();
            const promise = controller.add({
                id: 'r1',
                origin: 'o',
                type: 't',
                expectsResult: true,
            });
            const acceptPromise = controller.accept('r1', 'data', { waitForResult: true });
            const addResult: any = await promise;
            expect(addResult.value).toBe('data');
            expect(addResult.resultCallbacks).toBeDefined();
            addResult.resultCallbacks.success('done');
            await expect(acceptPromise).resolves.toEqual({ value: 'done' });
        });

        it('rejects when waitForResult is set but request does not expect a result', async () => {
            const { controller } = build();
            const addPromise = controller.add({ id: 'r1', origin: 'o', type: 't' });
            addPromise.catch(() => {});
            await expect(
                controller.accept('r1', null, { waitForResult: true }),
            ).rejects.toBeInstanceOf(ApprovalRequestNoResultSupportError);
        });

        it('keeps the approval until result is delivered when deleteAfterResult', async () => {
            const { controller } = build();
            const addPromise = controller.add({
                id: 'r1',
                origin: 'o',
                type: 't',
                expectsResult: true,
            });
            const acceptPromise = controller.accept('r1', undefined, {
                waitForResult: true,
                deleteAfterResult: true,
            });
            // While waiting, the approval still exists in state.
            expect(controller.state.pendingApprovals.r1).toBeDefined();
            const result: any = await addPromise;
            result.resultCallbacks.success('y');
            await acceptPromise;
            expect(controller.state.pendingApprovals.r1).toBeUndefined();
        });

        it('throws when id is unknown', () => {
            const { controller } = build();
            expect(() => controller.accept('missing')).toThrow(ApprovalRequestNotFoundError);
        });
    });

    describe('reject', () => {
        it('rejects the promise and removes the request', async () => {
            const { controller } = build();
            const promise = controller.add({ id: 'r1', origin: 'o', type: 't' });
            controller.reject('r1', new Error('user denied'));
            await expect(promise).rejects.toThrow('user denied');
            expect(controller.state.pendingApprovals.r1).toBeUndefined();
        });

        it('throws on unknown id', () => {
            const { controller } = build();
            expect(() => controller.reject('missing', new Error('x'))).toThrow(
                ApprovalRequestNotFoundError,
            );
        });
    });

    describe('clear', () => {
        it('rejects all pending approvals and resets state', async () => {
            const { controller } = build();
            const p1 = controller.add({ id: 'r1', origin: 'o', type: 't' });
            const p2 = controller.add({ id: 'r2', origin: 'o2', type: 't2' });
            const err = new Error('cleared');
            controller.clear(err as any);
            await expect(p1).rejects.toThrow('cleared');
            await expect(p2).rejects.toThrow('cleared');
            expect(controller.state.pendingApprovals).toEqual({});
            expect(controller.state.pendingApprovalCount).toBe(0);
        });
    });

    describe('updateRequestState', () => {
        it('updates the request state of a pending approval', () => {
            const { controller } = build();
            controller.add({ id: 'r1', origin: 'o', type: 't' }).catch(() => {});
            controller.updateRequestState({ id: 'r1', requestState: { stage: 'review' } });
            expect(controller.state.pendingApprovals.r1.requestState).toEqual({
                stage: 'review',
            });
        });

        it('throws when the id is unknown', () => {
            const { controller } = build();
            expect(() =>
                controller.updateRequestState({ id: 'missing', requestState: {} }),
            ).toThrow(ApprovalRequestNotFoundError);
        });
    });

    describe('counts adjust on delete', () => {
        it('decrements counts but keeps origin entry when multiple types share origin', () => {
            const { controller } = build();
            controller.add({ id: 'r1', origin: 'o', type: 't1' }).catch(() => {});
            controller.add({ id: 'r2', origin: 'o', type: 't2' }).catch(() => {});
            expect(controller.getApprovalCount({ origin: 'o' })).toBe(2);
            controller.reject('r1', new Error('x'));
            expect(controller.getApprovalCount({ origin: 'o' })).toBe(1);
            expect(controller.has({ origin: 'o' })).toBe(true);
        });

        it('removes origin map when the last request for an origin is deleted', () => {
            const { controller } = build();
            controller.add({ id: 'r1', origin: 'o', type: 't' }).catch(() => {});
            controller.reject('r1', new Error('x'));
            expect(controller.has({ origin: 'o' })).toBe(false);
        });
    });

    describe('messenger action registration', () => {
        function buildWithMessenger() {
            const {
                ControllerMessenger,
            } = require('@metamask/base-controller');
            const cm = new ControllerMessenger();
            const messenger = cm.getRestricted({
                name: 'ApprovalController',
                allowedActions: [],
                allowedEvents: [],
            });
            const showApprovalRequest = jest.fn();
            const controller = new ApprovalController({
                messenger,
                showApprovalRequest,
                typesExcludedFromRateLimiting: [],
            } as any);
            return { controller, cm, showApprovalRequest };
        }

        it('addRequest invokes addAndShowApprovalRequest when shouldShowRequest is true', () => {
            const { cm, showApprovalRequest } = buildWithMessenger();
            cm.call(
                'ApprovalController:addRequest',
                { id: 'a', origin: 'o', type: 't' },
                true,
            );
            expect(showApprovalRequest).toHaveBeenCalled();
        });

        it('addRequest calls add (without show) when shouldShowRequest is false', () => {
            const { cm, controller, showApprovalRequest } = buildWithMessenger();
            cm.call(
                'ApprovalController:addRequest',
                { id: 'a2', origin: 'o', type: 't' },
                false,
            );
            expect(showApprovalRequest).not.toHaveBeenCalled();
            expect(controller.has({ id: 'a2' })).toBe(true);
        });

        it('hasRequest, acceptRequest, rejectRequest, updateRequestState and clearRequests are wired', async () => {
            const { cm, controller } = buildWithMessenger();
            controller.add({ id: 'm1', origin: 'o', type: 't' }).catch(() => {});
            expect(cm.call('ApprovalController:hasRequest', { id: 'm1' })).toBe(true);
            cm.call('ApprovalController:updateRequestState', {
                id: 'm1',
                requestState: { foo: 'bar' },
            });
            expect(controller.state.pendingApprovals.m1.requestState).toEqual({ foo: 'bar' });

            controller.add({ id: 'm2', origin: 'o', type: 't2' }).catch(() => {});
            cm.call('ApprovalController:rejectRequest', 'm2', new Error('rejected'));
            expect(controller.has({ id: 'm2' })).toBe(false);

            controller.add({ id: 'm3', origin: 'o3', type: 't3' }).catch(() => {});
            cm.call('ApprovalController:acceptRequest', 'm3', 'ok');
            expect(controller.has({ id: 'm3' })).toBe(false);

            controller.add({ id: 'm4', origin: 'o4', type: 't4' }).catch(() => {});
            cm.call('ApprovalController:clearRequests', new Error('done'));
            expect(controller.state.pendingApprovalCount).toBe(0);
        });
    });
});
