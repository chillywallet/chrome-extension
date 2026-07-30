import FastLaneABI from './abi/FastLane-abi.json';
import { LiquidStakingData } from './Types';

const FastLane: LiquidStakingData = {
    contractAddress: '0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c',
    abi: FastLaneABI,
    fetchExchangeRateMethod: 'convertToShares',
    fetchUnstakeExchangeRateMethod: 'convertToAssets',
    stakeMethod: 'deposit',
    getStakeArgs: (amount, walletAddress) => {
        return [amount, walletAddress];
    },
    unstakeMethod: 'redeem',
    getUnstakeArgs: (walletAddress, requestIDs, shares) => {
        return [shares, walletAddress, walletAddress];
    },
    unlockRequired: false,
    hasWaitTime: false,
};

export default FastLane;
