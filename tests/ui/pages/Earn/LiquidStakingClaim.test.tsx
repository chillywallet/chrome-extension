import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import {
    EARN_LIQUID_STAKING_ROUTE,
    EARN_LIST_ROUTE,
} from '../../../../src/shared/constants/routes';
import logger from '../../../../src/shared/utils/logger';
import { getClaimRequests } from '../../../../src/store/actions/uiActions';
import { useCurrentAddress, useSelectedNetwork } from '../../../../src/store/selectors';
import { useEarnData } from '../../../../src/ui/pages/Earn/EarnProvider';
import LiquidStakingClaim from '../../../../src/ui/pages/Earn/LiquidStakingClaim';

import { PlatformId } from '../../../../src/shared/types/Chain';
import { mockEarnItem } from './fixtures/earnFixtures';

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

jest.mock('../../../../src/ui/components/ClaimCard', () => {
    const React = require('react');
    return {
        ClaimCard: ({
            data,
            onClaimPress,
            onCancelPress,
        }: {
            data: any;
            onClaimPress: (d: any) => void;
            onCancelPress: (d: any) => void;
        }) => (
            React.createElement(
                'div',
                { 'data-testid': 'claim-card' },
                React.createElement('span', null, `card-${data.id}`),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        'data-testid': `claim-${data.id}`,
                        onClick: () => onClaimPress(data),
                    },
                    'claim',
                ),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        'data-testid': `cancel-${data.id}`,
                        onClick: () => onCancelPress(data),
                    },
                    'cancel',
                ),
            )
        ),
        ClaimCardPlaceholder: () => React.createElement('div', { 'data-testid': 'claim-placeholder' }),
    };
});

jest.mock('../../../../src/ui/components/ClaimConfirmRequestSheet', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({
            visible,
            onCloseRequest,
            onClaimSuccess,
        }: {
            visible: boolean;
            onCloseRequest: () => void;
            onClaimSuccess: (tx: any) => void;
        }) =>
            visible
                ? React.createElement(
                      'div',
                      { 'data-testid': 'claim-sheet' },
                      React.createElement(
                          'button',
                          {
                              type: 'button',
                              'data-testid': 'sheet-confirm',
                              onClick: () => onClaimSuccess({ id: 'tx-1' }),
                          },
                          'confirm',
                      ),
                      React.createElement(
                          'button',
                          {
                              type: 'button',
                              'data-testid': 'sheet-close',
                              onClick: onCloseRequest,
                          },
                          'close',
                      ),
                  )
                : null,
    };
});

jest.mock('../../../../src/ui/components/CancelClaimRequestSheet', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({
            visible,
            onCloseRequest,
            onCancelSuccess,
        }: {
            visible: boolean;
            onCloseRequest: () => void;
            onCancelSuccess: (tx: any) => void;
        }) =>
            visible
                ? React.createElement(
                      'div',
                      { 'data-testid': 'cancel-sheet' },
                      React.createElement(
                          'button',
                          {
                              type: 'button',
                              'data-testid': 'cancel-sheet-confirm',
                              onClick: () => onCancelSuccess({ id: 'tx-2' }),
                          },
                          'cancel-confirm',
                      ),
                      React.createElement(
                          'button',
                          {
                              type: 'button',
                              'data-testid': 'cancel-sheet-close',
                              onClick: onCloseRequest,
                          },
                          'cancel-close',
                      ),
                  )
                : null,
    };
});

