import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Switch } from 'react-router-dom';

import AddNewWallet from '../../../src/ui/pages/AddNewWallet';
import {
    ADD_NEW_WALLET_CREATE_WALLET_ROUTE,
    ADD_NEW_WALLET_HOME_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE,
} from '../../../src/shared/constants/routes';

function renderAddNewWalletFlow() {
    return render(
        <MemoryRouter initialEntries={[ADD_NEW_WALLET_HOME_ROUTE]}>
            <Switch>
                <Route exact path={ADD_NEW_WALLET_HOME_ROUTE} component={AddNewWallet} />
                <Route path={ADD_NEW_WALLET_CREATE_WALLET_ROUTE}>
                    <div>Create wallet route marker</div>
                </Route>
                <Route path={ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE}>
                    <div>Import type route marker</div>
                </Route>
            </Switch>
        </MemoryRouter>,
    );
}

describe('AddNewWallet', () => {
    it('shows setup copy', () => {
        renderAddNewWalletFlow();

        expect(screen.getByText('Add New Wallet')).toBeInTheDocument();
        expect(screen.getByText('Welcome to your wallet setup.')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Build a new wallet for your assets or connect an existing one seamlessly.',
            ),
        ).toBeInTheDocument();
    });

    it('navigates to create wallet route', async () => {
        renderAddNewWalletFlow();

        await userEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));

        expect(await screen.findByText('Create wallet route marker')).toBeInTheDocument();
    });

    it('navigates to import wallet type route', async () => {
        renderAddNewWalletFlow();

        await userEvent.click(
            screen.getByRole('button', { name: /import an existing wallet/i }),
        );

        expect(await screen.findByText('Import type route marker')).toBeInTheDocument();
    });
});
