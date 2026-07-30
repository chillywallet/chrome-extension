import { EarnItem, EarnListItem, EarnType, StakingType } from '../../../../../src/shared/types/Earn';

export const mockEarnCoin = {
    name: 'MON',
    symbol: 'MON',
    imageUrl: '',
    tokenAddress: '0x1000000000000000000000000000000000000001',
    decimals: 18,
};

export const mockEarnItem: EarnItem = {
    type: EarnType.aPriori,
    name: 'Liquid MON',
    description: '',
    fromCoin: mockEarnCoin,
    toCoin: {
        name: 'stMON',
        symbol: 'stMON',
        imageUrl: '',
        tokenAddress: '0x2000000000000000000000000000000000000002',
        decimals: 18,
    },
    partner_name: 'aPriori',
    platformId: 10143,
    requestsMerged: true,
};

export function mockEarnListItemStaking(overrides?: Partial<EarnListItem>): EarnListItem {
    return {
        enabled: true,
        name: 'Staking row',
        imageUrl: '',
        platformId: 10143,
        stakingType: StakingType.Staking,
        tokenAddress: mockEarnCoin.tokenAddress,
        decimals: 18,
        data: [mockEarnItem],
        ...overrides,
    };
}

export function mockEarnListItemYield(overrides?: Partial<EarnListItem>): EarnListItem {
    return {
        ...mockEarnListItemStaking(),
        name: 'Yield row',
        stakingType: StakingType.Yield,
        ...overrides,
    };
}
