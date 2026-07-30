import { getaPrioriClaimRequests } from '../../api';
import { LiquidStakingData, LiquidStakingRequest } from './Types';
import aPrioriABI from './abi/aPriori-abi.json';

const aPriori: LiquidStakingData = {
    contractAddress: '0xb2f82D0f38dc453D596Ad40A37799446Cc89274A',
    abi: aPrioriABI,
    fetchExchangeRateMethod: 'convertToShares',
    fetchUnstakeExchangeRateMethod: 'convertToAssets',
    stakeMethod: 'deposit',
    getStakeArgs: (amount, walletAddress) => {
        return [amount, walletAddress];
    },
    requestUnstakeMethod: 'requestRedeem',
    getRequestUnstakeArgs: (amount, walletAddress) => {
        return [amount, walletAddress, walletAddress];
    },
    unstakeMethod: 'redeem',
    getUnstakeArgs: (walletAddress, requestIDs) => {
        return [requestIDs, walletAddress];
    },
    waitTimeMethod: 'withdrawalWaitTime',
    getClaimRequests: async (walletAddress: string) => {
        const result = await getaPrioriClaimRequests(walletAddress);
        return result.data as LiquidStakingRequest[];
    },
    unlockRequired: true,
    claimRequestsFetchType: 'api',
    hasWaitTime: true,
};

export default aPriori;
