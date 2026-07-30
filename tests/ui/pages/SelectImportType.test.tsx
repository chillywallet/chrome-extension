import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import {
    ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE,
    ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE,
    ONBOARDING_IMPORT_WALLET_SEED_PHRASE_ROUTE,
    ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE,
} from '../../../src/shared/constants/routes';
import SelectImportType from '../../../src/ui/pages/SelectImportType';

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <div>{title}</div>,
}));

function renderSelectImportType(initialPath: string) {
    const history = createMemoryHistory({ initialEntries: [initialPath] });
    const pushSpy = jest.spyOn(history, 'push');
    const view = render(
        <Router history={history}>
            <SelectImportType />
        </Router>,
    );
    return { ...view, history, pushSpy };
}

describe('SelectImportType', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders recover header, import method copy, and both import options', () => {
        renderSelectImportType(ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE);

        expect(screen.getByText('Recover Wallet')).toBeInTheDocument();
        expect(screen.getByText('Choose Import Method')).toBeInTheDocument();
        expect(
            screen.getByText("Choose how you'd like to import your existing wallet."),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /private key/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /seed phrase/i })).toBeInTheDocument();
    });

    it('from onboarding, navigates to onboarding private key import', async () => {
        const { pushSpy } = renderSelectImportType(ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE);

        await userEvent.click(screen.getByRole('button', { name: /private key/i }));

        expect(pushSpy).toHaveBeenCalledWith(ONBOARDING_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
    });

    it('from onboarding, navigates to onboarding seed phrase import', async () => {
        const { pushSpy } = renderSelectImportType(ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE);

        await userEvent.click(screen.getByRole('button', { name: /seed phrase/i }));

        expect(pushSpy).toHaveBeenCalledWith(ONBOARDING_IMPORT_WALLET_SEED_PHRASE_ROUTE);
    });

    it('from add-wallet flow, navigates to add-wallet private key import', async () => {
        const { pushSpy } = renderSelectImportType(ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE);

        await userEvent.click(screen.getByRole('button', { name: /private key/i }));

        expect(pushSpy).toHaveBeenCalledWith(ADD_NEW_WALLET_IMPORT_WALLET_PRIVATE_KEY_ROUTE);
    });

    it('from add-wallet flow, navigates to add-wallet seed phrase import', async () => {
        const { pushSpy } = renderSelectImportType(ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE);

        await userEvent.click(screen.getByRole('button', { name: /seed phrase/i }));

        expect(pushSpy).toHaveBeenCalledWith(ADD_NEW_WALLET_IMPORT_WALLET_SEED_PHRASE_ROUTE);
    });
});
