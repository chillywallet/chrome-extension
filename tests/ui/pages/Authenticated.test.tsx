import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Switch } from 'react-router-dom';

import Authenticated from '../../../src/ui/pages/Authenticated';
import {
    ONBOARDING_ROUTE,
    SWITCH_ACCOUNT_ROUTE,
    UNLOCK_ROUTE,
} from '../../../src/shared/constants/routes';
import { useCognito, useCompletedOnboarding, useIsUnlocked } from '../../../src/store/selectors';

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useCognito: jest.fn(),
    useCompletedOnboarding: jest.fn(),
    useIsUnlocked: jest.fn(),
}));

const GUARDED_PATH = '/app/guarded';

function renderAuthenticatedRoute() {
    return render(
        <MemoryRouter initialEntries={[GUARDED_PATH]}>
            <Switch>
                <Authenticated
                    path={GUARDED_PATH}
                    exact
                    component={() => <div data-testid="guarded-content">guarded</div>}
                />
                <Route path={ONBOARDING_ROUTE}>
                    <div data-testid="onboarding-dest">onboarding</div>
                </Route>
                <Route path={UNLOCK_ROUTE}>
                    <div data-testid="unlock-dest">unlock</div>
                </Route>
                <Route path={SWITCH_ACCOUNT_ROUTE}>
                    <div data-testid="switch-dest">switch-account</div>
                </Route>
            </Switch>
        </MemoryRouter>,
    );
}

describe('Authenticated', () => {
    beforeEach(() => {
        jest.mocked(useCognito).mockReturnValue({ id: 'user-1' } as any);
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        jest.mocked(useCompletedOnboarding).mockReturnValue(true);
    });

    it('renders the protected route when unlocked, onboarding done, and cognito present', () => {
        renderAuthenticatedRoute();
        expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
        expect(screen.queryByTestId('onboarding-dest')).not.toBeInTheDocument();
    });

    it('redirects to onboarding when onboarding is not completed', () => {
        jest.mocked(useCompletedOnboarding).mockReturnValue(false);
        renderAuthenticatedRoute();
        expect(screen.getByTestId('onboarding-dest')).toBeInTheDocument();
        expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
    });

    it('redirects to unlock when locked but onboarding is done', () => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        renderAuthenticatedRoute();
        expect(screen.getByTestId('unlock-dest')).toBeInTheDocument();
        expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
    });

});