jest.mock('../../../../src/ui/components/SwapSentModal', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({
            visible,
            onCloseRequest,
            onSwapSuccess,
        }: {
            visible: boolean;
            onCloseRequest: () => void;
            onSwapSuccess: (trackData: any, cancelled: boolean) => void;
        }) =>
            visible
                ? React.createElement(
                      'div',
                      { 'data-testid': 'swap-sent' },
                      React.createElement(
                          'button',
                          {
                              type: 'button',
                              'data-testid': 'swap-sent-close',
                              onClick: onCloseRequest,
                          },
                          'close',
                      ),
                      React.createElement(
                          'button',
                          {
                              type: 'button',
                              'data-testid': 'swap-sent-success',
                              onClick: () => onSwapSuccess({}, false),
                          },
                          'success',
                      ),
                      React.createElement(
                          'button',
                          {
                              type: 'button',
                              'data-testid': 'swap-sent-cancel',
                              onClick: () => onSwapSuccess({}, true),
                          },
                          'cancel-success',
                      ),
                  )
                : null,
    };
});

jest.mock('../../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn() },
}));

jest.mock('../../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../../src/store/selectors'),
    useCurrentAddress: jest.fn(),
    useSelectedNetwork: jest.fn(),
}));

jest.mock('../../../../src/store/actions/uiActions', () => ({
    getClaimRequests: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        log: jest.fn(),
    },
}));

jest.mock('../../../../src/ui/pages/Earn/EarnProvider', () => ({
    ...jest.requireActual('../../../../src/ui/pages/Earn/EarnProvider'),
    useEarnData: jest.fn(),
}));

