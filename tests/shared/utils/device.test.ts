describe('generateDeviceId', () => {
    beforeAll(() => {
        if (typeof (global as any).TextEncoder === 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { TextEncoder } = require('util');
            (global as any).TextEncoder = TextEncoder;
        }
        const fakeDigest = async (_alg: string, data: ArrayBuffer) => {
            const bytes = new Uint8Array(data);
            const out = new Uint8Array(32);
            for (let i = 0; i < bytes.length; i++) {
                out[i % 32] = (out[i % 32] + bytes[i]) & 0xff;
            }
            return out.buffer;
        };
        Object.defineProperty(global, 'crypto', {
            value: { subtle: { digest: fakeDigest } },
            configurable: true,
            writable: true,
        });
        Object.defineProperty(window, 'crypto', {
            value: { subtle: { digest: fakeDigest } },
            configurable: true,
            writable: true,
        });
    });

    it('returns a deterministic 64-character hex string', async () => {
        const { generateDeviceId } = await import('../../../src/shared/utils/device');
        const a = await generateDeviceId();
        const b = await generateDeviceId();
        expect(a).toHaveLength(64);
        expect(a).toMatch(/^[0-9a-f]+$/);
        expect(a).toBe(b);
    });
});
