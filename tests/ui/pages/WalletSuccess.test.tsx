import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import { DEFAULT_ROUTE } from '../../../src/shared/constants/routes';
import WalletSuccess from '../../../src/ui/pages/WalletSuccess';

jest.mock('../../../src/ui/components/Header', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: function MockHeader(props) {
            return React.createElement('span', { 'data-testid': 'header-title' }, props.title);
        },
    };
});

function renderWalletSuccess(variant: 'created' | 'recovered', initialPath = '/success') {
    const history = createMemoryHistory({ initialEntries: [initialPath] });
    const replaceSpy = jest.spyOn(history, 'replace');
    const view = render(
        <Router history={history}>
            <WalletSuccess variant={variant} />
        </Router>,
    );
    return { ...view, history, replaceSpy };
}

describe('WalletSuccess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders created variant titles and success copy', () => {
        renderWalletSuccess('created');

        expect(screen.getByTestId('header-title')).toHaveTextContent('Create Wallet');
        expect(screen.getByAltText('Success')).toBeInTheDocument();
        expect(screen.getByText('Wallet Created')).toBeInTheDocument();
        expect(
            screen.getByText('Now you can use your wallet for transactions in Chilly App.'),
        ).toBeInTheDocument();
    });

    it('renders recovered variant titles', () => {
        renderWalletSuccess('recovered');

        expect(screen.getByTestId('header-title')).toHaveTextContent('Recover Wallet');
        expect(screen.getByText('Wallet Recovered')).toBeInTheDocument();
    });

    it('replaces history with DEFAULT_ROUTE when Start Using Wallet is clicked', async () => {
        const { replaceSpy } = renderWalletSuccess('created', '/onboarding/success');

        await userEvent.click(screen.getByRole('button', { name: 'Start Using Wallet' }));

        expect(replaceSpy).toHaveBeenCalledWith(DEFAULT_ROUTE);
    });

    it('has no external social links (the wallet ships self-contained)', () => {
        renderWalletSuccess('created');

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
