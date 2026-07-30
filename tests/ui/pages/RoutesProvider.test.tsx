import { createMemoryHistory } from 'history';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';

import { ENVIRONMENT_TYPE_FULLSCREEN } from '../../../src/shared/constants/app';
import {
    ASSET_COIN_DETAIL_ROUTE,
    ASSET_NFT_DETAIL_ROUTE,
    COIN_DETAIL_ROUTE,
    DEFAULT_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
    SEND_ASSET_ROUTE,
    SWAP_ROUTE,
    TX_CONFIRMATION_ROUTE,
} from '../../../src/shared/constants/routes';
import type { Coin, ChillyAccount, MarketCoinPrice, NFT, PlatformCoin } from '../../../src/shared/types/Wallet';
import { updateCoinPricesFromBackground } from '../../../src/store/actions/uiActions';
import { getConnectedAccountsForTab } from '../../../src/store/selectorUtils';
import {
    useActiveTab,
    useCurrentAccount,
    useFirstPermissionRequest,
    useFirstUnapprovedMessage,
    useIsUnlocked,
} from '../../../src/store/selectors';
import { useFirstWalletSendCallsApprovalRequest, useFirstWalletShowCallsStatusApprovalRequest } from '../../../src/store/selectors/eip5792';
import { useFirstUnapprovedNetworkRequest } from '../../../src/store/selectors/network';
import { useFirstUnapprovedTx } from '../../../src/store/selectors/transactions';
import { useCurrentPlatformId } from '../../../src/store/selectors/wallet';
import { useAppDispatch } from '../../../src/store/store';
import { getEnvironmentType } from '../../../src/shared/utils/utils';
import RoutesProvider, { useRoutesData } from '../../../src/ui/pages/RoutesProvider';

jest.mock('../../../src/store/actions/uiActions', () => ({
    updateCoinPricesFromBackground: jest.fn(() => jest.fn()),
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useActiveTab: jest.fn(),
    useCurrentAccount: jest.fn(),
    useFirstPermissionRequest: jest.fn(),
    useFirstUnapprovedMessage: jest.fn(),
    useIsUnlocked: jest.fn(),
}));

jest.mock('../../../src/store/selectors/eip5792', () => ({
    ...jest.requireActual('../../../src/store/selectors/eip5792'),
    useFirstWalletSendCallsApprovalRequest: jest.fn(),
    useFirstWalletShowCallsStatusApprovalRequest: jest.fn(),
}));

jest.mock('../../../src/store/selectors/network', () => ({
    ...jest.requireActual('../../../src/store/selectors/network'),
    useFirstUnapprovedNetworkRequest: jest.fn(),
}));

jest.mock('../../../src/store/selectors/transactions', () => ({
    ...jest.requireActual('../../../src/store/selectors/transactions'),
    useFirstUnapprovedTx: jest.fn(),
}));

jest.mock('../../../src/store/selectors/wallet', () => ({
    ...jest.requireActual('../../../src/store/selectors/wallet'),
    useCurrentPlatformId: jest.fn(),
}));

jest.mock('../../../src/store/store', () => ({
    ...jest.requireActual('../../../src/store/store'),
    useAppDispatch: jest.fn(),
}));

jest.mock('../../../src/store/selectorUtils', () => ({
    ...jest.requireActual('../../../src/store/selectorUtils'),
    getConnectedAccountsForTab: jest.fn(() => []),
}));

jest.mock('../../../src/shared/utils/utils', () => ({
    ...jest.requireActual('../../../src/shared/utils/utils'),
    getEnvironmentType: jest.fn(() => 'popup'),
}));

const mockNft = { token_id: '1' } as NFT;
const mockCoin = { id: 'c1', token_id: 't1' } as Coin;
const mockMarketCoin = { id: 'm1' } as MarketCoinPrice;
const mockPlatformCoin = { token_id: 'pc1' } as PlatformCoin;

function accountFixture(overrides: Partial<ChillyAccount> = {}): ChillyAccount {
    return {
        id: 'acc-1',
        address: '0x1111111111111111111111111111111111111111',
        type: 'eip155:eoa',
        metadata: {
            importTime: 0,
            name: 'A',
            keyring: { type: 'HD Key Tree' },
        },
        ...overrides,
    } as ChillyAccount;
}

