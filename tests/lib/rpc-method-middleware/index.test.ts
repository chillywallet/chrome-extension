import localHandlers from '../../../src/lib/rpc-method-middleware';

describe('rpc-method-middleware handlers index', () => {
    it('returns an array of handlers', () => {
        expect(Array.isArray(localHandlers)).toBe(true);
        expect(localHandlers.length).toBeGreaterThan(0);
    });

    it('each handler exposes methodNames and implementation', () => {
        for (const handler of localHandlers) {
            expect(Array.isArray(handler.methodNames)).toBe(true);
            expect(typeof handler.implementation).toBe('function');
        }
    });
});
