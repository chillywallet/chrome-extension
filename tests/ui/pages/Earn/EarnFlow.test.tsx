import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EarnFlow from '../../../../src/ui/pages/Earn/EarnFlow';
import {
    EARN_LIST_ROUTE,
    EARN_LIQUID_STAKING_CLAIM_ROUTE,
    EARN_LIQUID_STAKING_ROUTE,
} from '../../../../src/shared/constants/routes';

jest.mock('../../../../src/ui/pages/Earn/EarnList', () => ({
    __esModule: true,
    default: () => <div data-testid="earn-list" />,
}));
jest.mock('../../../../src/ui/pages/Earn/LiquidStaking', () => ({
    __esModule: true,
    default: () => <div data-testid="liquid-staking" />,
}));
jest.mock('../../../../src/ui/pages/Earn/LiquidStakingClaim', () => ({
    __esModule: true,
    default: () => <div data-testid="liquid-staking-claim" />,
}));
jest.mock('../../../../src/ui/pages/Earn/EarnSwitch', () => ({
    __esModule: true,
    default: () => <div data-testid="earn-switch" />,
}));

describe('EarnFlow', () => {
    function route(initial: string) {
        return render(
            <MemoryRouter initialEntries={[initial]}>
                <EarnFlow />
            </MemoryRouter>,
        );
    }

    it.each([
        [EARN_LIST_ROUTE, 'earn-list'],
        [EARN_LIQUID_STAKING_ROUTE, 'liquid-staking'],
        [EARN_LIQUID_STAKING_CLAIM_ROUTE, 'liquid-staking-claim'],
        ['/earn/unknown', 'earn-switch'],
    ])('path %s renders %s', (path, testId) => {
        route(path);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
    });
});
