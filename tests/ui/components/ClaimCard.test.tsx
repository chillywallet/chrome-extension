import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import type { MergedLiquidStakingRequest } from '../../../src/lib/liquid-staking/Types';
import { ClaimCard, ClaimCardPlaceholder } from '../../../src/ui/components/ClaimCard';
import { mockEarnItem } from '../pages/Earn/fixtures/earnFixtures';

function makeData(overrides: Partial<MergedLiquidStakingRequest> = {}): MergedLiquidStakingRequest {
    return {
        shares: '0',
        claimed: false,
        id: 'req-1',
        is_claimable: false,
        cancellable: false,
        requested_at: '1700000000',
        ...overrides,
    };
}

describe('ClaimCardPlaceholder', () => {
    it('renders skeleton layout', () => {
        const { container } = render(<ClaimCardPlaceholder />);
        expect(container.querySelector('.animate-pulse')).toBeTruthy();
    });
});

describe('ClaimCard', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows Claim and merged total when claimable with merged requests', () => {
        const onClaimPress = jest.fn();
        const onCancelPress = jest.fn();
        const data = makeData({
            is_claimable: true,
            totalShares: 42,
            count: 3,
            shares: '999999999999999999999',
        });

        render(
            <ClaimCard
                data={data}
                earnItem={mockEarnItem}
                waitTime={3600}
                onClaimPress={onClaimPress}
                onCancelPress={onCancelPress}
            />,
        );

        expect(screen.getByText('42 stMON')).toBeTruthy();
        expect(screen.getByText('3 Requests')).toBeTruthy();

        expect(screen.getByRole('button', { name: 'Claim' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    it('uses singular Request when count is 1', () => {
        render(
            <ClaimCard
                data={makeData({ is_claimable: true, totalShares: 1, count: 1 })}
                earnItem={mockEarnItem}
                waitTime={0}
                onClaimPress={jest.fn()}
                onCancelPress={jest.fn()}
            />,
        );

        expect(screen.getByText('1 Request')).toBeTruthy();
    });

    it('formats shares when claimable without merged requests', () => {
        const earnNoMerge = { ...mockEarnItem, requestsMerged: false };
        render(
            <ClaimCard
                data={makeData({
                    is_claimable: true,
                    shares: '1000000000000000000',
                })}
                earnItem={earnNoMerge}
                waitTime={0}
                onClaimPress={jest.fn()}
                onCancelPress={jest.fn()}
            />,
        );

        expect(screen.getByText('1 stMON')).toBeTruthy();
        expect(screen.queryByText(/Request/)).toBeNull();
    });

    it('calls onClaimPress when Claim is clicked', () => {
        const onClaimPress = jest.fn();
        const data = makeData({ is_claimable: true, totalShares: 5 });

        render(
            <ClaimCard
                data={data}
                earnItem={mockEarnItem}
                waitTime={0}
                onClaimPress={onClaimPress}
                onCancelPress={jest.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
        expect(onClaimPress).toHaveBeenCalledTimes(1);
        expect(onClaimPress).toHaveBeenCalledWith(data);
    });

    it('shows Cancel and calls onCancelPress when pending and cancellable', () => {
        const onCancelPress = jest.fn();
        const nowSec = Math.floor(Date.now() / 1000);
        const data = makeData({
            is_claimable: false,
            cancellable: true,
            shares: '500000000000000000',
            requested_at: String(nowSec - 100),
        });

        render(
            <ClaimCard
                data={data}
                earnItem={{ ...mockEarnItem, requestsMerged: false }}
                waitTime={3600}
                onClaimPress={jest.fn()}
                onCancelPress={onCancelPress}
            />,
        );

        expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
        expect(screen.getByText(/Available in ~/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancelPress).toHaveBeenCalledTimes(1);
        expect(onCancelPress).toHaveBeenCalledWith(data);
    });

    it('shows Pending when not claimable and not cancellable', () => {
        const nowSec = Math.floor(Date.now() / 1000);
        render(
            <ClaimCard
                data={makeData({
                    is_claimable: false,
                    cancellable: false,
                    shares: '1000000000000000000',
                    requested_at: String(nowSec - 50),
                })}
                earnItem={{ ...mockEarnItem, requestsMerged: false }}
                waitTime={7200}
                onClaimPress={jest.fn()}
                onCancelPress={jest.fn()}
            />,
        );

        expect(screen.getByText('Pending')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Claim' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    it('formats totalShares as zero when merged claimable but totalShares missing', () => {
        render(
            <ClaimCard
                data={makeData({ is_claimable: true, count: 0 })}
                earnItem={mockEarnItem}
                waitTime={0}
                onClaimPress={jest.fn()}
                onCancelPress={jest.fn()}
            />,
        );

        expect(screen.getByText('0 stMON')).toBeTruthy();
    });
});
