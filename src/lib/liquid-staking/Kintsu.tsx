import { getUserUnlockRequests, getWaitTime } from './KintsuUtils';
import { LiquidStakingData } from './Types';
import KintsuABI from './abi/Kintsu-abi-v2.json';

const Kintsu: LiquidStakingData = {
    contractAddress: '0xA3227C5969757783154C60bF0bC1944180ed81B9',
    abi: KintsuABI,
    fetchExchangeRateMethod: 'convertToShares',
    fetchUnstakeExchangeRateMethod: 'convertToAssets',
    stakeMethod: 'deposit',
    getStakeArgs: (amount, walletAddress) => {
        return [0n, walletAddress];
    },
    requestUnstakeMethod: 'requestUnlock',
    getRequestUnstakeArgs: amount => {
        return [amount, 0n];
    },
    unstakeMethod: 'redeem',
    getUnstakeArgs: (walletAddress, requestIDs) => {
        return [requestIDs, walletAddress];
    },
    cancelUnstakeRequestMethod: 'cancelUnlockRequest',
    getWaitTime: getWaitTime,
    getClaimRequests: async (walletAddress, contract, provider) => {
        return await getUserUnlockRequests(contract!, walletAddress, provider!);
    },
    unlockRequired: true,
    claimRequestsFetchType: 'contract',
    hasWaitTime: true,
};

export default Kintsu;
