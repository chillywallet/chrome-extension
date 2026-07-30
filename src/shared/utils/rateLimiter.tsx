import logger from './logger';

/**
 * Configuration for the RateLimiter.
 *
 * @property maxCalls - Maximum number of calls allowed within each sliding window (see `intervalMs`).
 * @property intervalMs - Sliding-window length in milliseconds. Defaults to 1000ms.
 * @property queueWarningThreshold - Queue length at which a warning log is emitted.
 * @property maxConcurrent - Hard ceiling on simultaneous in-flight calls (independent of the rate window).
 * @property maxQueueLength - Maximum queued calls allowed. New requests are rejected if exceeded.
 * @property maxQueueWaitMs - Maximum time (ms) a request may wait in the queue before being auto-rejected.
 */
export interface RateLimiterOptions {
    maxCalls: number;
    intervalMs?: number;
    queueWarningThreshold?: number;
    maxConcurrent?: number;
    maxQueueLength?: number;
    maxQueueWaitMs?: number;
}

/**
 * Public statistics snapshot for the RateLimiter.
 *
 * Provides live information about the current limiter state and lifetime counters.
 */
export interface RateLimiterStats {
    queueLength: number; // Number of queued (not yet started) calls
    activeCalls: number; // Number of in-flight calls
    callsInWindow: number; // Number of calls started within the current sliding window
    maxCalls: number; // Configured maximum calls per window
    intervalMs: number; // Window length in milliseconds
    maxConcurrent?: number; // Configured maximum concurrent in-flight calls (if any)
    totalProcessed: number; // Total number of calls resolved successfully
    totalErrors: number; // Total number of calls rejected with errors
    droppedExpired: number; // Requests dropped because they waited too long in the queue
    droppedOverflow: number; // Requests dropped because the queue was too long
    droppedCleared: number; // Requests dropped due to manual clearQueue()
}

/**
 * A sliding-window + concurrency rate limiter.
 *
 * - Enforces at most `maxCalls` call **starts** per `intervalMs` (sliding window).
 * - Optionally enforces a hard `maxConcurrent` cap on in-flight calls.
 * - Queues excess calls and schedules them precisely when capacity frees up.
 * - Enforces `maxQueueLength` to prevent runaway memory growth.
 * - Enforces `maxQueueWaitMs` to expire stale requests.
 */
export class RateLimiter {
    private queue: Array<{
        wrapped: () => Promise<any>;
        enqueuedAt: number;
        reject: (err: any) => void;
    }> = [];

    private activeCalls = 0;

    private readonly maxCalls: number;
    private readonly intervalMs: number;
    private readonly queueWarningThreshold: number;
    private readonly maxConcurrent?: number;
    private readonly maxQueueLength?: number;
    private readonly maxQueueWaitMs?: number;

    /** Sorted list of call start timestamps (ms) within the current sliding window */
    private callTimes: number[] = [];

    private totalProcessed = 0;
    private totalErrors = 0;
    private droppedExpired = 0;
    private droppedOverflow = 0;
    private droppedCleared = 0;

    private readonly name: string;

    /** Internal scheduler handle */
    private nextTick: ReturnType<typeof setTimeout> | null = null;
    private processing = false;

    constructor(name: string, options: RateLimiterOptions) {
        this.name = name;
        this.maxCalls = options.maxCalls;
        this.intervalMs = options.intervalMs ?? 1000;
        this.queueWarningThreshold = options.queueWarningThreshold ?? 10;
        this.maxConcurrent = options.maxConcurrent;
        this.maxQueueLength = options.maxQueueLength;
        this.maxQueueWaitMs = options.maxQueueWaitMs;
    }

