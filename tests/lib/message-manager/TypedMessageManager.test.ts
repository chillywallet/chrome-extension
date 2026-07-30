import { TypedMessageManager } from '../../../src/lib/message-manager/TypedMessageManager';

const VALID_ADDRESS = '0x0123456789abcdef0123456789abcdef01234567';

const validV3Data = JSON.stringify({
    types: { EIP712Domain: [{ name: 'name', type: 'string' }] },
    primaryType: 'EIP712Domain',
    domain: { name: 'T', chainId: 1 },
    message: {},
});

describe('TypedMessageManager', () => {
    it('adds an unapproved V3 message', async () => {
        const mgr = new TypedMessageManager(undefined, undefined, undefined, undefined, () => '0x1');
        const id = await mgr.addUnapprovedMessage(
            { from: VALID_ADDRESS, data: validV3Data },
            { id: 1, origin: 'site' },
            'V3',
        );
        expect(typeof id).toBe('string');
        const msg = mgr.getMessage(id)!;
        expect(msg.status).toBe('unapproved');
    });

    it('adds an unapproved V4 message and stringifies object data', async () => {
        const mgr = new TypedMessageManager(undefined, undefined, undefined, undefined, () => '0x1');
        const id = await mgr.addUnapprovedMessage(
            { from: VALID_ADDRESS, data: JSON.parse(validV3Data) },
            undefined,
            'V4',
        );
        const msg = mgr.getMessage(id)!;
        expect(typeof msg.messageParams.data).toBe('string');
    });

    it('rejects invalid V1 data shape', async () => {
        const mgr = new TypedMessageManager();
        await expect(
            mgr.addUnapprovedMessage({ from: VALID_ADDRESS, data: 'not-array' } as any, undefined, 'V1'),
        ).rejects.toThrow();
    });

    it('setMessageStatusErrored sets error and status', async () => {
        const mgr = new TypedMessageManager(undefined, undefined, undefined, undefined, () => '0x1');
        const id = await mgr.addUnapprovedMessage(
            { from: VALID_ADDRESS, data: validV3Data },
            undefined,
            'V3',
        );
        mgr.setMessageStatusErrored(id, 'oops');
        const msg = mgr.getMessage(id)!;
        expect(msg.error).toBe('oops');
        expect(msg.status).toBe('errored');
    });

    it('prepMessageForSigning strips internalId and version', async () => {
        const mgr = new TypedMessageManager();
        const res = await mgr.prepMessageForSigning({
            internalId: 'h',
            version: 'V3',
            from: VALID_ADDRESS,
            data: validV3Data,
        } as any);
        expect((res as any).internalId).toBeUndefined();
        expect((res as any).version).toBeUndefined();
        expect(res.from).toBe(VALID_ADDRESS);
    });

    it('setMessageStatusErrored is a no-op for unknown id', () => {
        const mgr = new TypedMessageManager();
        expect(() => mgr.setMessageStatusErrored('missing', 'oops')).not.toThrow();
    });
});
