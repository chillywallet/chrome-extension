import getFetchWithTimeout from '../../src/lib/fetch-with-timeout';

describe('getFetchWithTimeout', () => {
    const originalFetch = window.fetch;
    const originalAbortController = window.AbortController;

    beforeEach(() => {
        (window as any).fetch = jest.fn();
        (window as any).AbortController = global.AbortController;
    });

    afterEach(() => {
        (window as any).fetch = originalFetch;
        (window as any).AbortController = originalAbortController;
    });

    it('throws for non-positive integer timeout', () => {
        // memoized: pick unique unused values to avoid collisions across runs
        expect(() => getFetchWithTimeout(-1)).toThrow(/positive integer timeout/);
        expect(() => getFetchWithTimeout(1.5)).toThrow(/positive integer timeout/);
    });

    it('forwards the call to window.fetch and resolves with response', async () => {
        const fakeResponse = { ok: true } as Response;
        (window.fetch as jest.Mock).mockResolvedValue(fakeResponse);

        const fwt = getFetchWithTimeout(60000);
        const result = await fwt('https://x.test');
        expect(window.fetch).toHaveBeenCalled();
        expect(result).toBe(fakeResponse);
    });

    it('aborts the request when the timeout fires', async () => {
        jest.useFakeTimers();

        (window.fetch as jest.Mock).mockImplementation(
            (_url: string, opts: any) =>
                new Promise((_resolve, reject) => {
                    opts.signal.addEventListener('abort', () => {
                        reject(new Error('aborted'));
                    });
                }),
        );

        const fwt = getFetchWithTimeout(1234);
        const pending = fwt('https://x.test').catch(err => err.message);

        jest.advanceTimersByTime(1500);
        await expect(pending).resolves.toBe('aborted');
        jest.useRealTimers();
    });

    it('chains a caller-provided abort signal', async () => {
        const callerController = new AbortController();
        (window.fetch as jest.Mock).mockImplementation(
            (_url: string, opts: any) =>
                new Promise((_resolve, reject) => {
                    opts.signal.addEventListener('abort', () => {
                        reject(new Error('caller-aborted'));
                    });
                }),
        );

        const fwt = getFetchWithTimeout(60001);
        const pending = fwt('https://x.test', { signal: callerController.signal }).catch(
            (err: Error) => err.message,
        );
        callerController.abort();
        await expect(pending).resolves.toBe('caller-aborted');
    });
});
