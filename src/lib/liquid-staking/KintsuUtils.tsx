import { Contract, JsonRpcProvider } from 'ethers';
import { retryFunc } from '../WalletUtils';
import { LiquidStakingRequest } from './Types';

export type UserUnlockRequest = {
    shares: bigint;
    spotValue: bigint;
    batchId: bigint;
    exitFeeInBips?: bigint;
};

export type BatchSubmission = {
    submissionEpoch: number;
    activationEpoch: number;
};

const EPOCH_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000001000';
const EPOCH_ABI = [
    {
        inputs: [],
        name: 'getEpoch',
        outputs: [
            {
                internalType: 'uint64',
                name: '',
                type: 'uint64',
            },
            {
                internalType: 'bool',
                name: '',
                type: 'bool',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

const EPOCH_DURATION_MS = 50_000 * 500; // Block time (500ms) * blocks per epoch (50,000)
const WITHDRAW_DELAY_EPOCHS = 1;
const UNBONDING_ACTIVATION_EPOCHS = 1;

/**
 * Get the wait time (in seconds) for a new unlock request.
 * This calculates the total time from when a request is made until it becomes claimable,
 * assuming the batch is submitted immediately.
 *
 * Wait time = UNBONDING_ACTIVATION_EPOCHS + WITHDRAW_DELAY_EPOCHS epochs
 *
 * @returns Wait time in seconds
 */
export const getWaitTime = (): number => {
    const activationPeriodMs = UNBONDING_ACTIVATION_EPOCHS * EPOCH_DURATION_MS;
    const stakingWithdrawPeriodMs = WITHDRAW_DELAY_EPOCHS * EPOCH_DURATION_MS;
    const totalWaitTimeMs = activationPeriodMs + stakingWithdrawPeriodMs;

    // Convert milliseconds to seconds
    return Math.floor(totalWaitTimeMs / 1000);
};

export const getUserUnlockRequests = async (
    contract: Contract,
    walletAddress: string,
    provider: JsonRpcProvider,
) => {
    const [unlockRequests, epochData, currentBatchId] = await Promise.all([
        fetchUserUnlockRequests(contract, walletAddress),
        getEpoch(provider),
        getCurrentBatchId(contract),
    ]);

    if (!unlockRequests || !epochData || currentBatchId === undefined) return [];

    const requests = await parseUnlockRequests(contract, unlockRequests, epochData, currentBatchId);

    return requests.sort((a, b) => {
        const aNum = a.is_claimable ? 1 : 0;
        const bNum = b.is_claimable ? 1 : 0;

        return aNum === bNum ? 0 : aNum < bNum ? 1 : -1;
    });
};

const getCurrentBatchId = async (contract: Contract): Promise<number | undefined> => {
    try {
        const output = await retryFunc(
            async () => {
                const func = contract.getFunction('currentBatchId');
                return await func();
            },
            { delay: 1000, count: 3 },
        );

        return Number(output);
    } catch (error: any) {
        if (error.message?.includes('Cannot decode zero data')) {
            return 0;
        } else {
            console.error('Error fetching current batch ID:', error);
            return 0;
        }
    }
};

const fetchUserUnlockRequests = async (
    contract: Contract,
    walletAddress: string,
): Promise<UserUnlockRequest[] | undefined> => {
    try {
        const output = await retryFunc(
            async () => {
                const func = contract.getFunction('getAllUserUnlockRequests');
                return await func(walletAddress);
            },
            { delay: 1000, count: 3 },
        );

        if (output) {
            return output.map((item: any) => ({
                shares: item.shares || item[0],
                spotValue: item.spotValue || item[1],
                batchId: item.batchId || item[2],
                exitFeeInBips: item.exitFeeInBips || item[3],
            }));
        }
    } catch (e) {
        console.error('Error fetching user unlock requests:', e);
    }
};

const fetchBatchSubmissions = async (
    contract: Contract,
    batchId: number,
): Promise<BatchSubmission> => {
    try {
        const output = await retryFunc(
            async () => {
                const func = contract.getFunction('batchSubmissions');
                return await func(BigInt(batchId));
            },
            { delay: 1000, count: 3 },
        );

        if (output) {
            return {
                submissionEpoch: Number(output[0] || output.submissionEpoch || 0),
                activationEpoch: Number(output[1] || output.activationEpoch || 0),
            };
        }
    } catch (e) {
        console.error(`Error fetching batch submission for batchId ${batchId}:`, e);
    }

    return {
        submissionEpoch: 0,
        activationEpoch: 0,
    };
};

const getEpoch = async (
    provider: JsonRpcProvider,
): Promise<{ currentEpoch: bigint; in_epoch_delay_period: boolean } | undefined> => {
    try {
        const epochContract = new Contract(EPOCH_PRECOMPILE_ADDRESS, EPOCH_ABI, provider);
        const output = await retryFunc(
            async () => {
                const func = epochContract.getFunction('getEpoch');
                return await func();
            },
            { delay: 1000, count: 3 },
        );

        return {
            currentEpoch: output[0],
            in_epoch_delay_period: output[1],
        };
    } catch (e) {
        console.error('Error fetching epoch:', e);
    }
};

const parseUnlockRequests = async (
    contract: Contract,
    unlockRequests: UserUnlockRequest[],
    epochData: { currentEpoch: bigint; in_epoch_delay_period: boolean },
    currentBatchId: number,
): Promise<LiquidStakingRequest[]> => {
    if (!unlockRequests) return [];

    const { currentEpoch } = epochData;
    const nowMs = Date.now();
    const activationPeriodMs = UNBONDING_ACTIVATION_EPOCHS * EPOCH_DURATION_MS;
    const stakingWithdrawPeriodMs = WITHDRAW_DELAY_EPOCHS * EPOCH_DURATION_MS;

    const claimableReqs: LiquidStakingRequest[] = [];
    const pendingReqs: LiquidStakingRequest[] = [];

    // These requests are NOT claimable - their associated batch has NOT been submitted
    // We calculate a claimableTime assuming the batch is submitted now
    // For new requests, wait time = activationPeriodMs + stakingWithdrawPeriodMs
    const unsubmittedReqs = unlockRequests.filter(
        req => Number.parseInt(req.batchId.toString()) >= currentBatchId,
    );

    unsubmittedReqs.forEach((req, idx) => {
        const originalIndex = unlockRequests.indexOf(req);
        // For unsubmitted requests (current batch), requested_at should be now
        // since they were just requested in the current batch
        pendingReqs.push({
            id: originalIndex.toString(),
            shares: req.shares.toString(),
            is_claimable: false,
            claimed: false,
            cancellable: true,
            requested_at: Math.floor(nowMs / 1000).toString(),
        });
    });

    // These requests might be claimable - their associated batch has been submitted
    const submittedReqs = unlockRequests.filter(
        req => Number.parseInt(req.batchId.toString()) < currentBatchId,
    );

    const uniqueBatchIds = [
        ...new Set(submittedReqs.map(req => Number.parseInt(req.batchId.toString()))),
    ];

    const uniqueBatchSubmissions = await Promise.all(
        uniqueBatchIds.map(async batchId => fetchBatchSubmissions(contract, batchId)),
    );

    submittedReqs.forEach(request => {
        const originalIndex = unlockRequests.indexOf(request);
        const batchIdIndex = uniqueBatchIds.indexOf(Number.parseInt(request.batchId.toString()));
        const batchSubmission = uniqueBatchSubmissions[batchIdIndex];
        const redeemableEpoch = batchSubmission.activationEpoch + WITHDRAW_DELAY_EPOCHS;

        if (Number(currentEpoch.toString()) >= redeemableEpoch) {
            claimableReqs.push({
                id: originalIndex.toString(),
                shares: request.shares.toString(),
                is_claimable: true,
                claimed: false,
                cancellable: false,
            });
        } else {
            const remainingEpochs = redeemableEpoch - Number(currentEpoch.toString());
            const cancellable = currentBatchId === Number.parseInt(request.batchId.toString());
            const claimableTime = nowMs + remainingEpochs * EPOCH_DURATION_MS;

            pendingReqs.push({
                id: originalIndex.toString(),
                shares: request.shares.toString(),
                is_claimable: false,
                claimed: false,
                cancellable,
                requested_at: Math.floor(
                    (claimableTime - activationPeriodMs - stakingWithdrawPeriodMs) / 1000,
                ).toString(),
            });
        }
    });

    return [...claimableReqs, ...pendingReqs];
};
