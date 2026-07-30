import {
    getWaitTime,
    getUserUnlockRequests,
    UserUnlockRequest,
} from '../../../src/lib/liquid-staking/KintsuUtils';
import { retryFunc } from '../../../src/lib/WalletUtils';

jest.mock('../../../src/lib/WalletUtils', () => ({
    retryFunc: jest.fn(async (fn: Function) => fn()),
}));

const mockContractCtor = jest.fn();

jest.mock('ethers', () => ({
    Contract: function (...args: any[]) {
        return mockContractCtor(...args);
    },
    JsonRpcProvider: jest.fn(),
}));

beforeEach(() => {
    jest.clearAllMocks();
    (retryFunc as jest.Mock).mockImplementation(async (fn: Function) => fn());
});

/**
 * Create a fake Contract whose getFunction returns a configured mock for each method.
 */
function makeContract(functions: Record<string, jest.Mock | undefined> = {}) {
    return {
        getFunction: jest.fn((name: string) => functions[name] ?? jest.fn()),
    } as any;
}

/**
 * Configure what `new Contract(...)` returns inside `getEpoch`.
 */
function setEpochContract(returnValue: any) {
    mockContractCtor.mockImplementationOnce(() => ({
        getFunction: jest.fn(() => jest.fn().mockResolvedValue(returnValue)),
    }));
}

describe('KintsuUtils.getWaitTime', () => {
    it('returns a positive integer number of seconds', () => {
        const wait = getWaitTime();
        expect(typeof wait).toBe('number');
        expect(wait).toBeGreaterThan(0);
        expect(Number.isInteger(wait)).toBe(true);
    });

    it('returns (UNBONDING + WITHDRAW) * EPOCH_DURATION_MS / 1000', () => {
        // EPOCH_DURATION_MS = 50_000 * 500; both UNBONDING and WITHDRAW are 1 epoch.
        const expected = Math.floor((50_000 * 500 * 2) / 1000);
        expect(getWaitTime()).toBe(expected);
    });
});

