import React, { useEffect } from 'react';
import { render } from '@testing-library/react';

import EarnProvider, { useEarnData } from '../../../../src/ui/pages/Earn/EarnProvider';
import { mockEarnItem, mockEarnListItemYield } from './fixtures/earnFixtures';

describe('EarnProvider', () => {
    function Consumer() {
        const {
            liquidStakingData,
            liquidStakingClaimData,
            yieldData,
            setLiquidStakingData,
            setLiquidStakingClaimData,
            setYieldData,
        } = useEarnData();

        useEffect(() => {
            setLiquidStakingData(mockEarnItem);
            setLiquidStakingClaimData({ data: mockEarnItem, waitTime: 60 });
            setYieldData(mockEarnListItemYield());
        }, [setLiquidStakingData, setLiquidStakingClaimData, setYieldData]);

        return (
            <span data-testid="out">
                {liquidStakingData?.name}|{liquidStakingClaimData?.waitTime}|{yieldData?.name}
            </span>
        );
    }

    it('updates liquid staking, claim, and yield context', async () => {
        const { findByTestId } = render(
            <EarnProvider>
                <Consumer />
            </EarnProvider>,
        );

        expect(await findByTestId('out')).toHaveTextContent(
            `${mockEarnItem.name}|60|${mockEarnListItemYield().name}`,
        );
    });
});
