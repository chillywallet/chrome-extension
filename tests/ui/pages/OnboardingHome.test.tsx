import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import OnboardingHome from '../../../src/ui/pages/OnboardingHome';
import { ONBOARDING_CREATE_PIN_CODE_ROUTE } from '../../../src/shared/constants/routes';

const mockHistoryPush = jest.fn();

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({ push: mockHistoryPush }),
}));

describe('OnboardingHome', () => {
    beforeEach(() => {
        mockHistoryPush.mockClear();
    });

    it('renders hero copy and the get-started action', () => {
        render(<OnboardingHome />);
        expect(screen.getByText(/Manage all/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
    });

    it('navigates to pin creation when Get started is clicked', async () => {
        render(<OnboardingHome />);
        await userEvent.click(screen.getByRole('button', { name: 'Get started' }));
        expect(mockHistoryPush).toHaveBeenCalledWith(ONBOARDING_CREATE_PIN_CODE_ROUTE);
    });
});
