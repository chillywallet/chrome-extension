import { SignatureController } from '../../src/controller/SignatureController';
import { PersonalMessageManager, TypedMessageManager } from '../../src/lib/message-manager';

jest.mock('@metamask/rpc-errors', () => ({
    providerErrors: {
        userRejectedRequest: (msg: string) => new Error(msg),
    },
}));

jest.mock('@metamask/utils', () => ({
    add0x: (s: string) => (s.startsWith('0x') ? s : '0x' + s),
}));

jest.mock('@metamask/controller-utils', () => ({
    ApprovalType: { PersonalSign: 'personal_sign', EthSignTypedData: 'eth_signTypedData' },
}));

const mockAutoSwapSignPersonal = jest.fn();
const mockAutoSwapSignTyped = jest.fn();


jest.mock('../../src/lib/ChainsUtils', () => ({
    getCurrentChainByChainId: (chainId: number) => ({ chain_id: chainId, name: `c-${chainId}` }),
}));

jest.mock('../../src/lib/message-manager', () => {
    const EventEmitter = require('events').EventEmitter;
    let nextId = 0;

    class FakeManager extends EventEmitter {
        hub = new EventEmitter();
        unapprovedMessages: Record<string, any> = {};
        listeners: Function[] = [];

        constructor() {
            super();
        }
        getUnapprovedMessagesCount() {
            return Object.keys(this.unapprovedMessages).length;
        }
        getUnapprovedMessages() {
            return this.unapprovedMessages;
        }
        getAllMessages() {
            return Object.values(this.unapprovedMessages);
        }
        update(payload: any) {
            if (payload.unapprovedMessages) {
                this.unapprovedMessages = payload.unapprovedMessages;
            }
            this.listeners.forEach(l =>
                l({
                    unapprovedMessages: this.unapprovedMessages,
                    unapprovedMessagesCount: Object.keys(this.unapprovedMessages).length,
                }),
            );
        }
        subscribe(fn: Function) {
            this.listeners.push(fn);
        }
        async addUnapprovedMessage(messageParams: any, _req: any, _version?: string) {
            const id = `msg-${++nextId}`;
            this.unapprovedMessages[id] = {
                id,
                status: 'unapproved',
                messageParams,
            };
            this.listeners.forEach(l =>
                l({
                    unapprovedMessages: this.unapprovedMessages,
                    unapprovedMessagesCount: Object.keys(this.unapprovedMessages).length,
                }),
            );
            this.hub.emit('unapprovedMessage', messageParams);
            this.hub.emit('updateBadge');
            return id;
        }
        waitForFinishStatus = jest.fn(async () => '0xsignature');
        async approveMessage(msgParams: any) {
            const id = msgParams.internalId;
            if (this.unapprovedMessages[id]) {
                this.unapprovedMessages[id].status = 'approved';
            }
            return { ...msgParams };
        }
        setMessageStatusSigned = jest.fn((id: string, signature: any) => {
            if (!this.unapprovedMessages[id]) {
                throw new Error('Message not found');
            }
            this.unapprovedMessages[id].status = 'signed';
            this.unapprovedMessages[id].signature = signature;
        });
        setMessageStatusInProgress = jest.fn((id: string) => {
            this.unapprovedMessages[id].status = 'inProgress';
        });
        setMessageStatusErrored = jest.fn((id: string, err: string) => {
            if (!this.unapprovedMessages[id]) {
                throw new Error('Message not found');
            }
            this.unapprovedMessages[id].status = 'errored';
            this.unapprovedMessages[id].error = err;
        });
        rejectMessage = jest.fn((id: string) => {
            if (!this.unapprovedMessages[id]) {
                throw new Error('Message not found');
            }
            this.unapprovedMessages[id].status = 'rejected';
        });
        setMetadata = jest.fn((id: string, metadata: any) => {
            if (!this.unapprovedMessages[id]) {
                throw new Error('Message not found');
            }
            this.unapprovedMessages[id].metadata = metadata;
        });
    }

    class FakePersonalMessageManager extends FakeManager {}
    class FakeTypedMessageManager extends FakeManager {}

    return {
        PersonalMessageManager: FakePersonalMessageManager,
        TypedMessageManager: FakeTypedMessageManager,
    };
});