describe('KintsuUtils.getUserUnlockRequests — error paths', () => {
    it('returns [] when unlockRequests are missing', async () => {
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(5),
            getAllUserUnlockRequests: jest.fn().mockResolvedValue(undefined),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toEqual([]);
    });

    it('returns [] when epoch fetch fails', async () => {
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(5),
            getAllUserUnlockRequests: jest.fn().mockResolvedValue([]),
        });
        mockContractCtor.mockImplementationOnce(() => ({
            getFunction: jest.fn(() => jest.fn().mockRejectedValue(new Error('epoch err'))),
        }));
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toEqual([]);
    });

    it('falls back to currentBatchId=0 when "Cannot decode zero data" thrown', async () => {
        const contract = makeContract({
            currentBatchId: jest.fn().mockRejectedValue(new Error('Cannot decode zero data')),
            getAllUserUnlockRequests: jest.fn().mockResolvedValue([]),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(Array.isArray(result)).toBe(true);
    });

    it('falls back to currentBatchId=0 when other batchId error thrown', async () => {
        const contract = makeContract({
            currentBatchId: jest.fn().mockRejectedValue(new Error('other error')),
            getAllUserUnlockRequests: jest.fn().mockResolvedValue([]),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(Array.isArray(result)).toBe(true);
    });

    it('returns [] when fetchUserUnlockRequests throws', async () => {
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(5),
            getAllUserUnlockRequests: jest.fn().mockRejectedValue(new Error('boom')),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toEqual([]);
    });
});

describe('KintsuUtils.getUserUnlockRequests — array-indexed responses', () => {
    it('accepts array-indexed entries from getAllUserUnlockRequests', async () => {
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(2),
            // Array-indexed item: [shares, spotValue, batchId, exitFeeInBips]
            getAllUserUnlockRequests: jest.fn().mockResolvedValue([[100n, 100n, 5n, 0n]]),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        // batchId 5 >= currentBatchId 2 → unsubmitted → pending entry.
        expect(result).toHaveLength(1);
        expect(result[0].is_claimable).toBe(false);
        expect(result[0].cancellable).toBe(true);
    });
});

describe('KintsuUtils.getUserUnlockRequests — request classification', () => {
    function buildContract(
        opts: {
            currentBatchId: number;
            unlockRequests: UserUnlockRequest[];
            batchSubmissions?: Record<string, { submissionEpoch: number; activationEpoch: number }>;
        },
    ) {
        const batchSubmissionsByBatchId = opts.batchSubmissions ?? {};
        return makeContract({
            currentBatchId: jest.fn().mockResolvedValue(opts.currentBatchId),
            getAllUserUnlockRequests: jest.fn().mockResolvedValue(opts.unlockRequests),
            batchSubmissions: jest.fn(async (batchId: bigint) => {
                const v = batchSubmissionsByBatchId[batchId.toString()];
                if (v) return [v.submissionEpoch, v.activationEpoch];
                return [0n, 0n];
            }),
        });
    }

    it('produces pending requests for unsubmitted unlock requests', async () => {
        const contract = buildContract({
            currentBatchId: 2,
            unlockRequests: [
                { shares: 100n, spotValue: 100n, batchId: 5n, exitFeeInBips: 0n },
            ],
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toHaveLength(1);
        expect(result[0].is_claimable).toBe(false);
        expect(result[0].cancellable).toBe(true);
    });

    it('produces claimable requests when redeemableEpoch <= currentEpoch', async () => {
        const contract = buildContract({
            currentBatchId: 10,
            unlockRequests: [
                { shares: 200n, spotValue: 200n, batchId: 5n, exitFeeInBips: 0n },
            ],
            batchSubmissions: {
                '5': { submissionEpoch: 5, activationEpoch: 6 }, // redeemable at epoch 7
            },
        });
        setEpochContract([10n, false]); // currentEpoch=10, >= 7 → claimable
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toHaveLength(1);
        expect(result[0].is_claimable).toBe(true);
        expect(result[0].cancellable).toBe(false);
    });

    it('produces pending (non-cancellable) when submitted but not yet redeemable', async () => {
        const contract = buildContract({
            currentBatchId: 10,
            unlockRequests: [
                { shares: 200n, spotValue: 200n, batchId: 5n, exitFeeInBips: 0n },
            ],
            batchSubmissions: {
                '5': { submissionEpoch: 5, activationEpoch: 20 },
            },
        });
        setEpochContract([10n, false]); // currentEpoch=10, redeemable at 21
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toHaveLength(1);
        expect(result[0].is_claimable).toBe(false);
        // Submitted batch is not the current batch (5 != 10), so cancellable=false.
        expect(result[0].cancellable).toBe(false);
        expect(result[0].requested_at).toBeDefined();
    });

    it('marks submitted-but-pending requests as cancellable when batchId == currentBatchId', async () => {
        const contract = buildContract({
            currentBatchId: 5,
            // batchId < currentBatchId is the submitted branch; force batchId == currentBatchId
            // via two separate requests so the function visits both branches.
            unlockRequests: [
                // submitted branch: batchId < currentBatchId
                { shares: 50n, spotValue: 50n, batchId: 4n, exitFeeInBips: 0n },
                // unsubmitted branch: batchId >= currentBatchId
                { shares: 60n, spotValue: 60n, batchId: 5n, exitFeeInBips: 0n },
            ],
            batchSubmissions: {
                '4': { submissionEpoch: 1, activationEpoch: 50 }, // redeemable at 51 — not yet
            },
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        // Two requests: one submitted-pending, one unsubmitted.
        expect(result).toHaveLength(2);
        expect(result.every(r => !r.is_claimable)).toBe(true);
    });

    it('sorts claimable requests before pending ones', async () => {
        const contract = buildContract({
            currentBatchId: 10,
            unlockRequests: [
                // submitted, not yet claimable
                { shares: 100n, spotValue: 100n, batchId: 4n, exitFeeInBips: 0n },
                // submitted, claimable
                { shares: 200n, spotValue: 200n, batchId: 5n, exitFeeInBips: 0n },
            ],
            batchSubmissions: {
                '4': { submissionEpoch: 1, activationEpoch: 100 },
                '5': { submissionEpoch: 5, activationEpoch: 6 },
            },
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result[0].is_claimable).toBe(true);
        expect(result[1].is_claimable).toBe(false);
    });

    it('handles batchSubmissions failures by treating epochs as zero', async () => {
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(10),
            getAllUserUnlockRequests: jest
                .fn()
                .mockResolvedValue([
                    { shares: 100n, spotValue: 100n, batchId: 4n, exitFeeInBips: 0n },
                ]),
            // batchSubmissions throws every time → treated as { 0, 0 }.
            batchSubmissions: jest.fn().mockRejectedValue(new Error('batch err')),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toHaveLength(1);
        // activationEpoch=0 → redeemableEpoch=1; currentEpoch=10 ≥ 1 → claimable.
        expect(result[0].is_claimable).toBe(true);
    });

    it('returns 0 when batchSubmissions returns falsy output (covers the "if (output)" false branch)', async () => {
        // batchSubmissions returns null → falls through to the default {0,0} return path.
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(10),
            getAllUserUnlockRequests: jest
                .fn()
                .mockResolvedValue([
                    { shares: 100n, spotValue: 100n, batchId: 4n, exitFeeInBips: 0n },
                ]),
            batchSubmissions: jest.fn().mockResolvedValue(null),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toHaveLength(1);
        // activationEpoch=0 → claimable since currentEpoch=10 ≥ 1.
        expect(result[0].is_claimable).toBe(true);
    });

    it('reads named submission/activation properties when array-indexed values are zero', async () => {
        // output[0] and output[1] are both 0 → `Number(0 || output.submissionEpoch || 0)`
        // resolves to the named property. Covers the alternative branch of the `||` chain at
        // lines 146-147.
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(10),
            getAllUserUnlockRequests: jest
                .fn()
                .mockResolvedValue([
                    { shares: 100n, spotValue: 100n, batchId: 4n, exitFeeInBips: 0n },
                ]),
            // Object with zero array slots but populated named fields.
            batchSubmissions: jest
                .fn()
                .mockResolvedValue(
                    Object.assign([0, 0], { submissionEpoch: 5, activationEpoch: 100 }),
                ),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toHaveLength(1);
        // activationEpoch=100 → redeemableEpoch=101; currentEpoch=10 → still pending.
        expect(result[0].is_claimable).toBe(false);
    });

    it('returns the input list unchanged when sort sees two requests with the same is_claimable value', async () => {
        // Two pending (both is_claimable=false) → covers the aNum===bNum branch of the sort.
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(2),
            getAllUserUnlockRequests: jest.fn().mockResolvedValue([
                { shares: 100n, spotValue: 100n, batchId: 5n, exitFeeInBips: 0n },
                { shares: 50n, spotValue: 50n, batchId: 6n, exitFeeInBips: 0n },
            ]),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        // Both unsubmitted → both pending.
        expect(result.every(r => !r.is_claimable)).toBe(true);
        expect(result).toHaveLength(2);
    });

    it('sorts two claimable requests next to each other (covers aNum===bNum=1 branch)', async () => {
        const contract = makeContract({
            currentBatchId: jest.fn().mockResolvedValue(10),
            getAllUserUnlockRequests: jest.fn().mockResolvedValue([
                { shares: 100n, spotValue: 100n, batchId: 4n, exitFeeInBips: 0n },
                { shares: 200n, spotValue: 200n, batchId: 5n, exitFeeInBips: 0n },
            ]),
            // Both batches submitted → both should be claimable.
            batchSubmissions: jest.fn().mockResolvedValue([5n, 6n]),
        });
        setEpochContract([10n, false]);
        const result = await getUserUnlockRequests(contract, '0xa', {} as any);
        expect(result).toHaveLength(2);
        expect(result.every(r => r.is_claimable)).toBe(true);
    });
});
