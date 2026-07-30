import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE } from '../../../../src/shared/constants/routes';
import TransactionConfirmationFlow from '../../../../src/ui/pages/DappInteraction/TransactionConfirmationFlow';


jest.mock('../../../../src/ui/pages/DappInteraction/DappInteractionProvider', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../../../src/ui/pages/Authenticated', () => ({
    __esModule: true,
    default: ({
        component: C,
        path,
    }: {
        component: React.ComponentType<object>;
        path: string;
    }) => {
        const { Route } = jest.requireActual('react-router-dom');
        return <Route path={path} component={C} exact />;
    },
}));

jest.mock('../../../../src/ui/pages/DappInteraction/SendNativeCoinConfirmation', () => ({
    __esModule: true,
    default: () => <div data-testid="send-native-route" />,
}));

describe('TransactionConfirmationFlow', () => {
    it('renders send-native route entry', () => {
        render(
            <MemoryRouter initialEntries={[TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE]}>
                <TransactionConfirmationFlow />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('send-native-route')).toBeInTheDocument();
    });
});
