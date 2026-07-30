import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import {
    ONBOARDING_CREATE_WALLET_ROUTE,
    ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE,
} from '../../../src/shared/constants/routes';
import OnboardingWelcome from '../../../src/ui/pages/OnboardingWelcome';

function renderWelcome(initialPath = '/') {
    const history = createMemoryHistory({ initialEntries: [initialPath] });
    const pushSpy = jest.spyOn(history, 'push');
    const view = render(
        <Router history={history}>
            <OnboardingWelcome />
        </Router>,
    );
    return { ...view, history, pushSpy };
}

describe('OnboardingWelcome', () => {
    it('renders intro copy and wallet choice buttons', () => {
        renderWelcome();

        expect(screen.getByText("Let's get started")).toBeInTheDocument();
        expect(screen.getByText("Chilly isn't just a regular wallet.")).toBeInTheDocument();
        expect(
            screen.getByText(/We provide the tools that help you stay informed and degen on the go/),
        ).toBeInTheDocument();

        expect(screen.getByRole('button', { name: /create a new wallet/i })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /import an existing wallet/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /connect a hardware wallet/i }),
        ).toBeInTheDocument();
    });

    it('navigates to create wallet route', async () => {
        const { pushSpy } = renderWelcome();

        await userEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));

        expect(pushSpy).toHaveBeenCalledWith(ONBOARDING_CREATE_WALLET_ROUTE);
    });

    it('navigates to import wallet flow', async () => {
        const { pushSpy } = renderWelcome();

        await userEvent.click(
            screen.getByRole('button', { name: /import an existing wallet/i }),
        );

        expect(pushSpy).toHaveBeenCalledWith(ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE);
    });
});
