import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';

import * as uiActions from '../../../src/store/actions/uiActions';
import Unlock from '../../../src/ui/pages/Unlock';

jest.mock('../../../src/store/actions/uiActions', () => ({
    unlockApp: jest.fn(),
}));

const mockUnlockApp = jest.mocked(uiActions.unlockApp);

function makeStore() {
    return configureStore({
        reducer: (state = {}) => state,
        middleware: getDefaultMiddleware =>
            getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
    });
}

describe('Unlock', () => {
    const originalBuildType = process.env.BUILD_TYPE;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUnlockApp.mockImplementation((_password, cb) => {
            return (async () => {
                cb(false);
            }) as ReturnType<(typeof uiActions)['unlockApp']>;
        });
    });

    afterEach(() => {
        process.env.BUILD_TYPE = originalBuildType;
    });

    function renderUnlock(props: Partial<React.ComponentProps<typeof Unlock>> = {}) {
        const onUnlockSuccess = props.onUnlockSuccess ?? jest.fn();
        const onForgotPinCode = props.onForgotPinCode ?? jest.fn();
        const store = makeStore();
        render(
            <Provider store={store}>
                <Unlock onUnlockSuccess={onUnlockSuccess} onForgotPinCode={onForgotPinCode} />
            </Provider>,
        );
        return { onUnlockSuccess, onForgotPinCode, store };
    }

    function pinInput(): HTMLInputElement {
        const input = screen.getByPlaceholderText('Your Pin Code');
        if (!(input instanceof HTMLInputElement)) {
            throw new Error('expected pin input');
        }
        return input;
    }

    it('shows validation when Unlock is pressed with an empty Pin Code', async () => {
        process.env.BUILD_TYPE = 'Prod';
        renderUnlock();

        await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

        expect(screen.getByText('Pin Code is required.')).toBeInTheDocument();
        expect(mockUnlockApp).not.toHaveBeenCalled();
    });

    it('dispatches unlockApp with the Pin Code when Unlock succeeds', async () => {
        process.env.BUILD_TYPE = 'Prod';
        const { onUnlockSuccess } = renderUnlock();

        await userEvent.type(pinInput(), 'secret12');
        await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

        await waitFor(() => {
            expect(mockUnlockApp).toHaveBeenCalledWith('secret12', expect.any(Function));
        });
        await waitFor(() => expect(onUnlockSuccess).toHaveBeenCalledWith('secret12'));
        expect(screen.queryByText('Pin Code is required.')).not.toBeInTheDocument();
    });

    it('maps Incorrect password background error to Incorrect Pin Code', async () => {
        process.env.BUILD_TYPE = 'Prod';
        mockUnlockApp.mockImplementationOnce((_password, cb) => {
            return (async () => {
                cb(true, 'Incorrect password');
            }) as ReturnType<(typeof uiActions)['unlockApp']>;
        });

        renderUnlock();

        await userEvent.type(pinInput(), 'wrong');
        await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

        await waitFor(() => {
            expect(screen.getByText('Incorrect Pin Code')).toBeInTheDocument();
        });
    });

    it('shows other backend error messages verbatim', async () => {
        process.env.BUILD_TYPE = 'Prod';
        mockUnlockApp.mockImplementationOnce((_password, cb) => {
            return (async () => {
                cb(true, 'Something broke');
            }) as ReturnType<(typeof uiActions)['unlockApp']>;
        });

        renderUnlock();
        await userEvent.type(pinInput(), 'wrong');
        await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

        await screen.findByText('Something broke');
    });

    it('shows Unknown Error when the callback has no message', async () => {
        process.env.BUILD_TYPE = 'Prod';
        mockUnlockApp.mockImplementationOnce((_password, cb) => {
            return (async () => {
                cb(true, undefined);
            }) as ReturnType<(typeof uiActions)['unlockApp']>;
        });

        renderUnlock();
        await userEvent.type(pinInput(), 'wrong');
        await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

        await screen.findByText('Unknown Error');
    });

    it('calls onForgotPinCode from Forgot Pin Code?', async () => {
        process.env.BUILD_TYPE = 'Prod';
        const { onForgotPinCode } = renderUnlock();

        await userEvent.click(screen.getByRole('button', { name: 'Forgot Pin Code?' }));

        expect(onForgotPinCode).toHaveBeenCalled();
        expect(mockUnlockApp).not.toHaveBeenCalled();
    });

    it('submits when Enter is pressed in the Pin Code field', async () => {
        process.env.BUILD_TYPE = 'Prod';
        const { onUnlockSuccess } = renderUnlock();

        await userEvent.type(pinInput(), 'mypin555{Enter}');

        await waitFor(() => {
            expect(mockUnlockApp).toHaveBeenCalledWith('mypin555', expect.any(Function));
        });
        await waitFor(() => expect(onUnlockSuccess).toHaveBeenCalledWith('mypin555'));
    });

    it('pre-fills the Pin Code in Debug builds', () => {
        process.env.BUILD_TYPE = 'Debug';
        mockUnlockApp.mockImplementationOnce((_password, cb) => {
            return (async () => {
                cb(false);
            }) as ReturnType<(typeof uiActions)['unlockApp']>;
        });

        renderUnlock();

        expect(pinInput().value).toBe('11111111');
    });
});
