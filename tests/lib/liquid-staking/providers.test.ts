import aPriori from '../../../src/lib/liquid-staking/aPriori';
import FastLane from '../../../src/lib/liquid-staking/FastLane';
import Kintsu from '../../../src/lib/liquid-staking/Kintsu';
import { LiquidStakingProviders } from '../../../src/lib/liquid-staking';
import { getWaitTime } from '../../../src/lib/liquid-staking/KintsuUtils';
import { EarnType } from '../../../src/shared/types/Earn';

jest.mock('../../../src/api', () => ({
    getaPrioriClaimRequests: jest.fn(),
}));

const mockGetUserUnlockRequests = jest.fn();
jest.mock('../../../src/lib/liquid-staking/KintsuUtils', () => {
    const actual = jest.requireActual('../../../src/lib/liquid-staking/KintsuUtils');
    return {
        ...actual,
        getUserUnlockRequests: (...args: unknown[]) => mockGetUserUnlockRequests(...args),
    };
});

describe('liquid staking provider configs', () => {
    it('aPriori exposes expected interface', () => {
        expect(aPriori.contractAddress).toMatch(/^0x/);
        expect(aPriori.stakeMethod).toBe('deposit');
        expect(aPriori.unlockRequired).toBe(true);
        expect(aPriori.hasWaitTime).toBe(true);
        // stake args echo amount + address
        expect(aPriori.getStakeArgs(BigInt(1), '0xabc')).toEqual([BigInt(1), '0xabc']);
        // request unstake args echo amount + receiver + owner
        expect(aPriori.getRequestUnstakeArgs!(BigInt(2), '0xabc')).toEqual([
            BigInt(2),
            '0xabc',
            '0xabc',
        ]);
        // unstake args
        expect(aPriori.getUnstakeArgs('0xabc', [1, 2, 3])).toEqual([[1, 2, 3], '0xabc']);
    });

    it('FastLane exposes expected interface', () => {
        expect(FastLane.contractAddress).toMatch(/^0x/);
        expect(FastLane.unlockRequired).toBe(false);
        expect(FastLane.hasWaitTime).toBe(false);
        expect(FastLane.getStakeArgs(BigInt(1), '0xabc')).toEqual([BigInt(1), '0xabc']);
        expect(FastLane.getUnstakeArgs('0xabc', undefined, BigInt(5))).toEqual([
            BigInt(5),
            '0xabc',
            '0xabc',
        ]);
    });

    it('Kintsu exposes expected interface', () => {
        expect(Kintsu.contractAddress).toMatch(/^0x/);
        expect(Kintsu.unlockRequired).toBe(true);
        expect(Kintsu.hasWaitTime).toBe(true);
        expect(Kintsu.getStakeArgs(BigInt(1), '0xabc')).toEqual([BigInt(0), '0xabc']);
        expect(Kintsu.getRequestUnstakeArgs!(BigInt(2), '0xabc')).toEqual([
            BigInt(2),
            BigInt(0),
        ]);
        expect(Kintsu.getUnstakeArgs('0xabc', [1, 2])).toEqual([[1, 2], '0xabc']);
    });

    it('Kintsu.getClaimRequests delegates to getUserUnlockRequests', async () => {
        mockGetUserUnlockRequests.mockResolvedValueOnce([
            { id: '0', shares: '1', is_claimable: true, claimed: false, cancellable: false },
        ]);
        const contract = { name: 'contract' } as any;
        const provider = { name: 'provider' } as any;
        const result = await Kintsu.getClaimRequests!('0xabc', contract, provider);
        expect(mockGetUserUnlockRequests).toHaveBeenCalledWith(contract, '0xabc', provider);
        expect(result).toHaveLength(1);
    });

    it('Kintsu.getWaitTime returns a positive integer', () => {
        const wait = Kintsu.getWaitTime!();
        expect(typeof wait).toBe('number');
        expect(wait).toBeGreaterThan(0);
    });
});

describe('LiquidStakingProviders map', () => {
    it('exposes a config for each supported provider', () => {
        expect(LiquidStakingProviders[EarnType.aPriori]).toBeDefined();
        expect(LiquidStakingProviders[EarnType.FastLane]).toBeDefined();
    });

    it('returns undefined for yield-only earn types', () => {
        expect(LiquidStakingProviders[EarnType.AgoraYield]).toBeUndefined();
        expect(LiquidStakingProviders[EarnType.FastLaneYield]).toBeUndefined();
        expect(LiquidStakingProviders[EarnType.GauntletYield]).toBeUndefined();
        expect(LiquidStakingProviders[EarnType.GauntletAlphaYield]).toBeUndefined();
    });
});

describe('Kintsu utils getWaitTime', () => {
    it('returns a positive number of seconds', () => {
        const wait = getWaitTime();
        expect(typeof wait).toBe('number');
        expect(wait).toBeGreaterThan(0);
    });
});
