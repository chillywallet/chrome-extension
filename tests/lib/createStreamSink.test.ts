import createStreamSink from '../../src/lib/createStreamSink';

describe('createStreamSink', () => {
    it('writes chunks through the async write function', done => {
        const writes: any[] = [];
        const asyncWrite = jest.fn(async (chunk: any) => {
            writes.push(chunk);
        });
        const sink = createStreamSink(asyncWrite);

        sink.write({ foo: 'bar' }, undefined as any, err => {
            try {
                expect(err).toBeFalsy();
                expect(asyncWrite).toHaveBeenCalledWith({ foo: 'bar' }, expect.anything());
                expect(writes).toEqual([{ foo: 'bar' }]);
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('propagates rejection from asyncWriteFn as an error', done => {
        const asyncWrite = jest.fn(async () => {
            throw new Error('boom');
        });
        const sink = createStreamSink(asyncWrite);

        sink.on('error', err => {
            try {
                expect(err).toBeInstanceOf(Error);
                expect((err as Error).message).toBe('boom');
                done();
            } catch (e) {
                done(e);
            }
        });

        sink.write({ x: 1 });
    });
});
