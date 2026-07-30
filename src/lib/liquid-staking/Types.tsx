import { Contract, InterfaceAbi, JsonRpcProvider } from 'ethers';

export type LiquidStakingData = {
    contractAddress: string;
    abi: InterfaceAbi;
    fetchExchangeRateMethod: string;
    fetchUnstakeExchangeRateMethod: string;
    stakeMethod: string;
    getStakeArgs: (amount: bigint, walletAddress: string) => any[];
    requestUnstakeMethod?: string;
    getRequestUnstakeArgs?: (amount: bigint, walletAddress: string) => any[];
    unstakeMethod: string;
    getUnstakeArgs: (
        walletAddress: string,
        requestIDs?: number[] | string,
        amount?: bigint,
    ) => any[];
    cancelUnstakeRequestMethod?: string;
    waitTimeMethod?: string;
    getWaitTime?: () => number;
    hasWaitTime: boolean;
    getClaimRequests?: (
        walletAddress: string,
        contract?: Contract,
        provider?: JsonRpcProvider,
    ) => Promise<LiquidStakingRequest[]>;
    unlockRequired: boolean;
    claimRequestsFetchType?: 'api' | 'contract';
};

export type LiquidStakingRequest = {
    shares: string;
    claimed: boolean;
    id: string;
    is_claimable: boolean;
    cancellable?: boolean;
    requested_at?: string;
};

export type MergedLiquidStakingRequest = LiquidStakingRequest & {
    count?: number;
    requestIds?: number[];
    totalShares?: number;
};