    /**
     * Execute a function under rate limiting.
     *
     * @param fn - The async function to execute
     * @returns Promise resolving/rejecting with fn’s result/error
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const wrapped = async () => {
                try {
                    const result = await fn();
                    this.totalProcessed++;
                    resolve(result);
                } catch (err) {
                    this.totalErrors++;
                    reject(err);
                    throw err;
                }
            };

            this.pruneWindow();
            if (this.hasCapacity()) {
                this.startCall(wrapped);
            } else {
                // Reject immediately if queue is too long
                if (this.maxQueueLength !== undefined && this.queue.length >= this.maxQueueLength) {
                    this.droppedOverflow++;
                    logger.log(
                        `${this.name} RateLimiter: queue overflow (max ${this.maxQueueLength})`,
                    );
                    reject(
                        new Error(
                            `${this.name} RateLimiter: queue overflow (max ${this.maxQueueLength})`,
                        ),
                    );
                    return;
                }

                // Otherwise, enqueue request
                this.queue.push({ wrapped, enqueuedAt: Date.now(), reject });

                if (this.queue.length > this.queueWarningThreshold) {
                    logger.log(`${this.name} RateLimiter: queue length high`, this.queue.length);
                }
            }

            this.ensureScheduled();
        });
    }

    /** Drop old timestamps outside the sliding window */
    private pruneWindow() {
        const cutoff = Date.now() - this.intervalMs;
        let i = 0;
        while (i < this.callTimes.length && this.callTimes[i] < cutoff) i++;
        if (i > 0) this.callTimes.splice(0, i);
    }

    /** Check both rate and concurrency limits */
    private hasCapacity(): boolean {
        if (this.callTimes.length >= this.maxCalls) return false;
        if (this.maxConcurrent !== undefined && this.activeCalls >= this.maxConcurrent)
            return false;
        return true;
    }

    /** Begin executing a function immediately */
    private startCall(wrapped: () => Promise<any>) {
        this.activeCalls++;
        this.callTimes.push(Date.now());

        wrapped()
            .catch(() => {
                /* error already counted */
            })
            .finally(() => {
                this.activeCalls--;
                this.processQueue();
            });
    }

    /** Process as many queued calls as capacity allows */
    private processQueue() {
        if (this.processing) return;
        this.processing = true;

        try {
            this.pruneWindow();

            // Drop expired requests if they waited too long
            if (this.maxQueueWaitMs !== undefined) {
                const now = Date.now();
                const stillQueued: typeof this.queue = [];
                for (const item of this.queue) {
                    if (now - item.enqueuedAt > this.maxQueueWaitMs) {
                        this.droppedExpired++;
                        logger.log(
                            `${this.name} RateLimiter: request expired after ${this.maxQueueWaitMs}ms`,
                        );
                        item.reject(
                            new Error(
                                `${this.name} RateLimiter: request expired after ${this.maxQueueWaitMs}ms in queue`,
                            ),
                        );
                    } else {
                        stillQueued.push(item);
                    }
                }
                this.queue = stillQueued;
            }

            if (this.queue.length === 0) {
                this.clearScheduledIfIdle();

                if (this.activeCalls === 0) {
                    logger.log(`${this.name} RateLimiter: queue fully drained`);
                }
                return;
            }

            // Start as many as capacity allows
            while (this.queue.length > 0 && this.hasCapacity()) {
                const { wrapped } = this.queue.shift()!;
                this.startCall(wrapped);
            }

            // If still queued, ensure scheduler runs
            if (this.queue.length > 0 && !this.hasCapacity()) {
                this.ensureScheduled();
            } else if (this.queue.length === 0) {
                this.clearScheduledIfIdle();

                if (this.activeCalls === 0) {
                    logger.log(`${this.name} RateLimiter: queue fully drained`);
                }
            }
        } finally {
            this.processing = false;
        }
    }

    /** Schedule next wake-up for when capacity may free up */
    private ensureScheduled() {
        if (this.nextTick) return;

        this.pruneWindow();
        if (this.queue.length === 0) return;

        if (this.callTimes.length >= this.maxCalls) {
            const oldest = this.callTimes[0];
            const delay = Math.max(0, oldest + this.intervalMs - Date.now());
            this.nextTick = setTimeout(() => {
                this.nextTick = null;
                this.processQueue();
            }, delay);
        } else if (this.maxConcurrent !== undefined && this.activeCalls >= this.maxConcurrent) {
            this.nextTick = setTimeout(() => {
                this.nextTick = null;
                this.processQueue();
            }, 0);
        } else {
            this.nextTick = setTimeout(() => {
                this.nextTick = null;
                this.processQueue();
            }, 0);
        }
    }

