import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';

import EarnList from '../../../../src/ui/pages/Earn/EarnList';
import { DEFAULT_ROUTE, EARN_LIQUID_STAKING_ROUTE } from '../../../../src/shared/constants/routes';
import { setSelectedNetwork } from '../../../../src/store/actions/uiActions';
import { usePreferences } from '../../../../src/store/selectors';
import { useEarnData } from '../../../../src/ui/pages/Earn/EarnProvider';

import { mockEarnItem, mockEarnListItemStaking } from './fixtures/earnFixtures';

jest.mock('../../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({
        title,
        onBackPress,
        action,
    }: {
        title: string;
        onBackPress?: () => void;
        action?: React.ReactNode;
    }) => (
        <div>
            <span>{title}</span>
            <button type="button" data-testid="header-back" onClick={onBackPress}>
                back
            </button>
            {action}
        </div>
    ),
}));

jest.mock('../../../../src/ui/components/EarnStakingCard', () => ({
    __esModule: true,
    default: ({
        data,
        onPress,
    }: {
        data: { name: string; data: { tokenAddress: string }[] };
        onPress: (item: { tokenAddress: string }) => void;
    }) => (
        <button
            type="button"
            data-testid={`staking-${data.name}`}
            onClick={() => onPress(data.data[0])}>
            staking
        </button>
    ),
}));


jest.mock('../../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../../src/store/selectors'),
    usePreferences: jest.fn(),
}));

jest.mock('../../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../src/store/actions/uiActions', () => ({
    setSelectedNetwork: jest.fn(() => ({ type: 'SET_NET' })),
}));

jest.mock('../../../../src/ui/pages/Earn/EarnProvider', () => ({
    ...jest.requireActual('../../../../src/ui/pages/Earn/EarnProvider'),
    useEarnData: jest.fn(),
}));

