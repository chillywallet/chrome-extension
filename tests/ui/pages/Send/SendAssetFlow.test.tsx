import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch, Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';

import SendAssetFlow from '../../../../src/ui/pages/Send/SendAssetFlow';
import { RoutesContext } from '../../../../src/ui/pages/RoutesProvider';
import type { NFT } from '../../../../src/shared/types/Wallet';
import {
    SEND_ASSET_AMOUNT_ROUTE,
    SEND_ASSET_CONFIRMATION_ROUTE,
    SEND_ASSET_RECEIVER_ROUTE,
    SEND_ASSET_SELECT_ASSET_ROUTE,
} from '../../../../src/shared/constants/routes';
import { sendRoutesContextFixture } from './fixtures/sendRoutesContextFixture';

const mockCoin = {
    token_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    coin_name: 'Ether',
    symbol: 'ETH',
    platform_id: 1,
    wallet_address: '0xw',
    wallet_name: 'w',
    token_id: 't',
    balance: 1,
    balance_usd: 1,
    integration_type: 'native',
    avatar: null,
    is_custom: false,
    is_hidden: false,
    is_verified: true,
    decimals: 18,
} as any;

jest.mock('../../../../src/ui/pages/Authenticated', () => {
    const React = jest.requireActual('react');
    const { Route } = jest.requireActual('react-router-dom');
    return {
        __esModule: true,
        default: ({ path, component: Component }: any) =>
            Component ? (
                <Route exact path={path} render={(props: any) => <Component {...props} />} />
            ) : null,
    };
});

jest.mock('../../../../src/ui/pages/Send/SendSelectAsset', () => ({
    __esModule: true,
    default: ({
        onCoinPress,
        onNFTPress,
    }: {
        onCoinPress: (c: any) => void;
        onNFTPress: (n: NFT) => void;
    }) => (
        <div data-testid="send-select">
            <button type="button" data-testid="select-coin" onClick={() => onCoinPress(mockCoin)}>
                select coin
            </button>
            <button type="button" data-testid="select-nft" onClick={() => onNFTPress({} as NFT)}>
                select nft
            </button>
        </div>
    ),
}));

jest.mock('../../../../src/ui/pages/Send/EnterSendData', () => ({
    __esModule: true,
    default: ({ goToNextStep }: any) => (
        <div data-testid="enter-send">
            <button
                type="button"
                data-testid="receiver-coin-flow"
                onClick={() =>
                    goToNextStep({
                        walletAddress: '0x70997970C51812dc3A010C7d01b480eCc8Ea8A4',
                        name: 'Bob',
                        avatar: null,
                    })
                }>
                next coin recv
            </button>
            <button
                type="button"
                data-testid="receiver-nft-flow"
                onClick={() =>
                    goToNextStep({
                        walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293Bc',
                        name: 'Carl',
                        avatar: '🎨',
                    })
                }>
                next nft recv
            </button>
        </div>
    ),
}));

jest.mock('../../../../src/ui/pages/Send/SendAmount', () => ({
    __esModule: true,
    default: ({ goToNextStep }: any) => (
        <div data-testid="send-amount-page">
            amount page
            <button
                type="button"
                data-testid="go-to-confirm"
                onClick={() =>
                    goToNextStep({ value: 1n, usdValue: 2, balance: 5n, decimals: 18 })
                }>
                next
            </button>
        </div>
    ),
}));

jest.mock('../../../../src/ui/pages/Send/SendConfirmation', () => ({
    __esModule: true,
    default: ({ onTxSuccess }: any) => (
        <div data-testid="send-confirmation-page">
            confirmation
            <button type="button" data-testid="tx-success" onClick={() => onTxSuccess()}>
                tx success
            </button>
        </div>
    ),
}));

