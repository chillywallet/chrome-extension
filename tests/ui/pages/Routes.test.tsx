import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import {
    ADD_NEW_WALLET_ROUTE,
    ASSET_ROUTE,
    COIN_DETAIL_ROUTE,
    DEFAULT_ROUTE,
    DEVELOP_ROUTE,
    FIAT_OFF_RAMP_ROUTE,
    FIAT_ON_RAMP_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
    FORGOT_CODE_ROUTE,
    ONBOARDING_ROUTE,
    UNLOCK_ROUTE,
} from '../../../src/shared/constants/routes';
import { getEnvironmentType } from '../../../src/shared/utils/utils';

import Routes from '../../../src/ui/pages/Routes';

jest.mock('../../../src/shared/utils/utils', () => ({
    ...jest.requireActual('../../../src/shared/utils/utils'),
    getEnvironmentType: jest.fn(() => 'popup'),
}));

jest.mock('../../../src/ui/pages/RoutesProvider', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../../src/ui/pages/Earn/EarnProvider', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));


jest.mock('../../../src/ui/pages/Authenticated', () => {
    const { Route } = require('react-router-dom');
    return {
        __esModule: true,
        default: (props: Record<string, unknown>) => <Route {...props} />,
    };
});

/** Minimal route targets — full pages are exercised in dedicated tests. */
const stub = (testId: string) => ({
    __esModule: true,
    default: function Stub() {
        return <div data-testid={testId} />;
    },
});

jest.mock('../../../src/ui/pages/Asset', () => stub('page-asset'));
jest.mock('../../../src/ui/pages/CoinDetail', () => stub('page-coin-detail'));
jest.mock('../../../src/ui/pages/Contact', () => stub('page-contact'));
jest.mock('../../../src/ui/pages/Develop', () => stub('page-develop'));
jest.mock('../../../src/ui/pages/ForgotCodeFlow', () => stub('page-forgot-code-flow'));
jest.mock('../../../src/ui/pages/Home/Home', () => stub('page-home'));
jest.mock('../../../src/ui/pages/IconSelector', () => stub('page-icon-selector'));
jest.mock('../../../src/ui/pages/Lock', () => stub('page-lock'));
jest.mock('../../../src/ui/pages/NFTDetail', () => stub('page-nft-detail'));
jest.mock('../../../src/ui/pages/OnboardingFlow', () => stub('page-onboarding-flow'));
jest.mock('../../../src/ui/pages/OnboardingHome', () => stub('page-onboarding-home'));
jest.mock('../../../src/ui/pages/Send/SendAssetFlow', () => stub('page-send-asset-flow'));
jest.mock('../../../src/ui/pages/AddNewWalletFlow', () => stub('page-add-new-wallet-flow'));
jest.mock('../../../src/ui/pages/AssetCoinDetail', () => stub('page-asset-coin-detail'));
jest.mock(
    '../../../src/ui/pages/DappInteraction/TransactionConfirmationFlow',
    () => stub('page-tx-confirmation-flow'),
);
jest.mock('../../../src/ui/pages/Earn/EarnFlow', () => stub('page-earn-flow'));
jest.mock('../../../src/ui/pages/GasOptions', () => stub('page-gas-options'));
jest.mock('../../../src/ui/pages/NFTCollection', () => stub('page-nft-collection'));
jest.mock('../../../src/ui/pages/SearchList', () => stub('page-search-list'));
jest.mock('../../../src/ui/pages/Settings', () => stub('page-settings'));
jest.mock('../../../src/ui/pages/Swap', () => stub('page-swap'));


jest.mock('../../../src/ui/pages/Unlock', () => ({
    __esModule: true,
    default: (props: {
        onUnlockSuccess: (pin: string) => void | Promise<void>;
        onForgotPinCode: () => void;
    }) => (
        <div data-testid="page-unlock">
            <button
                type="button"
                data-testid="mock-unlock-success"
                onClick={() => props.onUnlockSuccess('11111111')}>
                unlock
            </button>
            <button type="button" data-testid="mock-forgot-pin" onClick={() => props.onForgotPinCode()}>
                forgot
            </button>
        </div>
    ),
}));

describe('Routes', () => {
    const originalPlatform = global.platform;
    let openExtensionInBrowserSpy: jest.Mock;

    beforeEach(() => {
        openExtensionInBrowserSpy = jest.fn();
        global.platform = {
            ...originalPlatform,
            openExtensionInBrowser: openExtensionInBrowserSpy,
        };
        jest.mocked(getEnvironmentType).mockReturnValue('popup');
    });

    afterEach(() => {
        global.platform = originalPlatform;
    });

    function renderAt(initialPath: string) {
        const history = createMemoryHistory({ initialEntries: [initialPath] });
        const view = render(
            <Router history={history}>
                <Routes />
            </Router>,
        );
        return { ...view, history };
    }

    it('routes unlock callbacks: success replaces history with home', async () => {
        const replaceSpy = jest.fn();
        const { history } = renderAt(UNLOCK_ROUTE);
        jest.spyOn(history, 'replace').mockImplementation(replaceSpy);

        await userEvent.click(screen.getByTestId('mock-unlock-success'));

        expect(replaceSpy).toHaveBeenCalledWith(DEFAULT_ROUTE);
    });

    it('routes unlock forgot pin: fullscreen uses in-app navigation', async () => {
        jest.mocked(getEnvironmentType).mockReturnValue('fullscreen');
        const pushSpy = jest.fn();
        const { history } = renderAt(UNLOCK_ROUTE);
        jest.spyOn(history, 'push').mockImplementation(pushSpy);

        await userEvent.click(screen.getByTestId('mock-forgot-pin'));

        expect(pushSpy).toHaveBeenCalledWith(FORGOT_CODE_RECOVER_CODE_ROUTE);
        expect(openExtensionInBrowserSpy).not.toHaveBeenCalled();
    });

    it('routes unlock forgot pin: extension opens recover flow in browser', async () => {
        jest.mocked(getEnvironmentType).mockReturnValue('popup');

        renderAt(UNLOCK_ROUTE);

        await userEvent.click(screen.getByTestId('mock-forgot-pin'));

        expect(openExtensionInBrowserSpy).toHaveBeenCalledWith(FORGOT_CODE_RECOVER_CODE_ROUTE);
    });

    it('mounts onboarding and other top-level flows for coverage', () => {
        const { rerender, history } = renderAt(ONBOARDING_ROUTE);
        expect(screen.getByTestId('page-onboarding-flow')).toBeInTheDocument();

        act(() => {
            history.replace(FORGOT_CODE_ROUTE);
            rerender(
                <Router history={history}>
                    <Routes />
                </Router>,
            );
        });
        expect(screen.getByTestId('page-forgot-code-flow')).toBeInTheDocument();

        act(() => {
            history.replace(ADD_NEW_WALLET_ROUTE);
            rerender(
                <Router history={history}>
                    <Routes />
                </Router>,
            );
        });
        expect(screen.getByTestId('page-add-new-wallet-flow')).toBeInTheDocument();
    });

    it('includes Develop route only when BUILD_TYPE is not Prod', () => {
        const prevBuild = process.env.BUILD_TYPE;
        try {
            process.env.BUILD_TYPE = 'Prod';
            const { rerender, history } = renderAt(DEVELOP_ROUTE);
            expect(screen.queryByTestId('page-develop')).not.toBeInTheDocument();

            process.env.BUILD_TYPE = 'Debug';
            act(() => {
                rerender(
                    <Router history={history}>
                        <Routes />
                    </Router>,
                );
            });
            expect(screen.getByTestId('page-develop')).toBeInTheDocument();
        } finally {
            process.env.BUILD_TYPE = prevBuild;
        }
    });

    it('authenticates core wallet routes against stubs', () => {
        const { rerender, history } = renderAt(ASSET_ROUTE);
        act(() => {
            history.replace(ASSET_ROUTE);
            rerender(
                <Router history={history}>
                    <Routes />
                </Router>,
            );
        });
        expect(screen.getByTestId('page-asset')).toBeInTheDocument();

        act(() => {
            history.replace(`${COIN_DETAIL_ROUTE}/abc`);
            rerender(
                <Router history={history}>
                    <Routes />
                </Router>,
            );
        });
        expect(screen.getByTestId('page-coin-detail')).toBeInTheDocument();
    });
});
