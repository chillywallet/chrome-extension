import { createMemoryHistory } from 'history';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';

import Develop from '../../../src/ui/pages/Develop';
import { DEFAULT_ROUTE } from '../../../src/shared/constants/routes';
import { setApiKey, setChainDataProvider } from '../../../src/store/actions/uiActions';
import { usePreferences } from '../../../src/store/selectors';

import Toast from '../../../src/ui/components/Toast';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    usePreferences: jest.fn(),
}));

jest.mock('../../../src/store/actions/uiActions', () => {
    const actual = jest.requireActual('../../../src/store/actions/uiActions');
    return {
        ...actual,
        setPreferences: jest.fn(() => async () => {}),
        setApiKey: jest.fn(() => async () => {}),
        setChainDataProvider: jest.fn(() => async () => {}),
    };
});

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: {
        showSuccess: jest.fn(),
        showError: jest.fn(),
    },
}));

function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>(res => {
        resolve = res;
    });
    return { promise, resolve };
}

function setup() {
    const history = createMemoryHistory({ initialEntries: ['/develop'] });
    const replaceSpy = jest.spyOn(history, 'replace');
    const view = render(
        <Router history={history}>
            <Develop />
        </Router>,
    );
    return { ...view, history, replaceSpy };
}

/** The etherscan key field is the first password input on the page. */
const etherscanInput = () =>
    document.querySelectorAll('input[type="password"]')[0] as HTMLInputElement;

describe('Develop', () => {
    const originalBuildType = process.env.BUILD_TYPE;
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.BUILD_TYPE = originalBuildType;
        process.env.NODE_ENV = originalNodeEnv;

        jest.mocked(usePreferences).mockReturnValue({
            apiKeys: {},
            customNetworks: [],
        } as unknown as ReturnType<typeof usePreferences>);

        mockDispatch.mockImplementation((action: unknown) => {
            if (typeof action === 'function') {
                return (action as (d: typeof mockDispatch, g: () => unknown) => unknown)(
                    mockDispatch,
                    () => ({}),
                );
            }
            return action;
        });
    });

    afterAll(() => {
        process.env.BUILD_TYPE = originalBuildType;
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('renders developer settings header and sections', () => {
        setup();
        expect(screen.getByText('Developer Settings')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Data Provider API Keys' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Data Provider per Network' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Build Information' })).toBeInTheDocument();
    });

    it('offers a key field per configured provider, seeded from preferences', () => {
        jest.mocked(usePreferences).mockReturnValue({
            apiKeys: { etherscan: 'seeded-key' },
            customNetworks: [],
        } as unknown as ReturnType<typeof usePreferences>);

        setup();

        expect(etherscanInput()).toHaveValue('seeded-key');
        // Keys are masked, never plain text.
        expect(etherscanInput().type).toBe('password');
    });

    it('persists only the keys that actually changed', async () => {
        jest.mocked(usePreferences).mockReturnValue({
            apiKeys: { etherscan: 'unchanged' },
            customNetworks: [],
        } as unknown as ReturnType<typeof usePreferences>);

        const { replaceSpy } = setup();

        await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

        await waitFor(() => {
            expect(Toast.showSuccess).toHaveBeenCalledWith('Settings saved successfully');
            expect(replaceSpy).toHaveBeenCalledWith(DEFAULT_ROUTE);
        });
        expect(setApiKey).not.toHaveBeenCalled();
    });

    it('saves an edited key through setApiKey', async () => {
        setup();

        fireEvent.change(etherscanInput(), { target: { value: 'new-key' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

        await waitFor(() => {
            expect(setApiKey).toHaveBeenCalledWith('etherscan', 'new-key');
            expect(Toast.showSuccess).toHaveBeenCalledWith('Settings saved successfully');
        });
    });

    it('shows an error toast when persisting a key fails', async () => {
        jest.mocked(setApiKey).mockImplementation((() => async () => {
            throw new Error('persist failed');
        }) as unknown as typeof setApiKey);

        setup();

        fireEvent.change(etherscanInput(), { target: { value: 'boom' } });
        await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

        await waitFor(() => {
            expect(Toast.showError).toHaveBeenCalledWith('Failed to save settings');
            expect(screen.getByRole('button', { name: 'Save Settings' })).not.toBeDisabled();
        });
        expect(Toast.showSuccess).not.toHaveBeenCalled();
    });

    it('ignores a second save while the first save is still pending', async () => {
        const deferred = createDeferred<void>();
        jest.mocked(setApiKey).mockImplementation((() => async () => {
            await deferred.promise;
        }) as unknown as typeof setApiKey);

        setup();
        fireEvent.change(etherscanInput(), { target: { value: 'slow' } });

        const saveBtn = screen.getByRole('button', { name: 'Save Settings' });
        await act(async () => {
            fireEvent.click(saveBtn);
            fireEvent.click(saveBtn);
        });

        expect(setApiKey).toHaveBeenCalledTimes(1);

        deferred.resolve();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
        });
    });

    it('renders a provider picker for every chain', () => {
        setup();
        // Ethereum is the default chain and must always be listed.
        expect(screen.getByText('Ethereum Mainnet')).toBeInTheDocument();
        expect(screen.getByText('Monad')).toBeInTheDocument();
    });

    it('clears the override when the committed default is chosen again', async () => {
        jest.mocked(usePreferences).mockReturnValue({
            apiKeys: {},
            customNetworks: [
                {
                    chain_id: 143,
                    dataProvider: {
                        kind: 'blockvision',
                        baseUrl: 'https://api.blockvision.org/v2/monad',
                        apiKeyRef: 'blockvision',
                    },
                },
            ],
        } as unknown as ReturnType<typeof usePreferences>);

        setup();

        // Scope to Monad's own row: every chain renders a picker, and a collapsed
        // picker also shows a "Default" badge, so page-wide queries are ambiguous.
        const monadRow = screen.getByText('Monad').parentElement as HTMLElement;
        const picker = within(monadRow).getAllByRole('button')[0];
        await userEvent.click(picker);

        // Options render inline (usePortal={false}); pick the committed default.
        const option = within(monadRow)
            .getAllByRole('button')
            .find(b => /Default/.test(b.textContent ?? '') && b !== picker) as HTMLElement;
        await userEvent.click(option);

        await waitFor(() => {
            expect(setChainDataProvider).toHaveBeenCalledWith(143, null);
        });
    });

    it('displays BUILD_TYPE from env with NODE_ENV', () => {
        process.env.BUILD_TYPE = 'canary-build';
        setup();
        expect(screen.getByText('canary-build')).toBeInTheDocument();
    });

    it('shows Unknown for build type when BUILD_TYPE is unset', () => {
        delete process.env.BUILD_TYPE;
        setup();
        expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    });
});