/** Invokes every RoutesProvider callback and exposes context for assertions */
function RoutesProbe() {
    const ctx = useRoutesData();
    return (
        <div>
            <button type="button" data-testid="unlock" onClick={() => void ctx.onUnlockSuccess()}>
                unlock
            </button>
            <button type="button" data-testid="forgot" onClick={() => ctx.onForgotPinCode()}>
                forgot
            </button>
            <button type="button" data-testid="asset-nft" onClick={() => ctx.onAssetNFTPress(mockNft, true)}>
                asset nft
            </button>
            <button type="button" data-testid="nft-send" onClick={() => ctx.onNFTSendPress(mockNft, false)}>
                nft send
            </button>
            <button type="button" data-testid="asset-coin" onClick={() => ctx.onAssetCoinPress(mockCoin, true)}>
                asset coin
            </button>
            <button type="button" data-testid="coin-send" onClick={() => ctx.onCoinSendPress(mockCoin, false)}>
                coin send
            </button>
            <button type="button" data-testid="coin-send-default-args" onClick={() => ctx.onCoinSendPress()}>
                coin send default
            </button>
            <button type="button" data-testid="coin-swap" onClick={() => ctx.onCoinSwapPress(mockPlatformCoin)}>
                coin swap
            </button>
            <button type="button" data-testid="coin-swap-clear" onClick={() => ctx.onCoinSwapPress(undefined)}>
                swap clear
            </button>
            <button type="button" data-testid="market-coin" onClick={() => ctx.onMarketCoinPress(mockMarketCoin)}>
                market
            </button>
            <span data-testid="not-connected-modal">{String(ctx.isShowNotConnectedModal)}</span>
            <span data-testid="prefilled">{JSON.stringify(ctx.prefilledCoinsToSwap ?? null)}</span>
        </div>
    );
}

function DefaultContextProbe() {
    const ctx = useRoutesData();
    return <span data-testid="default-hook">{typeof ctx.onUnlockSuccess}</span>;
}