describe('LiquidStakingClaim', () => {
    const replace = jest.fn();
    let intervalSpy: jest.SpyInstance;
    let clearIntervalSpy: jest.SpyInstance;

    beforeEach(() => {
        intervalSpy = jest
            .spyOn(global, 'setInterval')
            .mockReturnValue(999 as unknown as ReturnType<typeof setInterval>);
        clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
        jest.mocked(useEarnData).mockReturnValue({
            liquidStakingData: undefined,
            setLiquidStakingData: jest.fn(),
            liquidStakingClaimData: {
                data: mockEarnItem,
                waitTime: 120,
            },
            setLiquidStakingClaimData: jest.fn(),
            yieldData: undefined,
            setYieldData: jest.fn(),
        });
        jest.mocked(useCurrentAddress).mockReturnValue(
            '0x1111111111111111111111111111111111111111',
        );
        jest.mocked(useSelectedNetwork).mockReturnValue({
            chain_id: 1,
            platform_id: PlatformId.MonadTestnet,
        } as never);
        jest.mocked(getClaimRequests).mockResolvedValue([]);
        replace.mockClear();
        jest.mocked(logger.error).mockClear();
    });

    afterEach(() => {
        intervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });

    function setup() {
        const history = createMemoryHistory({ initialEntries: ['/earn/claim'] });
        jest.spyOn(history, 'replace').mockImplementation(replace);
        return render(
            <Router history={history}>
                <LiquidStakingClaim />
            </Router>,
        );
    }

    it('redirects to earn list when claim context missing', () => {
        jest.mocked(useEarnData).mockReturnValue({
            liquidStakingData: undefined,
            setLiquidStakingData: jest.fn(),
            liquidStakingClaimData: undefined,
            setLiquidStakingClaimData: jest.fn(),
            yieldData: undefined,
            setYieldData: jest.fn(),
        });
        setup();
        expect(replace).toHaveBeenCalledWith(EARN_LIST_ROUTE);
    });

    it('shows empty copy after loading when no requests', async () => {
        setup();

        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });

        expect(screen.getByText(/no MON to unstake/i)).toBeInTheDocument();
    });

    it('navigates back to liquid staking route', async () => {
        setup();
        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });

        await userEvent.click(screen.getByTestId('header-back'));
        expect(replace).toHaveBeenCalledWith(EARN_LIQUID_STAKING_ROUTE);
    });

    it('refresh triggers another fetch', async () => {
        setup();

        await waitFor(() => {
            expect(getClaimRequests).toHaveBeenCalled();
        });

        const firstCalls = jest.mocked(getClaimRequests).mock.calls.length;
        await userEvent.click(screen.getAllByRole('button')[1]);
        await waitFor(() => {
            expect(jest.mocked(getClaimRequests).mock.calls.length).toBeGreaterThan(firstCalls);
        });
    });

    it('logs when getClaimRequests fails', async () => {
        jest.mocked(getClaimRequests).mockRejectedValueOnce(new Error('network'));
        setup();

        await waitFor(() => {
            expect(logger.error).toHaveBeenCalledWith('getClaimRequests', expect.any(Error));
        });
    });

    it('merges claimable requests into one card and lists non-claimable ones', async () => {
        jest.mocked(getClaimRequests).mockResolvedValue([
            // Two claimable items that should be merged because requestsMerged=true.
            {
                id: '10',
                shares: '1000000000000000000',
                is_claimable: true,
                claimed: false,
                cancellable: false,
            },
            {
                id: '11',
                shares: '2000000000000000000',
                is_claimable: true,
                claimed: false,
                cancellable: false,
            },
            // Non-claimable should be kept as-is.
            {
                id: '12',
                shares: '500000000000000000',
                is_claimable: false,
                claimed: false,
                cancellable: true,
            },
            // Claimed should be filtered out entirely.
            {
                id: '13',
                shares: '999',
                is_claimable: true,
                claimed: true,
                cancellable: false,
            },
        ] as never);

        setup();

        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });

        // Two cards: 1 merged (using id=10) + 1 non-claimable (id=12)
        const cards = screen.getAllByTestId('claim-card');
        expect(cards).toHaveLength(2);
        // Filtered-out claimed=true card should not appear.
        expect(screen.queryByText('card-13')).not.toBeInTheDocument();
    });

    it('clicking a card opens the claim confirm sheet and processes a sent transaction', async () => {
        jest.mocked(getClaimRequests).mockResolvedValue([
            {
                id: '20',
                shares: '1',
                is_claimable: true,
                claimed: false,
                cancellable: false,
            },
        ] as never);

        setup();

        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });

        await userEvent.click(screen.getByTestId('claim-20'));
        expect(screen.getByTestId('claim-sheet')).toBeInTheDocument();

        // Confirming the claim opens the SwapSentModal with the tx data.
        await userEvent.click(screen.getByTestId('sheet-confirm'));
        expect(screen.getByTestId('swap-sent')).toBeInTheDocument();

        // Closing the swap sent modal refreshes data.
        const callsBeforeClose = jest.mocked(getClaimRequests).mock.calls.length;
        await userEvent.click(screen.getByTestId('swap-sent-close'));
        await waitFor(() => {
            expect(screen.queryByTestId('swap-sent')).not.toBeInTheDocument();
        });
        await waitFor(() => {
            expect(jest.mocked(getClaimRequests).mock.calls.length).toBeGreaterThan(
                callsBeforeClose,
            );
        });
    });

    it('clicking cancel on a card opens the cancel sheet and toasting after success', async () => {
        const Toast = jest.requireMock('../../../../src/ui/components/Toast').default;
        jest.mocked(getClaimRequests).mockResolvedValue([
            {
                id: '30',
                shares: '1',
                is_claimable: false,
                claimed: false,
                cancellable: true,
            },
        ] as never);

        setup();

        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });

        await userEvent.click(screen.getByTestId('cancel-30'));
        expect(screen.getByTestId('cancel-sheet')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('cancel-sheet-confirm'));
        expect(screen.getByTestId('swap-sent')).toBeInTheDocument();

        // Cancelled success path => "Claim Cancelled" toast.
        await userEvent.click(screen.getByTestId('swap-sent-cancel'));
        expect(Toast.showSuccess).toHaveBeenCalledWith('Claim Cancelled');
    });

    it('non-cancel success path on the swap modal shows the success toast', async () => {
        const Toast = jest.requireMock('../../../../src/ui/components/Toast').default;
        jest.mocked(getClaimRequests).mockResolvedValue([
            {
                id: '40',
                shares: '1',
                is_claimable: true,
                claimed: false,
                cancellable: false,
            },
        ] as never);

        setup();
        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });
        await userEvent.click(screen.getByTestId('claim-40'));
        await userEvent.click(screen.getByTestId('sheet-confirm'));
        await userEvent.click(screen.getByTestId('swap-sent-success'));
        expect(Toast.showSuccess).toHaveBeenCalledWith('Claim Succeeded');
    });

    it('closes the claim confirm sheet via its close button', async () => {
        jest.mocked(getClaimRequests).mockResolvedValue([
            {
                id: '50',
                shares: '1',
                is_claimable: true,
                claimed: false,
                cancellable: false,
            },
        ] as never);

        setup();
        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });
        await userEvent.click(screen.getByTestId('claim-50'));
        expect(screen.getByTestId('claim-sheet')).toBeInTheDocument();
        await userEvent.click(screen.getByTestId('sheet-close'));
        await waitFor(() => {
            expect(screen.queryByTestId('claim-sheet')).not.toBeInTheDocument();
        });
    });

    it('closes the cancel claim sheet via its close button', async () => {
        jest.mocked(getClaimRequests).mockResolvedValue([
            {
                id: '60',
                shares: '1',
                is_claimable: false,
                claimed: false,
                cancellable: true,
            },
        ] as never);

        setup();
        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });
        await userEvent.click(screen.getByTestId('cancel-60'));
        expect(screen.getByTestId('cancel-sheet')).toBeInTheDocument();
        await userEvent.click(screen.getByTestId('cancel-sheet-close'));
        await waitFor(() => {
            expect(screen.queryByTestId('cancel-sheet')).not.toBeInTheDocument();
        });
    });

    it('falls back to empty address when useCurrentAddress returns null', async () => {
        jest.mocked(useCurrentAddress).mockReturnValue(null as never);
        setup();
        await waitFor(() => {
            expect(getClaimRequests).toHaveBeenCalledWith(mockEarnItem.type, '');
        });
    });

    it('renders without waitTime when liquidStakingClaimData omits it', async () => {
        jest.mocked(useEarnData).mockReturnValue({
            liquidStakingData: undefined,
            setLiquidStakingData: jest.fn(),
            liquidStakingClaimData: {
                data: mockEarnItem,
                // intentionally undefined waitTime to exercise `?? 0` fallback
                waitTime: undefined as never,
            },
            setLiquidStakingClaimData: jest.fn(),
            yieldData: undefined,
            setYieldData: jest.fn(),
        });
        jest.mocked(getClaimRequests).mockResolvedValue([
            {
                id: '70',
                shares: '1',
                is_claimable: true,
                claimed: false,
                cancellable: false,
            },
        ] as never);
        setup();
        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });
        expect(screen.getByTestId('claim-card')).toBeInTheDocument();
    });

    it('skips merging when the earn item disables requestsMerged', async () => {
        jest.mocked(useEarnData).mockReturnValue({
            liquidStakingData: undefined,
            setLiquidStakingData: jest.fn(),
            liquidStakingClaimData: {
                data: { ...mockEarnItem, requestsMerged: false },
                waitTime: 0,
            },
            setLiquidStakingClaimData: jest.fn(),
            yieldData: undefined,
            setYieldData: jest.fn(),
        });
        jest.mocked(getClaimRequests).mockResolvedValue([
            {
                id: '100',
                shares: '1',
                is_claimable: true,
                claimed: false,
                cancellable: false,
            },
            {
                id: '101',
                shares: '2',
                is_claimable: true,
                claimed: false,
                cancellable: false,
            },
        ] as never);

        setup();

        await waitFor(() => {
            expect(screen.queryAllByTestId('claim-placeholder')).toHaveLength(0);
        });
        // No merge → both claimable cards are listed separately.
        expect(screen.getAllByTestId('claim-card')).toHaveLength(2);
    });
});