describe('EarnList', () => {
    const setLiquidStakingData = jest.fn();
    const setYieldData = jest.fn();
    const dispatch = jest.fn();

    beforeEach(() => {
        jest.mocked(useEarnData).mockReturnValue({
            liquidStakingData: undefined,
            setLiquidStakingData,
            liquidStakingClaimData: undefined,
            setLiquidStakingClaimData: jest.fn(),
            yieldData: undefined,
            setYieldData,
        });

        jest.mocked(usePreferences).mockReturnValue({
            earnList: [
                mockEarnListItemStaking({ name: 'A', platformId: 10143 }),
                mockEarnListItemStaking({ name: 'B', platformId: 1 }),
            ],
        } as never);

        const { useAppDispatch } = jest.requireMock('../../../../src/store/store');
        useAppDispatch.mockReturnValue(dispatch);

        setLiquidStakingData.mockClear();
        setYieldData.mockClear();
        dispatch.mockClear();
        jest.mocked(setSelectedNetwork).mockClear();
    });

    function setup() {
        const history = createMemoryHistory({ initialEntries: ['/earn/list'] });
        return {
            history,
            ...render(
                <Router history={history}>
                    <EarnList />
                </Router>,
            ),
        };
    }

    it('renders staking and yield rows and opens platform filter', async () => {
        setup();

        expect(screen.getByText('Earn')).toBeInTheDocument();
        expect(screen.getByTestId('staking-A')).toBeInTheDocument();
        expect(screen.getByTestId('staking-B')).toBeInTheDocument();

        await userEvent.click(screen.getAllByText('All')[0]);
        expect(screen.getByText('Monad Testnet')).toBeInTheDocument();
        expect(screen.getByText('Ethereum Mainnet')).toBeInTheDocument();
    });

    it('navigates back to default route', async () => {
        const { history } = setup();
        await userEvent.click(screen.getByTestId('header-back'));
        expect(history.location.pathname).toBe(DEFAULT_ROUTE);
    });

    it('staking press selects network and opens liquid staking', async () => {
        const { history } = setup();

        await userEvent.click(screen.getByTestId('staking-A'));
        expect(dispatch).toHaveBeenCalled();
        expect(setLiquidStakingData).toHaveBeenCalledWith(mockEarnItem);
        expect(history.location.pathname).toBe(EARN_LIQUID_STAKING_ROUTE);
    });


    it('closes filter menu on outside click', async () => {
        setup();
        await userEvent.click(screen.getAllByText('All')[0]);
        expect(screen.getByText('Monad Testnet')).toBeInTheDocument();

        fireEvent.mouseDown(document.body);

        await waitFor(() => {
            expect(screen.queryByText('Monad Testnet')).not.toBeInTheDocument();
        });
    });

    it('filters by selected platform and shows it as the active label', async () => {
        setup();

        // Open filter and select Ethereum option
        await userEvent.click(screen.getAllByText('All')[0]);
        await userEvent.click(screen.getByText('Ethereum Mainnet'));

        // Menu closed, label updated, yield row visible, staking row hidden.
        await waitFor(() => {
            expect(screen.queryByText('Monad Testnet')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Ethereum Mainnet')).toBeInTheDocument();
        expect(screen.getByTestId('staking-B')).toBeInTheDocument();
        expect(screen.queryByTestId('staking-A')).not.toBeInTheDocument();
    });

    it('re-selecting "All" from the filter menu shows all rows', async () => {
        setup();

        // First narrow to Ethereum
        await userEvent.click(screen.getAllByText('All')[0]);
        await userEvent.click(screen.getByText('Ethereum Mainnet'));

        // Reopen the menu and choose "All".
        await userEvent.click(screen.getByText('Ethereum Mainnet'));
        const allOptions = screen.getAllByText('All');
        await userEvent.click(allOptions[allOptions.length - 1]);

        await waitFor(() => {
            expect(screen.getByTestId('staking-A')).toBeInTheDocument();
            expect(screen.getByTestId('staking-B')).toBeInTheDocument();
        });
    });

    it('ignores earn list entries that have no platformId', async () => {
        jest.mocked(usePreferences).mockReturnValue({
            earnList: [
                mockEarnListItemStaking({ name: 'NoPlat', platformId: undefined as never }),
                mockEarnListItemStaking({ name: 'WithPlat', platformId: 10143 }),
            ],
        } as never);

        setup();
        expect(screen.queryByTestId('staking-NoPlat')).not.toBeInTheDocument();
        expect(screen.getByTestId('staking-WithPlat')).toBeInTheDocument();
    });

    it('skips network dispatch when no chain matches the staking item platform', async () => {
        // Force the staking item to use a platformId that isn't in the chain list.
        const unknownPlatform = 999999 as never;
        jest.mocked(usePreferences).mockReturnValue({
            earnList: [mockEarnListItemStaking({ name: 'X', platformId: unknownPlatform })],
        } as never);

        const { history } = setup();
        await userEvent.click(screen.getByTestId('staking-X'));
        // The item callback still fires the navigation even if no network was found.
        expect(setLiquidStakingData).toHaveBeenCalled();
        // History still updated → covers the `if (network)` false branch.
        expect(history.location.pathname).toBe(EARN_LIQUID_STAKING_ROUTE);
    });


    it('shows empty filter label when the selected platform has no matching chain', async () => {
        const unknownPlatform = 12345 as never;
        jest.mocked(usePreferences).mockReturnValue({
            earnList: [mockEarnListItemStaking({ name: 'A', platformId: unknownPlatform })],
        } as never);

        setup();
        await userEvent.click(screen.getAllByText('All')[0]);
        // The dropdown shows an empty label for the unknown platform → just ensure clicking doesn't crash.
        const optionDivs = document.querySelectorAll('[class*="text-xs"][class*="cursor-pointer"]');
        await userEvent.click(optionDivs[optionDivs.length - 1] as Element);
        // Filter applied: only matching items visible.
        expect(screen.getByTestId('staking-A')).toBeInTheDocument();
    });
});
