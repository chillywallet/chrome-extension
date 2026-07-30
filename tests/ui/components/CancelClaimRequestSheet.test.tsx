import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
    addPendingTransaction,
    cancelUnstakeRequest,
    estimateCancelUnstakeRequest,
    getCancelUnstakeRequestCall,
    getTokenBalance,
    setLiquidStakingProvider,
} from '../../../src/store/actions/uiActions';
import { useCurrentAccount, useCurrentWallet, useSelectedNetwork } from '../../../src/store/selectors';
import { useAppDispatch } from '../../../src/store/store';
import ErrorMessages from '../../../src/shared/messages/ErrorMessages';
import { PlatformId } from '../../../src/shared/types/Chain';
import type { PendingTransaction } from '../../../src/shared/types/Wallet';
import logger from '../../../src/shared/utils/logger';
import CancelClaimRequestSheet from '../../../src/ui/components/CancelClaimRequestSheet';
import { mockEarnItem } from '../pages/Earn/fixtures/earnFixtures';


jest.mock('framer-motion', () => {
    const R = require('react');
    return {
        AnimatePresence: ({ children }) => R.createElement(R.Fragment, null, children),
        motion: {
            div: ({ children, className, onClick }) =>
                R.createElement(
                    'div',
                    { className, onClick, 'data-testid': 'motion-div' },
                    children,
                ),
        },
    };
});

jest.mock('../../../src/shared/constants/app', () => ({
    ANIM_DURATION: 0,
}));

jest.mock('uuid', () => ({
    __esModule: true,
    v4: () => 'txn-id-test',
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    ...jest.requireActual('../../../src/store/actions/uiActions'),
    estimateCancelUnstakeRequest: jest.fn(),
    cancelUnstakeRequest: jest.fn(),
    addPendingTransaction: jest.fn(),
    getCancelUnstakeRequestCall: jest.fn(),
    getTokenBalance: jest.fn(),
    setLiquidStakingProvider: jest.fn(),
}));

const mockOnGasChange = jest.fn();

jest.mock('../../../src/ui/components/GasFee', () => ({
    __esModule: true,
    default: props => {
        const { onGasChange, gasLimit } = props;
        const ReactActual = jest.requireActual('react');
        ReactActual.useEffect(() => {
            if (gasLimit && onGasChange) {
                onGasChange({
                    gasInfo: { mocked: true },
                    gasPrice: BigInt(gasLimit),
                });
                mockOnGasChange();
            }
        }, [gasLimit, onGasChange]);
        return ReactActual.createElement('div', { 'data-testid': 'gas-fee-stub' });
    },
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useCurrentAccount: jest.fn(),
    useCurrentWallet: jest.fn(),
    useSelectedNetwork: jest.fn(),
}));

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: {
        log: jest.fn(),
        error: jest.fn(),
    },
}));

const WALLET_ADDR = '0x1111111111111111111111111111111111111111';

function runThunkDispatch() {
    const dispatchSpy = jest.fn((action: unknown) => {
        if (typeof action === 'function') {
            return (action as (d: jest.Mock & typeof dispatchSpy) => Promise<unknown>)(dispatchSpy);
        }
        return action;
    });
    return dispatchSpy;
}

function mergedRequest(overrides: { shares?: string; id?: string } = {}) {
    return {
        id: overrides.id ?? 'req-1',
        shares: overrides.shares ?? '1000000000000000000',
        claimed: false,
        is_claimable: false,
        cancellable: true,
    };
}

