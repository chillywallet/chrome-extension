import aPriori from '../../../src/lib/liquid-staking/aPriori';
import { getaPrioriClaimRequests } from '../../../src/api';

jest.mock('../../../src/api', () => ({
    getaPrioriClaimRequests: jest.fn(async () => ({ data: [{ id: 1, status: 'pending' }] })),
}));

jest.mock('../../../src/lib/liquid-staking/abi/aPriori-abi.json', () => [], { virtual: true });

describe('aPriori liquid-staking data', () => {
    it('exposes expected contract metadata', () => {
        expect(aPriori.contractAddress).toMatch(/^0x/);
        expect(aPriori.fetchExchangeRateMethod).toBe('convertToShares');
        expect(aPriori.fetchUnstakeExchangeRateMethod).toBe('convertToAssets');
        expect(aPriori.stakeMethod).toBe('deposit');
        expect(aPriori.requestUnstakeMethod).toBe('requestRedeem');
        expect(aPriori.unstakeMethod).toBe('redeem');
        expect(aPriori.waitTimeMethod).toBe('withdrawalWaitTime');
        expect(aPriori.unlockRequired).toBe(true);
        expect(aPriori.hasWaitTime).toBe(true);
        expect(aPriori.claimRequestsFetchType).toBe('api');
    });

    it('getStakeArgs returns [amount, wallet]', () => {
        expect(aPriori.getStakeArgs!('1000' as any, '0xa')).toEqual(['1000', '0xa']);
    });

    it('getRequestUnstakeArgs returns [amount, wallet, wallet]', () => {
        expect(aPriori.getRequestUnstakeArgs!('500' as any, '0xa')).toEqual(['500', '0xa', '0xa']);
    });

    it('getUnstakeArgs returns [requestIDs, wallet]', () => {
        expect(aPriori.getUnstakeArgs!('0xa', ['r1', 'r2'])).toEqual([['r1', 'r2'], '0xa']);
    });

    it('getClaimRequests delegates to api.getaPrioriClaimRequests', async () => {
        (getaPrioriClaimRequests as jest.Mock).mockResolvedValueOnce({
            data: [{ id: 1, status: 'pending' }],
        });
        const result = await aPriori.getClaimRequests!('0xa');
        expect(getaPrioriClaimRequests).toHaveBeenCalledWith('0xa');
        expect(result).toEqual([{ id: 1, status: 'pending' }]);
    });
});
