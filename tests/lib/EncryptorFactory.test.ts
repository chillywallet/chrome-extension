import * as bp from '@metamask/browser-passworder';
import { encryptorFactory } from '../../src/lib/EncryptorFactory';

jest.mock('@metamask/browser-passworder', () => {
    return {
        encrypt: jest.fn(async (..._args: any[]) => ({ ok: 'encrypt' })),
        encryptWithDetail: jest.fn(async (..._args: any[]) => ({ ok: 'encryptWithDetail' })),
        decrypt: jest.fn(),
        decryptWithKey: jest.fn(),
        decryptWithDetail: jest.fn(),
        encryptWithKey: jest.fn(),
        importKey: jest.fn(),
        exportKey: jest.fn(),
        generateSalt: jest.fn(() => 'salt'),
        keyFromPassword: jest.fn(async (..._args: any[]) => ({ ok: 'keyFromPassword' })),
        isVaultUpdated: jest.fn(() => true),
    };
});

describe('encryptorFactory', () => {
    beforeEach(() => {
        (bp.encrypt as jest.Mock).mockClear();
        (bp.encryptWithDetail as jest.Mock).mockClear();
        (bp.keyFromPassword as jest.Mock).mockClear();
        (bp.isVaultUpdated as jest.Mock).mockClear();
    });

    it('exposes the wrapped functions', () => {
        const enc = encryptorFactory(600000);
        expect(typeof enc.encrypt).toBe('function');
        expect(typeof enc.encryptWithDetail).toBe('function');
        expect(typeof enc.keyFromPassword).toBe('function');
        expect(typeof enc.isVaultUpdated).toBe('function');
        expect(typeof enc.generateSalt).toBe('function');
    });

    it('encrypt passes PBKDF2 iterations through to browser-passworder', async () => {
        const enc = encryptorFactory(123);
        await enc.encrypt('pw', { secret: 'x' });
        const lastCall = (bp.encrypt as jest.Mock).mock.calls[0];
        const opts = lastCall[4];
        expect(opts.algorithm).toBe('PBKDF2');
        expect(opts.params.iterations).toBe(123);
    });

    it('encryptWithDetail passes iterations through', async () => {
        const enc = encryptorFactory(7);
        await enc.encryptWithDetail('pw', { o: 1 });
        const opts = (bp.encryptWithDetail as jest.Mock).mock.calls[0][3];
        expect(opts.params.iterations).toBe(7);
    });

    it('keyFromPassword uses default iterations when no opts provided', async () => {
        const enc = encryptorFactory(500);
        await enc.keyFromPassword('pw', 'salt');
        const opts = (bp.keyFromPassword as jest.Mock).mock.calls[0][3];
        expect(opts.params.iterations).toBe(500);
    });

    it('keyFromPassword respects caller-provided opts', async () => {
        const enc = encryptorFactory(500);
        const customOpts = { algorithm: 'PBKDF2', params: { iterations: 1 } } as any;
        await enc.keyFromPassword('pw', 'salt', true, customOpts);
        const opts = (bp.keyFromPassword as jest.Mock).mock.calls[0][3];
        expect(opts.params.iterations).toBe(1);
    });

    it('isVaultUpdated uses iterations to check the vault', () => {
        const enc = encryptorFactory(600000);
        enc.isVaultUpdated('vault-string');
        expect(bp.isVaultUpdated).toHaveBeenCalledWith(
            'vault-string',
            expect.objectContaining({
                algorithm: 'PBKDF2',
                params: { iterations: 600000 },
            }),
        );
    });
});
