import React from 'react';
import { render, screen } from '@testing-library/react';

import EarnSwitch from '../../../../src/ui/pages/Earn/EarnSwitch';
import { EARN_LIST_ROUTE } from '../../../../src/shared/constants/routes';

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    Redirect: ({ to }: { to: { pathname: string } }) => (
        <div data-testid="redirect">{to.pathname}</div>
    ),
}));

describe('EarnSwitch', () => {
    it('redirects to earn list route', () => {
        render(<EarnSwitch />);
        expect(screen.getByTestId('redirect')).toHaveTextContent(EARN_LIST_ROUTE);
    });
});