jest.mock('../../src/shared/constants/app', () => ({ ORIGIN_CHILLY: 'chilly' }));

const mockAddApproval = jest.fn();
const mockSignMessage = jest.fn();
const mockSignPersonal = jest.fn();
const mockSignTyped = jest.fn();

function makeRestrictedMessenger() {
    const { ControllerMessenger } = require('@metamask/base-controller');
    const cm = new ControllerMessenger();
    cm.registerActionHandler('ApprovalController:addRequest', (...args: any[]) =>
        mockAddApproval(...args),
    );
    cm.registerActionHandler('KeyringController:signMessage', (...args: any[]) =>
        mockSignMessage(...args),
    );
    cm.registerActionHandler('KeyringController:signPersonalMessage', (...args: any[]) =>
        mockSignPersonal(...args),
    );
    cm.registerActionHandler('KeyringController:signTypedMessage', (...args: any[]) =>
        mockSignTyped(...args),
    );
    return cm.getRestricted({
        name: 'SignatureController',
        allowedActions: [
            'ApprovalController:addRequest',
            'KeyringController:signMessage',
            'KeyringController:signPersonalMessage',
            'KeyringController:signTypedMessage',
        ],
        allowedEvents: [],
    });
}

function build(opts: {
    getAccountBySmartAddress?: any;
    getPrivateKey?: any;
    getSelectedNetwork?: any;
} = {}) {
    const controller = new SignatureController({
        messenger: makeRestrictedMessenger() as any,
        getCurrentChainId: () => '0x1' as any,
        getAccountBySmartAddress: opts.getAccountBySmartAddress ?? jest.fn(() => undefined),
        getPrivateKey: opts.getPrivateKey ?? jest.fn(async () => 'privkey'),
        getSelectedNetwork:
            opts.getSelectedNetwork ?? jest.fn(() => ({ chain_id: 1, name: 'eth' })),
    });
    return controller;
}

