import React from 'react';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { render } from '@testing-library/react';

import SendAssetFlowSwitch from '../../../../src/ui/pages/Send/SendAssetFlowSwitch';
import { SEND_ASSET_SELECT_ASSET_ROUTE } from '../../../../src/shared/constants/routes';

describe('SendAssetFlowSwitch', () => {
    it('redirects to send asset selection route', () => {
        const history = createMemoryHistory({ initialEntries: ['/anything'] });

        render(
            <Router history={history}>
                <SendAssetFlowSwitch />
            </Router>,
        );

        expect(history.location.pathname).toBe(SEND_ASSET_SELECT_ASSET_ROUTE);
    });
});