describe('SendAssetFlow', () => {
    const renderFlow = ({
        pathname = SEND_ASSET_SELECT_ASSET_ROUTE,
        sendAssetInitData,
        setHomeTabIndex = jest.fn(),
        setSubTabIndex = jest.fn(),
    }: {
        pathname?: string;
        sendAssetInitData?: any;
        setHomeTabIndex?: jest.Mock;
        setSubTabIndex?: jest.Mock;
    } = {}) => {
        const history = createMemoryHistory({ initialEntries: [pathname] });
        const ui = (
            <Router history={history}>
                <RoutesContext.Provider
                    value={sendRoutesContextFixture({
                        sendAssetInitData,
                        setHomeTabIndex,
                        setSubTabIndex,
                    })}>
                    <Switch>
                        <SendAssetFlow />
                    </Switch>
                </RoutesContext.Provider>
            </Router>
        );
        return { ...render(ui), history };
    };

    it('redirects to select asset when no asset is chosen and route is not select page', async () => {
        const { history } = renderFlow({
            pathname: SEND_ASSET_RECEIVER_ROUTE,
        });

        await waitFor(() =>
            expect(history.location.pathname).toBe(SEND_ASSET_SELECT_ASSET_ROUTE),
        );
    });

    it('navigates coin send: select asset → receiver → amount', async () => {
        const { history } = renderFlow();

        expect(screen.getByTestId('send-select')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('select-coin'));
        expect(history.location.pathname).toBe(SEND_ASSET_RECEIVER_ROUTE);

        await userEvent.click(screen.getByTestId('receiver-coin-flow'));
        expect(history.location.pathname).toBe(SEND_ASSET_AMOUNT_ROUTE);

        await screen.findByTestId('send-amount-page');
    });

    it('navigates nft send: receiver goes straight to confirmation', async () => {
        const { history } = renderFlow();

        await userEvent.click(screen.getByTestId('select-nft'));
        expect(history.location.pathname).toBe(SEND_ASSET_RECEIVER_ROUTE);

        await userEvent.click(screen.getByTestId('receiver-nft-flow'));
        expect(history.location.pathname).toBe(SEND_ASSET_CONFIRMATION_ROUTE);
        expect(screen.getByTestId('send-confirmation-page')).toBeInTheDocument();
    });

    it('preselects asset from routes init data (coin)', async () => {
        const { history } = renderFlow({
            pathname: SEND_ASSET_SELECT_ASSET_ROUTE,
            sendAssetInitData: { coinToSend: mockCoin, isAAWallet: false },
        });

        await waitFor(() =>
            expect(history.location.pathname).toBe(SEND_ASSET_RECEIVER_ROUTE),
        );
    });

    it('preselects asset from routes init data (nft)', async () => {
        const { history } = renderFlow({
            pathname: SEND_ASSET_SELECT_ASSET_ROUTE,
            sendAssetInitData: { nftToSend: {} as any, isAAWallet: false },
        });

        await waitFor(() =>
            expect(history.location.pathname).toBe(SEND_ASSET_RECEIVER_ROUTE),
        );
    });

    it('navigates from amount to confirmation', async () => {
        const { history } = renderFlow();

        await userEvent.click(screen.getByTestId('select-coin'));
        await userEvent.click(screen.getByTestId('receiver-coin-flow'));
        await screen.findByTestId('send-amount-page');

        await userEvent.click(screen.getByTestId('go-to-confirm'));
        expect(history.location.pathname).toBe(SEND_ASSET_CONFIRMATION_ROUTE);
    });

    it('invokes onTxSuccess for non-AA wallet sets home tab to 1 and sub to 2', async () => {
        const setHomeTabIndex = jest.fn();
        const setSubTabIndex = jest.fn();
        renderFlow({ setHomeTabIndex, setSubTabIndex });

        await userEvent.click(screen.getByTestId('select-nft'));
        await userEvent.click(screen.getByTestId('receiver-nft-flow'));
        await userEvent.click(screen.getByTestId('tx-success'));

        expect(setSubTabIndex).toHaveBeenCalledWith(2);
        expect(setHomeTabIndex).toHaveBeenCalledWith(1);
    });

    it('invokes onTxSuccess for AA wallet sets home tab to 2', async () => {
        const setHomeTabIndex = jest.fn();
        const setSubTabIndex = jest.fn();
        renderFlow({
            sendAssetInitData: { isAAWallet: true } as any,
            setHomeTabIndex,
            setSubTabIndex,
        });

        await userEvent.click(screen.getByTestId('select-nft'));
        await userEvent.click(screen.getByTestId('receiver-nft-flow'));
        await userEvent.click(screen.getByTestId('tx-success'));

        expect(setHomeTabIndex).toHaveBeenCalledWith(2);
    });
});