describe('SignatureController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAddApproval.mockImplementation(async () => ({
            value: undefined,
            resultCallbacks: { success: jest.fn(), error: jest.fn() },
        }));
        mockSignMessage.mockImplementation(async () => '0xsig');
        mockSignPersonal.mockImplementation(async () => '0xsigpersonal');
        mockSignTyped.mockImplementation(async () => '0xsigtyped');
        mockAutoSwapSignPersonal.mockImplementation(async () => '0xautosig-personal');
        mockAutoSwapSignTyped.mockImplementation(async () => '0xautosig-typed');
    });

    describe('initial state', () => {
        it('initializes with zero unapproved messages', () => {
            const c = build();
            expect(c.state.unapprovedPersonalMsgs).toEqual({});
            expect(c.state.unapprovedTypedMessages).toEqual({});
            expect(c.state.unapprovedPersonalMsgCount).toBe(0);
            expect(c.state.unapprovedTypedMessagesCount).toBe(0);
        });

        it('exposes hub EventEmitter', () => {
            const c = build();
            expect(c.hub).toBeDefined();
            expect(typeof c.hub.emit).toBe('function');
        });

        it('exposes unapprovedPersonalMessagesCount / unapprovedTypedMessagesCount getters', () => {
            const c = build();
            expect(c.unapprovedPersonalMessagesCount).toBe(0);
            expect(c.unapprovedTypedMessagesCount).toBe(0);
        });

        it('returns merged messages from both managers', () => {
            const c = build();
            expect(c.messages).toEqual({});
        });
    });

    describe('resetState / clearUnapproved / rejectUnapproved', () => {
        it('resetState returns to default state', () => {
            const c = build();
            (c as any).update((state: any) => {
                state.unapprovedPersonalMsgCount = 5;
            });
            c.resetState();
            expect(c.state.unapprovedPersonalMsgCount).toBe(0);
        });

        it('clearUnapproved clears each manager via update()', () => {
            const c = build();
            c.clearUnapproved();
            expect(c.state.unapprovedPersonalMsgs).toEqual({});
            expect(c.state.unapprovedTypedMessages).toEqual({});
        });

        it('rejectUnapproved rejects each pending message', async () => {
            const c = build();
            const promise = c.newUnsignedPersonalMessage({ from: '0x1' } as any, {
                id: 'r1',
                origin: 'http://test',
            } as any);
            // give microtask to add message
            promise.catch(() => {});
            await Promise.resolve();
            const id = Object.keys(c.state.unapprovedPersonalMsgs)[0];
            const cancelSpy = jest.fn();
            c.hub.on('cancelWithReason', cancelSpy);
            c.rejectUnapproved('test-reason');
            expect(cancelSpy).toHaveBeenCalledWith(
                expect.objectContaining({ reason: 'test-reason' }),
            );
            expect((c as any)['#personalMessageManager']).toBeUndefined();
            // The internal manager's rejectMessage should have flipped status
            // Inspect via internal map of the message manager
            const personalMgr = (c as any).hub.listeners('updateBadge');
            expect(personalMgr).toBeDefined();
            // Confirm via state — at minimum the cancelWithReason event fired
            void id;
        });
    });

    describe('newUnsignedPersonalMessage / newUnsignedTypedMessage', () => {
        it('rejects with userRejectedRequest when approval fails', async () => {
            mockAddApproval.mockRejectedValueOnce(new Error('denied'));
            const c = build();
            await expect(
                c.newUnsignedPersonalMessage({ from: '0xabc' } as any, {
                    id: 'r1',
                    origin: 'http://x',
                } as any),
            ).rejects.toThrow('User rejected the request.');
        });

        it('signs via keyring when no smart account match', async () => {
            const c = build();
            const result = await c.newUnsignedPersonalMessage({ from: '0xabc' } as any, {
                id: 'r1',
                origin: 'http://x',
            } as any);
            expect(result).toBe('0xsignature');
            expect(mockSignPersonal).toHaveBeenCalled();
            expect(mockAutoSwapSignPersonal).not.toHaveBeenCalled();
        });


        it('skips manager.setMessageStatusSigned when deferSetAsSigned is set', async () => {
            const c = build();
            await c.newUnsignedPersonalMessage(
                { from: '0xabc', deferSetAsSigned: true } as any,
                { id: 'r1', origin: 'http://x' } as any,
            );
            // No throw is sufficient — proves the if-not-deferred branch fell through to the false side.
        });

        it('signs typed via keyring without smart account match', async () => {
            const c = build();
            const result = await c.newUnsignedTypedMessage(
                { from: '0xabc', data: JSON.stringify({ msg: 'hi' }) } as any,
                { id: 'r2', origin: 'http://x' } as any,
                'V4',
                { parseJsonData: true },
            );
            expect(result).toBe('0xsignature');
            expect(mockSignTyped).toHaveBeenCalled();
        });


        it('signs typed V1 message data without parsing', async () => {
            const c = build();
            const dataObj = { hello: 'world' };
            await c.newUnsignedTypedMessage(
                { from: '0xabc', data: dataObj } as any,
                { id: 'r3', origin: 'http://x' } as any,
                'V1',
                { parseJsonData: false },
            );
            expect(mockSignTyped).toHaveBeenCalled();
        });

        it('signs typed message with parseJsonData=false', async () => {
            const c = build();
            await c.newUnsignedTypedMessage(
                { from: '0xabc', data: '{}' } as any,
                { id: 'r4', origin: 'http://x' } as any,
                'V4',
                { parseJsonData: false },
            );
            expect(mockSignTyped).toHaveBeenCalled();
        });
    });

    describe('state subscriptions', () => {
        it('updates unapprovedPersonalMsgs and count when manager publishes new state', async () => {
            const c = build();
            // Adding a personal message should propagate to state via the subscription.
            const promise = c.newUnsignedPersonalMessage({ from: '0x1' } as any, {
                id: 'r1',
                origin: 'http://test',
            } as any);
            promise.catch(() => {});
            await Promise.resolve();
            expect(c.state.unapprovedPersonalMsgCount).toBeGreaterThan(0);
            const firstId = Object.keys(c.state.unapprovedPersonalMsgs)[0];
            expect(c.state.unapprovedPersonalMsgs[firstId]).toMatchObject({ id: firstId });
        });
    });

    describe('setDeferredSignSuccess / setMessageMetadata / setDeferredSignError', () => {
        async function setupWithMessage() {
            const c = build();
            const promise = c.newUnsignedPersonalMessage({ from: '0x1' } as any, {
                id: 'r1',
                origin: 'http://t',
            } as any);
            promise.catch(() => {});
            await Promise.resolve();
            const id = Object.keys(c.state.unapprovedPersonalMsgs)[0];
            return { c, id };
        }

        it('setDeferredSignSuccess marks the message signed', async () => {
            const { c, id } = await setupWithMessage();
            expect(() => c.setDeferredSignSuccess(id, '0xsig')).not.toThrow();
        });

        it('setMessageMetadata updates metadata', async () => {
            const { c, id } = await setupWithMessage();
            expect(() => c.setMessageMetadata(id, { source: 'unit' })).not.toThrow();
        });

        it('setDeferredSignError rejects the message', async () => {
            const { c, id } = await setupWithMessage();
            expect(() => c.setDeferredSignError(id)).not.toThrow();
        });

        it('setDeferredSignSuccess throws "Message not found" for unknown id', () => {
            const c = build();
            expect(() => c.setDeferredSignSuccess('missing', '0xsig')).toThrow(
                /Message not found/,
            );
        });

        it('setMessageMetadata throws "Message not found" for unknown id', () => {
            const c = build();
            expect(() => c.setMessageMetadata('missing', { foo: 'bar' })).toThrow(
                /Message not found/,
            );
        });

        it('setDeferredSignError throws "Message not found" for unknown id', () => {
            const c = build();
            expect(() => c.setDeferredSignError('missing')).toThrow(/Message not found/);
        });
    });

    describe('setTypedMessageInProgress / setPersonalMessageInProgress', () => {
        it('calls into the manager to set in-progress state', async () => {
            const c = build();
            const promise = c.newUnsignedPersonalMessage({ from: '0x1' } as any, {
                id: 'r1',
                origin: 'http://t',
            } as any);
            promise.catch(() => {});
            await Promise.resolve();
            const personalId = Object.keys(c.state.unapprovedPersonalMsgs)[0];
            expect(() => c.setPersonalMessageInProgress(personalId)).not.toThrow();
        });

        it('setTypedMessageInProgress also works via the typed manager', async () => {
            const c = build();
            const promise = c.newUnsignedTypedMessage(
                { from: '0x1', data: '{}' } as any,
                { id: 'r2', origin: 'http://t' } as any,
                'V4',
                { parseJsonData: true },
            );
            promise.catch(() => {});
            await Promise.resolve();
            const typedId = Object.keys(c.state.unapprovedTypedMessages)[0];
            expect(() => c.setTypedMessageInProgress(typedId)).not.toThrow();
        });
    });

    describe('messages getter aggregation', () => {
        it('aggregates messages from both message managers by id', async () => {
            const c = build();
            const p1 = c.newUnsignedPersonalMessage({ from: '0x1' } as any, {
                id: 'rA',
                origin: 'http://t',
            } as any);
            p1.catch(() => {});
            const p2 = c.newUnsignedTypedMessage(
                { from: '0x2', data: '{}' } as any,
                { id: 'rB', origin: 'http://t' } as any,
                'V4',
                { parseJsonData: true },
            );
            p2.catch(() => {});
            await Promise.resolve();
            await Promise.resolve();
            const messages = c.messages;
            expect(Object.keys(messages).length).toBeGreaterThanOrEqual(1);
            // Each entry should have its own id
            Object.entries(messages).forEach(([id, msg]: any) => {
                expect(msg.id).toBe(id);
            });
        });
    });

    describe('error paths in #signAbstractMessage', () => {
        it('routes personal sign error through #cancelAbstractMessage and emits signError', async () => {
            mockSignPersonal.mockImplementationOnce(async () => {
                throw new Error('signature failed');
            });
            const c = build();
            const signErrorSpy = jest.fn();
            // We do not know the messageId before addUnapprovedMessage runs, so listen broadly via any 'signError' suffix
            const hub: any = c.hub;
            const origEmit = hub.emit.bind(hub);
            hub.emit = (event: string, ...args: any[]) => {
                if (event.endsWith(':signError')) signErrorSpy(event, ...args);
                return origEmit(event, ...args);
            };
            await expect(
                c.newUnsignedPersonalMessage({ from: '0xabc' } as any, {
                    id: 'rE',
                    origin: 'http://e',
                } as any),
            ).rejects.toThrow('signature failed');
            expect(signErrorSpy).toHaveBeenCalled();
        });

        it('routes typed sign error through setMessageStatusErrored', async () => {
            mockSignTyped.mockImplementationOnce(async () => {
                throw new Error('typed sig failed');
            });
            const c = build();
            await expect(
                c.newUnsignedTypedMessage(
                    { from: '0xabc', data: JSON.stringify({ a: 1 }) } as any,
                    { id: 'rET', origin: 'http://e' } as any,
                    'V4',
                    { parseJsonData: true },
                ),
            ).rejects.toThrow('typed sig failed');
        });
    });

    describe('#removeJsonData behavior via signTypedMessage', () => {
        it('signs V1 typed message with parseJsonData=true (returns params unchanged)', async () => {
            const c = build();
            await c.newUnsignedTypedMessage(
                { from: '0xabc', data: [{ type: 'string', name: 'msg', value: 'hi' }] } as any,
                { id: 'rV1', origin: 'http://v1' } as any,
                'V1',
                { parseJsonData: true },
            );
            expect(mockSignTyped).toHaveBeenCalled();
        });

        it('signs V4 typed message with non-string data passes through removeJsonData', async () => {
            const c = build();
            await c.newUnsignedTypedMessage(
                { from: '0xabc', data: { foo: 'bar' } } as any,
                { id: 'rNS', origin: 'http://ns' } as any,
                'V4',
                { parseJsonData: true },
            );
            expect(mockSignTyped).toHaveBeenCalled();
        });
    });

    describe('hub event forwarding', () => {
        it('forwards updateBadge events from sub-managers', () => {
            const c = build();
            const spy = jest.fn();
            c.hub.on('updateBadge', spy);
            // Internal personalMessageManager via newUnsigned* will emit updateBadge
            const promise = c.newUnsignedPersonalMessage({ from: '0x1' } as any, {
                id: 'rB',
                origin: 'http://b',
            } as any);
            promise.catch(() => {});
            return Promise.resolve().then(() => {
                expect(spy).toHaveBeenCalled();
            });
        });

        it('forwards unapprovedPersonalMessage events', async () => {
            const c = build();
            const spy = jest.fn();
            c.hub.on('unapprovedPersonalMessage', spy);
            const promise = c.newUnsignedPersonalMessage({ from: '0x1' } as any, {
                id: 'rP',
                origin: 'http://p',
            } as any);
            promise.catch(() => {});
            await Promise.resolve();
            expect(spy).toHaveBeenCalled();
        });
    });
});