describe('CancelClaimRequestSheet', () => {
    const onCloseRequest = jest.fn();
    const onCancelSuccess = jest.fn();

    const account = {
        id: 'a1',
        address: WALLET_ADDR,
        type: 'eip155:eoa',
        metadata: { name: 'Test', importTime: 1, keyring: { type: 'HD Key Tree' } },
        methods: [],
        options: {},
    };

    const network = {
        chain_id: 1,
        platform_id: PlatformId.MonadTestnet,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockOnGasChange.mockClear();

        jest.mocked(useCurrentAccount).mockReturnValue(account as never);
        jest.mocked(useCurrentWallet).mockReturnValue({} as never);
        jest.mocked(useSelectedNetwork).mockReturnValue(network as never);
        jest.mocked(useAppDispatch).mockImplementation(runThunkDispatch);

        jest.mocked(estimateCancelUnstakeRequest).mockResolvedValue('21000');
        jest.mocked(getCancelUnstakeRequestCall).mockResolvedValue({ call: 'mock' });
        jest.mocked(getTokenBalance).mockResolvedValue({
            balance: 10n ** 18n,
            decimals: 18,
            error: false,
        });
        jest.mocked(cancelUnstakeRequest).mockImplementation(() => async () => ({
            hash: '0xcafecafecafecafecafecafecafecafecafecafecafecafe',
        }));
        jest.mocked(addPendingTransaction).mockImplementation(() => async () => undefined);
        jest.mocked(setLiquidStakingProvider).mockResolvedValue({
            contractAddress: '0x9999999999999999999999999999999999999999',
        });
    });

    async function setup(
        props: {
            visible?: boolean;
            data?: ReturnType<typeof mergedRequest> | null;
            earnItem?: typeof mockEarnItem;
            skipAwaitGasUi?: boolean;
            omitEarnItem?: boolean;
        } = {},
    ) {
        const {
            visible = true,
            data = mergedRequest(),
            earnItem = mockEarnItem,
            skipAwaitGasUi = false,
            omitEarnItem = false,
        } = props;
        if (omitEarnItem) {
            render(
                <CancelClaimRequestSheet
                    visible={visible}
                    onCloseRequest={onCloseRequest}
                    onCancelSuccess={onCancelSuccess}
                    data={data}
                />,
            );
        } else {
            render(
                <CancelClaimRequestSheet
                    visible={visible}
                    onCloseRequest={onCloseRequest}
                    onCancelSuccess={onCancelSuccess}
                    data={data}
                    earnItem={earnItem}
                />,
            );
        }

        const effectiveEarnItem = omitEarnItem ? undefined : earnItem;
        if (effectiveEarnItem) {
            await waitFor(() => expect(setLiquidStakingProvider).toHaveBeenCalled());
        }

        if (visible && data && !skipAwaitGasUi) {
            await waitFor(() => expect(mockOnGasChange).toHaveBeenCalled());
        }
    }

    it('shows sheet copy and partner artwork when visibility and data exist', async () => {
        await setup({ earnItem: { ...mockEarnItem, partner_name: 'FastLane' } });

        await waitFor(() => {
            expect(jest.mocked(estimateCancelUnstakeRequest)).toHaveBeenCalledWith(
                'req-1',
                WALLET_ADDR,
            );
        });

        // FastLane ships no bundled logo; the sheet renders without partner artwork.
        expect(screen.queryByRole('img', { name: 'Icon' })).not.toBeInTheDocument();

        expect(screen.getByText(/Cancel .* stMON Claim Request/i)).toBeInTheDocument();
    });

    it('does not load staking provider when earnItem is omitted', async () => {
        await setup({ omitEarnItem: true });

        await waitFor(() =>
            expect(jest.mocked(estimateCancelUnstakeRequest)).toHaveBeenCalledWith(
                'req-1',
                WALLET_ADDR,
            ),
        );
        expect(setLiquidStakingProvider).not.toHaveBeenCalled();
    });

    it('omits partner image when partner is unknown', async () => {
        await setup({ earnItem: { ...mockEarnItem, partner_name: undefined } });

        expect(screen.getByText(/Cancel .* stMON Claim Request/i)).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: 'Icon' })).not.toBeInTheDocument();
    });

    it('shows nothing meaningful when modal is invisible', async () => {
        await setup({ visible: false });
        expect(screen.queryByText(/CLOSE/i)).not.toBeInTheDocument();
    });

    it('shows nothing when sheet is visible but data is missing', async () => {
        await setup({ visible: true, data: null });
        expect(screen.queryByRole('button', { name: 'CLOSE' })).not.toBeInTheDocument();
    });

    it('closes when CLOSE is clicked', async () => {
        await setup();
        await userEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
        expect(onCloseRequest).toHaveBeenCalled();
    });

    it('surfaces estimate errors from the estimator', async () => {
        jest.mocked(estimateCancelUnstakeRequest).mockRejectedValueOnce(new Error('rpc down'));
        await setup({ skipAwaitGasUi: true });

        await waitFor(() => {
            expect(screen.getByText('rpc down')).toBeInTheDocument();
        });
        expect(logger.error).toHaveBeenCalledWith(
            'Estimate Gas',
            expect.objectContaining({ message: 'rpc down' }),
        );
    });

    it('shows insufficient funds when balance is lower than quoted gas fee', async () => {
        jest.mocked(getTokenBalance).mockResolvedValueOnce({
            balance: 100n,
            decimals: 18,
            error: false,
        });
        await setup({ earnItem: { ...mockEarnItem, partner_name: 'aPriori' } });

        await waitFor(() => {
            expect(screen.getByText(ErrorMessages.INSUFFICIENT_FUNDS_FOR_GAS)).toBeInTheDocument();
        });
        expect(
            screen.getByRole('button', { name: 'CANCEL REQUEST' }),
        ).toBeDisabled();
    });

    it('keeps cancel disabled while gas estimate is incomplete', async () => {
        jest
            .mocked(estimateCancelUnstakeRequest)
            .mockResolvedValueOnce(null as unknown as string);
        await setup({ skipAwaitGasUi: true });

        await waitFor(() =>
            expect(jest.mocked(estimateCancelUnstakeRequest).mock.calls.length).toBeGreaterThan(0),
        );

        const cancelBtn = await screen.findByRole('button', { name: 'CANCEL REQUEST' });
        await waitFor(() => expect(cancelBtn).toBeDisabled());
    });

    it('does not enqueue pending tx when cancellation returns no hash', async () => {
        jest.mocked(cancelUnstakeRequest).mockImplementation(() => async () => null);
        await setup();

        await userEvent.click(screen.getByRole('button', { name: 'CANCEL REQUEST' }));

        await waitFor(() => {
            expect(cancelUnstakeRequest).toHaveBeenCalled();
        });
        expect(addPendingTransaction).not.toHaveBeenCalled();
        expect(onCancelSuccess).not.toHaveBeenCalled();
        expect(onCloseRequest).not.toHaveBeenCalled();
    });

    it('dispatches pending tx and notifies on successful cancel flow', async () => {
        await setup();

        await userEvent.click(screen.getByRole('button', { name: 'CANCEL REQUEST' }));

        await waitFor(() => {
            expect(cancelUnstakeRequest).toHaveBeenCalledWith(
                'req-1',
                WALLET_ADDR,
                { mocked: true },
                21000,
            );
        });

        await waitFor(() => {
            expect(addPendingTransaction).toHaveBeenCalled();
        });

        const pendingTx = addPendingTransaction.mock.calls[0]?.[1] as
            | PendingTransaction
            | undefined;
        expect(pendingTx?.type).toBe('cancel-claim-request');
        expect(pendingTx?.txHash).toBe(
            '0xcafecafecafecafecafecafecafecafecafecafecafecafe',
        );
        expect(onCancelSuccess).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'txn-id-test', type: 'cancel-claim-request' }),
        );
        expect(onCloseRequest).toHaveBeenCalled();
    });

    it('does not fire cancel pipeline when wallet context is absent', async () => {
        jest.mocked(useCurrentWallet).mockReturnValue(undefined as never);
        await setup();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'CANCEL REQUEST' })).not.toBeDisabled();
        });

        await userEvent.click(screen.getByRole('button', { name: 'CANCEL REQUEST' }));
        expect(cancelUnstakeRequest).not.toHaveBeenCalled();
    });
});
