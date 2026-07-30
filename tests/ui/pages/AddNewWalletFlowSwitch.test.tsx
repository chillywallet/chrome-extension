import { createMemoryHistory } from 'history';
import React from 'react';
import { render } from '@testing-library/react';
import { Router } from 'react-router-dom';

import AddNewWalletFlowSwitch from '../../../src/ui/pages/AddNewWalletFlowSwitch';
import {
    ADD_NEW_WALLET_HOME_ROUTE,
    ADD_NEW_WALLET_UNLOCK_ROUTE,
} from '../../../src/shared/constants/routes';
import { useIsUnlocked } from '../../../src/store/selectors';

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useIsUnlocked: jest.fn(),
}));

describe('AddNewWalletFlowSwitch', () => {
    beforeEach(() => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
    });

    function renderSwitch() {
        const history = createMemoryHistory({ initialEntries: ['/add-wallet/other'] });

        render(
            <Router history={history}>
                <AddNewWalletFlowSwitch />
            </Router>,
        );

        return history;
    }

    it('redirects to home when unlocked', () => {
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        const history = renderSwitch();
        expect(history.location.pathname).toBe(ADD_NEW_WALLET_HOME_ROUTE);
    });

    it('redirects to unlock when locked', () => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        const history = renderSwitch();
        expect(history.location.pathname).toBe(ADD_NEW_WALLET_UNLOCK_ROUTE);
    });
});
