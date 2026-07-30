import { createMemoryHistory } from 'history';
import React from 'react';
import { render } from '@testing-library/react';
import { Router } from 'react-router-dom';

import {
    DEFAULT_ROUTE,
    LOCK_ROUTE,
    ONBOARDING_HOME_ROUTE,
    ONBOARDING_UNLOCK_ROUTE,
} from '../../../src/shared/constants/routes';
import OnboardingFlowSwitch from '../../../src/ui/pages/OnboardingFlowSwitch';
import {
    useCompletedOnboarding,
    useIsInitialized,
    useIsUnlocked,
} from '../../../src/store/selectors';

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useCompletedOnboarding: jest.fn(),
    useIsInitialized: jest.fn(),
    useIsUnlocked: jest.fn(),
}));

describe('OnboardingFlowSwitch', () => {
    beforeEach(() => {
        jest.mocked(useCompletedOnboarding).mockReturnValue(false);
        jest.mocked(useIsInitialized).mockReturnValue(true);
        jest.mocked(useIsUnlocked).mockReturnValue(false);
    });

    function renderSwitch(initialPath = '/onboarding/other') {
        const history = createMemoryHistory({ initialEntries: [initialPath] });

        render(
            <Router history={history}>
                <OnboardingFlowSwitch />
            </Router>,
        );

        return history;
    }

    it('redirects to default route when onboarding is completed', () => {
        jest.mocked(useCompletedOnboarding).mockReturnValue(true);
        const history = renderSwitch();
        expect(history.location.pathname).toBe(DEFAULT_ROUTE);
    });

    it('redirects to lock when wallet is unlocked but onboarding is not completed', () => {
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        const history = renderSwitch();
        expect(history.location.pathname).toBe(LOCK_ROUTE);
    });

    it('redirects to onboarding home when not initialized', () => {
        jest.mocked(useIsInitialized).mockReturnValue(false);
        const history = renderSwitch();
        expect(history.location.pathname).toBe(ONBOARDING_HOME_ROUTE);
    });

    it('redirects to onboarding unlock when initialized and locked', () => {
        const history = renderSwitch();
        expect(history.location.pathname).toBe(ONBOARDING_UNLOCK_ROUTE);
    });
});
