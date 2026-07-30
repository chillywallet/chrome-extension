import {
    generateActionId,
    submitRequestToBackground,
    setBackgroundConnection,
} from '../../src/store/backgroundConnection';

describe('backgroundConnection', () => {
    afterEach(async () => {
        await setBackgroundConnection(null);
    });

    it('generateActionId returns a numeric id', () => {
        const id = generateActionId();
        expect(typeof id).toBe('number');
    });

    it('submitRequestToBackground resolves with data when callback succeeds', async () => {
        await setBackgroundConnection({
            getThing: jest.fn((cb: any) => cb(null, 'ok')),
        } as any);

        await expect(submitRequestToBackground('getThing')).resolves.toBe('ok');
    });

    it('submitRequestToBackground rejects with error when callback errors', async () => {
        await setBackgroundConnection({
            failingMethod: jest.fn((cb: any) => cb(new Error('boom'))),
        } as any);

        await expect(submitRequestToBackground('failingMethod')).rejects.toThrow('boom');
    });

    it('submitRequestToBackground forwards args', async () => {
        const myMethod = jest.fn((a: number, b: number, cb: any) => cb(null, a + b));
        await setBackgroundConnection({ myMethod } as any);
        const result = await submitRequestToBackground<number>('myMethod', [2, 3]);
        expect(result).toBe(5);
    });
});
