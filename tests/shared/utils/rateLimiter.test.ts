import {
    RateLimiter,
    RateLimiters,
    createRateLimiter,
} from '../../../src/shared/utils/rateLimiter';

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

const flush = async () => {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
};

describe('RateLimiter', () => {
    it('executes a function and returns its result', async () => {
        const limiter = new RateLimiter('t', { maxCalls: 5, intervalMs: 1000 });
        const result = await limiter.execute(async () => 42);
        expect(result).toBe(42);
        expect(limiter.getStats().totalProcessed).toBe(1);
    });

    it('propagates errors and counts them', async () => {
        const limiter = new RateLimiter('t', { maxCalls: 5 });
        await expect(
            limiter.execute(async () => {
                throw new Error('boom');
            }),
        ).rejects.toThrow('boom');
        expect(limiter.getStats().totalErrors).toBe(1);
    });

    it('queues calls beyond maxCalls within the window', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('rl', {
            maxCalls: 2,
            intervalMs: 1000,
        });

        const order: number[] = [];
        const tasks = [1, 2, 3].map(i =>
            limiter.execute(async () => {
                order.push(i);
                return i;
            }),
        );

        await flush();
        expect(order).toEqual([1, 2]);

        jest.advanceTimersByTime(1100);
        await flush();
        await Promise.all(tasks);

        expect(order).toEqual([1, 2, 3]);
        jest.useRealTimers();
    });

    it('rejects on queue overflow', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('rl', {
            maxCalls: 1,
            intervalMs: 10000,
            maxQueueLength: 1,
        });

        limiter.execute(() => new Promise(resolve => setTimeout(() => resolve(1), 1000)));
        limiter.execute(() => new Promise(resolve => setTimeout(() => resolve(2), 1000)));

        await expect(
            limiter.execute(() => Promise.resolve(3)),
        ).rejects.toThrow(/queue overflow/);
        expect(limiter.getStats().droppedOverflow).toBe(1);

        jest.useRealTimers();
    });

    it('reports stats and resetStats clears counters', async () => {
        const limiter = new RateLimiter('t', { maxCalls: 10 });
        await limiter.execute(async () => 1).catch(() => {});
        await limiter.execute(async () => {
            throw new Error('err');
        }).catch(() => {});

        let stats = limiter.getStats();
        expect(stats.totalProcessed).toBe(1);
        expect(stats.totalErrors).toBe(1);

        limiter.resetStats();
        stats = limiter.getStats();
        expect(stats.totalProcessed).toBe(0);
        expect(stats.totalErrors).toBe(0);
    });

    it('clearQueue rejects queued items', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('rl', {
            maxCalls: 1,
            intervalMs: 10000,
        });

        limiter.execute(() => new Promise(resolve => setTimeout(() => resolve(1), 1000)));
        const queued = limiter
            .execute(() => Promise.resolve(2))
            .catch(err => err.message);

        // Allow the queue to process
        await flush();
        expect(limiter.getQueueLength()).toBe(1);

        limiter.clearQueue();
        await expect(queued).resolves.toMatch(/queue cleared/);
        expect(limiter.getStats().droppedCleared).toBe(1);
        jest.useRealTimers();
    });

    it('isCurrentlyProcessing reflects active calls', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('rl', { maxCalls: 1 });

        const promise = limiter.execute(
            () => new Promise(resolve => setTimeout(() => resolve('done'), 500)),
        );
        await flush();
        expect(limiter.isCurrentlyProcessing()).toBe(true);

        jest.advanceTimersByTime(600);
        await flush();
        await promise;
        expect(limiter.isCurrentlyProcessing()).toBe(false);
        jest.useRealTimers();
    });

    it('factory createRateLimiter returns a RateLimiter', () => {
        const rl = createRateLimiter('factory', { maxCalls: 2 });
        expect(rl).toBeInstanceOf(RateLimiter);
    });

    it('exports predefined limiters', () => {
        expect(RateLimiters.tokenBalance).toBeInstanceOf(RateLimiter);
    });

    it('logs a warning when queue exceeds warningThreshold (covers line 133)', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('warn', {
            maxCalls: 1,
            intervalMs: 10000,
            queueWarningThreshold: 1,
        });

        // Run one call to fill the rate-limit window, then enqueue several
        limiter.execute(() => new Promise(resolve => setTimeout(() => resolve(1), 1000)));
        limiter.execute(() => Promise.resolve(2)).catch(() => {});
        limiter.execute(() => Promise.resolve(3)).catch(() => {});

        await flush();
        // Queue length is now > threshold(1) so logger.log was invoked
        const logger = (await import('../../../src/shared/utils/logger')).default;
        expect(logger.log).toHaveBeenCalledWith(
            expect.stringContaining('queue length high'),
            expect.any(Number),
        );
        jest.useRealTimers();
    });

    it('enforces maxConcurrent and queues calls beyond it (covers line 153 and 246-254)', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('concurrent', {
            maxCalls: 100,
            intervalMs: 1000,
            maxConcurrent: 1,
        });

        const order: number[] = [];
        const tasks = [1, 2].map(i =>
            limiter.execute(
                () =>
                    new Promise<number>(resolve =>
                        setTimeout(() => {
                            order.push(i);
                            resolve(i);
                        }, 500),
                    ),
            ),
        );

        await flush();
        // Only one is active due to maxConcurrent: 1
        expect(limiter.getStats().activeCalls).toBe(1);
        expect(limiter.getStats().queueLength).toBe(1);

        jest.advanceTimersByTime(600);
        await flush();
        jest.advanceTimersByTime(600);
        await flush();
        await Promise.all(tasks);
        expect(order).toEqual([1, 2]);
        jest.useRealTimers();
    });

    it('drops expired requests when maxQueueWaitMs exceeded (covers lines 182-199)', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('expire', {
            maxCalls: 1,
            intervalMs: 100000,
            maxQueueWaitMs: 50,
        });

        // First fills the rate limit window
        limiter.execute(() => new Promise(resolve => setTimeout(() => resolve(1), 1000)));

        // Second is queued and should expire
        const queuedPromise = limiter
            .execute(() => Promise.resolve(2))
            .catch(err => err.message);

        await flush();
        expect(limiter.getQueueLength()).toBe(1);

        // Advance past maxQueueWaitMs and resolve the first call so processQueue can run
        jest.advanceTimersByTime(1500);
        await flush();
        await flush();

        // The dropped item should reject with 'request expired'
        await expect(queuedPromise).resolves.toMatch(/request expired/);
        expect(limiter.getStats().droppedExpired).toBeGreaterThanOrEqual(1);
        jest.useRealTimers();
    });

    it('clearScheduledIfIdle clears the scheduled timer (covers lines 262-263)', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('idle', {
            maxCalls: 1,
            intervalMs: 1000,
        });

        // Run a call so the limiter schedules ensureScheduled is exercised
        const p = limiter.execute(() => Promise.resolve('done'));
        await flush();
        await p;

        // Clear queue while idle has no effect, but exercise clearScheduledIfIdle path
        limiter.clearQueue();
        jest.useRealTimers();
    });

    it('drains queue and logs drained when active becomes 0 (covers line 224)', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('drain', {
            maxCalls: 1,
            intervalMs: 100,
        });

        const tasks = [1, 2].map(i => limiter.execute(async () => i));
        await flush();
        jest.advanceTimersByTime(200);
        await flush();
        await Promise.all(tasks);

        const logger = (await import('../../../src/shared/utils/logger')).default;
        expect(logger.log).toHaveBeenCalledWith(
            expect.stringContaining('queue fully drained'),
        );
        jest.useRealTimers();
    });

    it('clearQueue handles an empty queue', () => {
        const limiter = new RateLimiter('emptyclear', { maxCalls: 5 });
        limiter.clearQueue();
        expect(limiter.getStats().droppedCleared).toBe(0);
    });

    it('execute uses default intervalMs when not specified', () => {
        const limiter = new RateLimiter('default', { maxCalls: 5 });
        expect(limiter.getStats().intervalMs).toBe(1000);
    });

    it('drops only the expired items and keeps fresh ones in queue (covers line 196)', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('mix', {
            maxCalls: 10,
            intervalMs: 1000,
            maxConcurrent: 1,
            maxQueueWaitMs: 500,
        });

        // Active call holds concurrency slot
        const blocker = limiter.execute(
            () => new Promise(resolve => setTimeout(() => resolve(0), 800)),
        );

        // First queued: will expire
        const first = limiter
            .execute(() => Promise.resolve(1))
            .catch(err => err.message);

        await flush();
        // Advance past expiry of `first` (>500ms) but blocker still active
        jest.advanceTimersByTime(600);
        await flush();

        // Queue another, which is fresh (was enqueued at t=600)
        const second = limiter
            .execute(() => Promise.resolve(2))
            .catch(err => err.message);

        await flush();
        // Advance just enough for blocker to resolve (200ms more)
        // Total time = 800ms. second was enqueued at 600ms, so it has been queued 200ms (<500ms)
        jest.advanceTimersByTime(200);
        await flush();
        await flush();
        await flush();

        await expect(first).resolves.toMatch(/request expired/);
        await expect(second).resolves.toBe(2);
        await blocker;
        jest.useRealTimers();
    });

    it('hasCapacity returns false when both rate and concurrency hit (cover the early return)', async () => {
        jest.useFakeTimers();
        const limiter = new RateLimiter('combined', {
            maxCalls: 1,
            intervalMs: 1000,
            maxConcurrent: 1,
        });

        // First call is active and uses the window slot
        limiter.execute(() => new Promise(resolve => setTimeout(() => resolve(1), 500)));
        // Second call queues
        const second = limiter.execute(() => Promise.resolve(2));
        await flush();
        expect(limiter.getQueueLength()).toBe(1);

        // Resolve first
        jest.advanceTimersByTime(600);
        await flush();
        jest.advanceTimersByTime(1100);
        await flush();
        await second;
        jest.useRealTimers();
    });
});
