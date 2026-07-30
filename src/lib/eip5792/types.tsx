export const EIP5792_METHODS = {
    WALLET_GET_CAPABILITIES: 'wallet_getCapabilities',
    WALLET_SEND_CALLS: 'wallet_sendCalls',
    WALLET_GET_CALLS_STATUS: 'wallet_getCallsStatus',
    WALLET_SHOW_CALLS_STATUS: 'wallet_showCallsStatus',
} as const;

export const EIP5792_APPROVAL_TYPES = {
    SEND_CALLS: 'wallet_sendCalls',
    SHOW_CALLS_STATUS: 'wallet_showCallsStatus',
} as const;

export const EIP5792_ERROR_CODES = {
    INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
    UNAUTHORIZED: { code: 4100, message: 'Unauthorized' },
    USER_REJECTED: { code: 4001, message: 'User Rejected Request' },
    UNSUPPORTED_CHAIN: { code: 5710, message: 'Unsupported chain id' },
    UNKNOWN_BUNDLE_ID: { code: 5730, message: 'Unknown bundle id' },
} as const;

export type SendCallsCall = {
    to?: `0x${string}`;
    data?: `0x${string}`;
    value?: `0x${string}`;
    gas?: `0x${string}`;
    capabilities?: Record<string, unknown>;
};

export type SendCallsParams = {
    version: string;
    id?: string;
    from?: `0x${string}`;
    chainId: `0x${string}` | number;
    atomicRequired: boolean;
    calls: SendCallsCall[];
    capabilities?: Record<string, unknown>;
};

export enum CallBatchStatusCode {
    Pending = 100,
    Confirmed = 200,
    OffchainFailure = 400,
    Reverted = 500,
    PartialRevert = 600,
}

export type CallBatchStatus = {
    version: string;
    chainId: string;
    id: string;
    status: CallBatchStatusCode;
    atomic: boolean;
    receipts?: Array<{
        logs: Array<{ address: string; data: string; topics: string[] }>;
        status: string;
        blockHash: string;
        blockNumber: string;
        gasUsed: string;
        transactionHash: string;
    }>;
};

export type WalletSendCallsApprovalValue = {
    gasInfo?: {
        gasPrice?: bigint;
        maxFeePerGas?: bigint;
        maxPriorityFeePerGas?: bigint;
        baseFee?: bigint;
        priorityFee?: bigint;
    };
    gasLimit?: number;
};
