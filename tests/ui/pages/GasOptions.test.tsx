import { configureStore } from '@reduxjs/toolkit';
import _ from 'lodash';
import React from 'react';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CHAIN_CONFIG_SEPOLIA as CHAIN_SEPOLIA } from '../../../src/config/chains';
import { DEFAULT_CHAIN } from '../../../src/lib/ChainsUtils';
import { loadGasOptions } from '../../../src/store/actions/uiActions';
import * as storeSelectors from '../../../src/store/selectors';
import { useAppDispatch } from '../../../src/store/store';
import GasOptions from '../../../src/ui/pages/GasOptions';

import { buildHomeReduxState } from './Home/fixtures/homeHarness';

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(),
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useSelectedNetwork: jest.fn(),
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    loadGasOptions: jest.fn(() => () => Promise.resolve()),
}));

jest.mock('../../../src/ui/components/Header', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: function HeaderMock(props) {
            return React.createElement(
                'div',
                null,
                React.createElement('h1', null, props.title),
                props.action,
            );
        },
    };
});

jest.mock('../../../src/ui/components/GasOptionContent', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: function GasOptionContentMock(props) {
            return React.createElement(
                'div',
                { 'data-testid': 'gas-option-content' },
                props.network.short_name,
            );
        },
    };
});

jest.mock('../../../src/ui/components/NetworkMenu', () => {
    const React = require('react');
    const CHAIN_SEPOLIA_CHAIN = require('../../../src/config/chains').CHAIN_CONFIG_SEPOLIA;
    return {
        __esModule: true,
        default: function NetworkMenuMock(props) {
            if (!props.visible) {
                return null;
            }
            return React.createElement(
                'div',
                { 'data-testid': 'network-menu' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        'data-testid': 'network-menu-select-sepolia',
                        onClick: () => props.onNetworkChange(CHAIN_SEPOLIA_CHAIN),
                    },
                    'Sepolia',
                ),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        'data-testid': 'network-menu-close',
                        onClick: props.onClosePress,
                    },
                    'Close menu',
                ),
            );
        },
    };
});

jest.mock('../../../src/ui/components/Modal', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: function ModalMock(props) {
            if (!props.visible) {
                return null;
            }
            return React.createElement(
                'div',
                { 'data-testid': 'how-should-modal' },
                props.children,
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        'data-testid': 'modal-dismiss',
                        onClick: props.onClose,
                    },
                    'dismiss-from-prop',
                ),
            );
        },
    };
});

describe('GasOptions', () => {
    const mockDispatch = jest.fn(action =>
        typeof action === 'function' ? action(mockDispatch, () => ({})) : action,
    );

    let unmountLast: (() => void) | undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        unmountLast = undefined;
        jest.mocked(useAppDispatch).mockReturnValue(mockDispatch);
        jest.mocked(storeSelectors.useSelectedNetwork).mockReturnValue(DEFAULT_CHAIN);
    });

    afterEach(() => {
        unmountLast?.();
        unmountLast = undefined;
    });

    function renderGasOptions(stateOverrides = {}) {
        const initialState = buildHomeReduxState(_.merge({}, stateOverrides));
        const store = configureStore({
            reducer: (state = initialState) => state,
            middleware: getDefaultMiddleware =>
                getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
        });
        const view = render(
            <Provider store={store}>
                <GasOptions />
            </Provider>,
        );
        unmountLast = () => view.unmount();
        return view;
    }

    it('renders title, network badge, gas content, and help link', () => {
        renderGasOptions();

        expect(screen.getByRole('heading', { name: 'Network Fee Options' })).toBeInTheDocument();
        expect(screen.getAllByText(DEFAULT_CHAIN.short_name).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByTestId('gas-option-content')).toHaveTextContent(DEFAULT_CHAIN.short_name);
        expect(screen.getByRole('button', { name: 'How Should I Choose?' })).toBeInTheDocument();
    });

    it('dispatches loadGasOptions for the selected chain on mount', async () => {
        renderGasOptions();

        await waitFor(() =>
            expect(loadGasOptions).toHaveBeenCalledWith(DEFAULT_CHAIN.chain_key),
        );
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('dispatches loadGasOptions again on the refresh interval and clears it on unmount', async () => {
        jest.useFakeTimers({ advanceTimers: true });
        try {
            const view = renderGasOptions();

            await waitFor(() =>
                expect(loadGasOptions).toHaveBeenCalledWith(DEFAULT_CHAIN.chain_key),
            );
            const callsAfterMount = jest.mocked(loadGasOptions).mock.calls.length;

            jest.advanceTimersByTime(60_000);

            await waitFor(() =>
                expect(jest.mocked(loadGasOptions).mock.calls.length).toBeGreaterThan(
                    callsAfterMount,
                ),
            );

            expect(loadGasOptions).toHaveBeenCalledWith(DEFAULT_CHAIN.chain_key);

            jest.mocked(loadGasOptions).mockClear();

            view.unmount();
            unmountLast = undefined;

            jest.advanceTimersByTime(60_000);
            expect(loadGasOptions).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    it('opens NetworkMenu when the network badge is clicked and closes from the menu', async () => {
        renderGasOptions();

        expect(screen.queryByTestId('network-menu')).not.toBeInTheDocument();

        await userEvent.click(screen.getByAltText('icon').closest('div'));

        expect(screen.getByTestId('network-menu')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('network-menu-close'));

        expect(screen.queryByTestId('network-menu')).not.toBeInTheDocument();
    });

    it('updates selected network and reloads gas options when NetworkMenu applies a change', async () => {
        renderGasOptions();

        await waitFor(() =>
            expect(loadGasOptions).toHaveBeenCalledWith(DEFAULT_CHAIN.chain_key),
        );
        jest.mocked(loadGasOptions).mockClear();

        await userEvent.click(screen.getByAltText('icon').closest('div'));
        await userEvent.click(screen.getByTestId('network-menu-select-sepolia'));

        await waitFor(() =>
            expect(loadGasOptions).toHaveBeenCalledWith(CHAIN_SEPOLIA.chain_key),
        );
        expect(screen.getByTestId('gas-option-content')).toHaveTextContent(
            CHAIN_SEPOLIA.short_name,
        );
        expect(screen.getAllByText(CHAIN_SEPOLIA.short_name).length).toBeGreaterThanOrEqual(1);
    });

    it('uses testnet styling on the network badge when the global network is a testnet', () => {
        jest.mocked(storeSelectors.useSelectedNetwork).mockReturnValue(CHAIN_SEPOLIA);

        renderGasOptions();

        const badge = screen.getByAltText('icon').closest('div');
        expect(badge).toHaveClass('bg-yellow-600');
    });

    it('shows gas tier copy in the help modal and closes via Close or Modal onClose', async () => {
        renderGasOptions();

        await userEvent.click(screen.getByRole('button', { name: 'How Should I Choose?' }));

        expect(screen.getByTestId('how-should-modal')).toBeInTheDocument();
        expect(
            screen.getByText(/time sensitive transactions \(like Swaps\)/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/A medium gas fee is good for sending/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/A lower gas fee should only be used when processing time is less important/),
        ).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('modal-dismiss'));

        expect(screen.queryByTestId('how-should-modal')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'How Should I Choose?' }));
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(screen.queryByTestId('how-should-modal')).not.toBeInTheDocument();
    });
});
