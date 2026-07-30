import { createMemoryHistory } from 'history';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { Router } from 'react-router-dom';

import { FORGOT_CODE_RECOVER_CODE_ROUTE } from '../../../src/shared/constants/routes';
import ForgotCodeFlowSwitch from '../../../src/ui/pages/ForgotCodeFlowSwitch';

describe('ForgotCodeFlowSwitch', () => {
    it('redirects to the forgot-code recover-code path', async () => {
        const history = createMemoryHistory({
            initialEntries: ['/forgot-code'],
        });

        render(
            <Router history={history}>
                <ForgotCodeFlowSwitch />
            </Router>,
        );

        await waitFor(() =>
            expect(history.location.pathname).toBe(FORGOT_CODE_RECOVER_CODE_ROUTE),
        );
    });
});