describe('RoutesProvider', () => {
    let history: ReturnType<typeof createMemoryHistory>;
    let pushSpy: jest.SpyInstance;
    let replaceSpy: jest.SpyInstance;
    const mockDispatch = jest.fn();

    beforeEach(() => {
        jest.mocked(useActiveTab).mockReturnValue({ origin: undefined } as ReturnType<typeof useActiveTab>);
        jest.mocked(useCurrentAccount).mockReturnValue(null);
        jest.mocked(useFirstPermissionRequest).mockReturnValue(null);
        jest.mocked(useFirstUnapprovedMessage).mockReturnValue(null);
        jest.mocked(useFirstUnapprovedTx).mockReturnValue(null);
        jest.mocked(useFirstUnapprovedNetworkRequest).mockReturnValue(null);
        jest.mocked(useFirstWalletSendCallsApprovalRequest).mockReturnValue(null);
        jest.mocked(useFirstWalletShowCallsStatusApprovalRequest).mockReturnValue(null);
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        jest.mocked(useCurrentPlatformId).mockReturnValue(42);
        jest.mocked(useAppDispatch).mockReturnValue(mockDispatch as never);
        jest.mocked(getConnectedAccountsForTab).mockReturnValue([]);
        jest.mocked(getEnvironmentType).mockReturnValue('popup');
        jest.mocked(updateCoinPricesFromBackground).mockClear();
        jest.mocked(updateCoinPricesFromBackground).mockImplementation(() => jest.fn());
        mockDispatch.mockClear();

        history = createMemoryHistory({ initialEntries: ['/start'] });
        pushSpy = jest.spyOn(history, 'push');
        replaceSpy = jest.spyOn(history, 'replace');

        (global as unknown as { platform?: { openExtensionInBrowser: jest.Mock } }).platform = {
            openExtensionInBrowser: jest.fn(),
        };
    });

    function renderWithProvider(ui: React.ReactElement) {
        return render(<Router history={history}>{ui}</Router>);
    }

    it('useRoutesData reads default context when no provider is mounted', () => {
        render(<DefaultContextProbe />);
        expect(screen.getByTestId('default-hook')).toHaveTextContent('function');
    });

    it('dispatches coin price refresh when platform id is available', async () => {
        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );
        await waitFor(() => {
            expect(updateCoinPricesFromBackground).toHaveBeenCalledWith(42);
            expect(mockDispatch).toHaveBeenCalled();
        });
    });

    it('onUnlockSuccess replaces history with DEFAULT_ROUTE', async () => {
        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );
        await userEvent.click(screen.getByTestId('unlock'));
        expect(replaceSpy).toHaveBeenCalledWith(DEFAULT_ROUTE);
    });

    it('onForgotPinCode pushes recover route in fullscreen environment', async () => {
        jest.mocked(getEnvironmentType).mockReturnValue(ENVIRONMENT_TYPE_FULLSCREEN);
        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );
        await userEvent.click(screen.getByTestId('forgot'));
        expect(pushSpy).toHaveBeenCalledWith(FORGOT_CODE_RECOVER_CODE_ROUTE);
        expect(global.platform!.openExtensionInBrowser).not.toHaveBeenCalled();
    });

    it('onForgotPinCode opens browser extension route when not fullscreen', async () => {
        jest.mocked(getEnvironmentType).mockReturnValue('popup');
        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );
        await userEvent.click(screen.getByTestId('forgot'));
        expect(global.platform!.openExtensionInBrowser).toHaveBeenCalledWith(FORGOT_CODE_RECOVER_CODE_ROUTE);
        expect(pushSpy).not.toHaveBeenCalledWith(FORGOT_CODE_RECOVER_CODE_ROUTE);
    });

    it('navigation helpers push the expected routes', async () => {
        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );

        await userEvent.click(screen.getByTestId('asset-nft'));
        expect(pushSpy).toHaveBeenCalledWith(ASSET_NFT_DETAIL_ROUTE);

        await userEvent.click(screen.getByTestId('nft-send'));
        expect(pushSpy).toHaveBeenCalledWith(SEND_ASSET_ROUTE);

        await userEvent.click(screen.getByTestId('asset-coin'));
        expect(pushSpy).toHaveBeenCalledWith(ASSET_COIN_DETAIL_ROUTE);

        await userEvent.click(screen.getByTestId('coin-send'));
        expect(pushSpy).toHaveBeenCalledWith(SEND_ASSET_ROUTE);

        await userEvent.click(screen.getByTestId('coin-send-default-args'));
        expect(pushSpy).toHaveBeenCalledWith(SEND_ASSET_ROUTE);

        await userEvent.click(screen.getByTestId('coin-swap'));
        expect(pushSpy).toHaveBeenCalledWith(SWAP_ROUTE);
        expect(JSON.parse(screen.getByTestId('prefilled').textContent!)).toEqual({
            fromCoin: mockPlatformCoin,
        });

        await userEvent.click(screen.getByTestId('coin-swap-clear'));
        expect(screen.getByTestId('prefilled')).toHaveTextContent('null');

        await userEvent.click(screen.getByTestId('market-coin'));
        expect(pushSpy).toHaveBeenCalledWith(COIN_DETAIL_ROUTE);
    });

    it('shows not-connected modal when another account is connected to the tab origin', async () => {
        jest.mocked(useActiveTab).mockReturnValue({ origin: 'https://dapp.example' } as ReturnType<typeof useActiveTab>);
        jest.mocked(useCurrentAccount).mockReturnValue(accountFixture({ id: 'current' }));
        jest.mocked(getConnectedAccountsForTab).mockReturnValue([accountFixture({ id: 'other' })]);

        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('not-connected-modal')).toHaveTextContent('true');
        });
    });

    it('hides not-connected modal when the current account is connected', async () => {
        const acc = accountFixture({ id: 'same' });
        jest.mocked(useActiveTab).mockReturnValue({ origin: 'https://dapp.example' } as ReturnType<typeof useActiveTab>);
        jest.mocked(useCurrentAccount).mockReturnValue(acc);
        jest.mocked(getConnectedAccountsForTab).mockReturnValue([acc]);

        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('not-connected-modal')).toHaveTextContent('false');
        });
    });

    it('keeps not-connected modal hidden when the active tab has no origin', async () => {
        jest.mocked(useActiveTab).mockReturnValue({ id: 1 } as ReturnType<typeof useActiveTab>);
        jest.mocked(useCurrentAccount).mockReturnValue(accountFixture());
        jest.mocked(getConnectedAccountsForTab).mockReturnValue([accountFixture({ id: 'other' })]);

        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('not-connected-modal')).toHaveTextContent('false');
        });
    });

    it('navigates to tx confirmation when unlocked in popup and a permission request exists', async () => {
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        jest.mocked(getEnvironmentType).mockReturnValue('popup');
        jest.mocked(useFirstPermissionRequest).mockReturnValue({ method: 'eth_requestAccounts' } as never);

        const { rerender } = renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );

        await waitFor(() => {
            expect(pushSpy).toHaveBeenCalledWith(TX_CONFIRMATION_ROUTE);
        });

        pushSpy.mockClear();
        jest.mocked(useFirstPermissionRequest).mockReturnValue(null);
        jest.mocked(useFirstUnapprovedMessage).mockReturnValue({} as never);

        rerender(
            <Router history={history}>
                <RoutesProvider>
                    <RoutesProbe />
                </RoutesProvider>
            </Router>,
        );

        await waitFor(() => {
            expect(pushSpy).toHaveBeenCalledWith(TX_CONFIRMATION_ROUTE);
        });
    });

    it.each([
        ['unapproved tx', 'useFirstUnapprovedTx', useFirstUnapprovedTx],
        ['network request', 'useFirstUnapprovedNetworkRequest', useFirstUnapprovedNetworkRequest],
        ['send calls request', 'useFirstWalletSendCallsApprovalRequest', useFirstWalletSendCallsApprovalRequest],
        ['show calls status request', 'useFirstWalletShowCallsStatusApprovalRequest', useFirstWalletShowCallsStatusApprovalRequest],
    ] as const)(
        'navigates to tx confirmation when unlocked in popup and %s exists',
        async (_label, _hookName, useHook) => {
            jest.mocked(useIsUnlocked).mockReturnValue(true);
            jest.mocked(getEnvironmentType).mockReturnValue('popup');
            jest.mocked(useFirstPermissionRequest).mockReturnValue(null);
            jest.mocked(useFirstUnapprovedMessage).mockReturnValue(null);
            jest.mocked(useFirstUnapprovedTx).mockReturnValue(null);
            jest.mocked(useFirstUnapprovedNetworkRequest).mockReturnValue(null);
            jest.mocked(useFirstWalletSendCallsApprovalRequest).mockReturnValue(null);
            jest.mocked(useFirstWalletShowCallsStatusApprovalRequest).mockReturnValue(null);

            jest.mocked(useHook).mockReturnValue({ id: 'req' } as never);

            renderWithProvider(
                <RoutesProvider>
                    <RoutesProbe />
                </RoutesProvider>,
            );

            await waitFor(() => {
                expect(pushSpy).toHaveBeenCalledWith(TX_CONFIRMATION_ROUTE);
            });
        },
    );

    it('does not redirect to tx confirmation in fullscreen even when requests exist', async () => {
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        jest.mocked(getEnvironmentType).mockReturnValue(ENVIRONMENT_TYPE_FULLSCREEN);
        jest.mocked(useFirstUnapprovedTx).mockReturnValue({} as never);

        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );

        await waitFor(() => expect(updateCoinPricesFromBackground).toHaveBeenCalled());
        expect(pushSpy).not.toHaveBeenCalledWith(TX_CONFIRMATION_ROUTE);
    });

    it('does not redirect to tx confirmation while locked', async () => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        jest.mocked(getEnvironmentType).mockReturnValue('popup');
        jest.mocked(useFirstUnapprovedNetworkRequest).mockReturnValue({} as never);

        renderWithProvider(
            <RoutesProvider>
                <RoutesProbe />
            </RoutesProvider>,
        );

        await waitFor(() => expect(updateCoinPricesFromBackground).toHaveBeenCalled());
        expect(pushSpy).not.toHaveBeenCalledWith(TX_CONFIRMATION_ROUTE);
    });
});