    /** Cancel scheduled wake-ups if idle */
    private clearScheduledIfIdle() {
        if (this.queue.length === 0 && this.activeCalls === 0 && this.nextTick) {
            clearTimeout(this.nextTick);
            this.nextTick = null;
        }
    }

    /** Return current limiter statistics */
    getStats(): RateLimiterStats {
        this.pruneWindow();
        return {
            queueLength: this.queue.length,
            activeCalls: this.activeCalls,
            callsInWindow: this.callTimes.length,
            maxCalls: this.maxCalls,
            intervalMs: this.intervalMs,
            maxConcurrent: this.maxConcurrent,
            totalProcessed: this.totalProcessed,
            totalErrors: this.totalErrors,
            droppedExpired: this.droppedExpired,
            droppedOverflow: this.droppedOverflow,
            droppedCleared: this.droppedCleared,
        };
    }

    /** Reset all counters */
    resetStats() {
        this.totalProcessed = 0;
        this.totalErrors = 0;
        this.droppedExpired = 0;
        this.droppedOverflow = 0;
        this.droppedCleared = 0;
    }

    /** Drop all queued (not yet started) calls */
    clearQueue() {
        const dropped = this.queue.length;
        this.queue.forEach(item =>
            item.reject(new Error(`${this.name} RateLimiter: queue cleared`)),
        );
        this.queue = [];
        this.droppedCleared += dropped;

        logger.log(
            `${this.name} RateLimiter: queue cleared, ${dropped} requests dropped (totalCleared=${this.droppedCleared})`,
        );

        this.clearScheduledIfIdle();
    }

    /** Current queue depth */
    getQueueLength(): number {
        return this.queue.length;
    }

    /** Whether any calls are currently in-flight */
    isCurrentlyProcessing(): boolean {
        return this.activeCalls > 0;
    }
}

/** Factory for creating new RateLimiter instances */
export function createRateLimiter(name: string, options: RateLimiterOptions): RateLimiter {
    return new RateLimiter(name, options);
}

/**
 * Predefined limiters for common use cases.
 *
 * - `tokenBalance`: modest QPS and concurrency to avoid RPC bans.
 * - `resizeImage`: higher concurrency, but still limited to avoid CPU/disk spikes.
 */
export const RateLimiters = {
    tokenBalance: createRateLimiter('TokenBalance', {
        maxCalls: 10, // max 10 calls per second
        intervalMs: 1000, // sliding window: 1s
        maxConcurrent: 7, // no more than 7 in-flight calls at once
        maxQueueLength: 100, // reject new calls if >100 queued
        maxQueueWaitMs: 15000, // drop requests that wait >15s
        queueWarningThreshold: 50, // warn when queue length > 50
    }),

    // Free data-provider APIs (see src/lib/dataproviders)
    etherscan: createRateLimiter('Etherscan', {
        maxCalls: 4, // free tier allows 5 rps; stay under
        intervalMs: 1000,
        maxConcurrent: 2,
        maxQueueLength: 60,
        maxQueueWaitMs: 20000,
        queueWarningThreshold: 30,
    }),
    blockscout: createRateLimiter('Blockscout', {
        maxCalls: 8,
        intervalMs: 1000,
        maxConcurrent: 4,
        maxQueueLength: 100,
        maxQueueWaitMs: 20000,
        queueWarningThreshold: 50,
    }),
    blockvision: createRateLimiter('BlockVision', {
        maxCalls: 2, // free tier ~2 QPS
        intervalMs: 1000,
        maxConcurrent: 2,
        maxQueueLength: 60,
        maxQueueWaitMs: 20000,
        queueWarningThreshold: 30,
    }),
    coingecko: createRateLimiter('CoinGecko', {
        maxCalls: 5, // ~30/min free tier; keep a wide margin per-second
        intervalMs: 10000,
        maxConcurrent: 2,
        maxQueueLength: 60,
        maxQueueWaitMs: 30000,
        queueWarningThreshold: 30,
    }),
    defillama: createRateLimiter('DefiLlama', {
        maxCalls: 5,
        intervalMs: 1000,
        maxConcurrent: 3,
        maxQueueLength: 100,
        maxQueueWaitMs: 20000,
        queueWarningThreshold: 50,
    }),
};
