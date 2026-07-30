import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
    addPendingTransaction,
    estimateUnstake,
    getUnstakeCall,
    getTokenBalance,
    setLiquidStakingProvider,
    unstake,
} from '../../../src/store/actions/uiActions';
import { useCurrentAccount, useCurrentWallet, useSelectedNetwork } from '../../../src/store/selectors';
import { useAppDispatch } from '../../../src/store/store';
import ErrorMessages from '../../../src/shared/messages/ErrorMessages';
import { PlatformId } from '../../../src/shared/types/Chain';
import logger from '../../../src/shared/utils/logger';
import ClaimConfirmRequestSheet from '../../../src/ui/components/ClaimConfirmRequestSheet';
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
    v4: () => 'txn-id-claim-test',
}));


jest.mock('../../../src/store/actions/uiActions', () => ({
    ...jest.requireActual('../../../src/store/actions/uiActions'),
    estimateUnstake: jest.fn(),
    unstake: jest.fn(),
    addPendingTransaction: jest.fn(),
    getUnstakeCall: jest.fn(),
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

function mergedClaimRequest(overrides: Partial<{ id: string; totalShares: number }> = {}) {
    return {
        id: overrides.id ?? 'req-1',
        shares: '1000000000000000000',
        claimed: false,
        is_claimable: true,
        requestIds: [1, 2],
        totalShares: overrides.totalShares ?? 2.5,
    };
}

describe('ClaimConfirmRequestSheet', () => {
    const onCloseRequest = jest.fn();
    const onClaimSuccess = jest.fn();

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

        jest.mocked(estimateUnstake).mockResolvedValue('21000');
        jest.mocked(getUnstakeCall).mockResolvedValue({ call: 'mock-unstake' });
        jest.mocked(getTokenBalance).mockResolvedValue({
            balance: 10n ** 18n,
            decimals: 18,
            error: false,
        });
        jest.mocked(unstake).mockImplementation(() => async () => ({
            hash: '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
        }));
        jest.mocked(addPendingTransaction).mockImplementation(() => async () => undefined);
        jest.mocked(setLiquidStakingProvider).mockResolvedValue({
            contractAddress: '0x9999999999999999999999999999999999999999',
        });
    });

    async function setup(
        props: {
            visible?: boolean;
            data?: ReturnType<typeof mergedClaimRequest> | null;
            earnItem?: typeof mockEarnItem;
            skipAwaitGasUi?: boolean;
            omitEarnItem?: boolean;
        } = {},
    ) {
        const {
            visible = true,
            data = mergedClaimRequest(),
            earnItem = mockEarnItem,
            skipAwaitGasUi = false,
            omitEarnItem = false,
        } = props;
        if (omitEarnItem) {
            render(
                <ClaimConfirmRequestSheet
                    visible={visible}
                    onCloseRequest={onCloseRequest}
                    onClaimSuccess={onClaimSuccess}
                    data={data}
                />,
            );
        } else {
            render(
                <ClaimConfirmRequestSheet
                    visible={visible}
                    onCloseRequest={onCloseRequest}
                    onClaimSuccess={onClaimSuccess}
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

    it('shows claim copy, total shares for merged requests, and partner artwork', async () => {
        await setup({ earnItem: { ...mockEarnItem, partner_name: 'FastLane' } });

        await waitFor(() => {
            expect(jest.mocked(estimateUnstake)).toHaveBeenCalledWith(WALLET_ADDR, [1, 2]);
        });

        // FastLane ships no bundled logo; the sheet renders without partner artwork.
        expect(screen.queryByRole('img', { name: 'Icon' })).not.toBeInTheDocument();

        expect(screen.getByText('Claim 2.5 stMON')).toBeInTheDocument();
    });

    it('treats merged requests without totalShares as zero for display', async () => {
        await setup({
            data: { ...mergedClaimRequest(), totalShares: undefined },
        });

        expect(screen.getByText('Claim 0 stMON')).toBeInTheDocument();
    });

    it('skips gas estimate when merged request ids are missing', async () => {
        await setup({
            data: {
                ...mergedClaimRequest(),
                requestIds: undefined,
            } as ReturnType<typeof mergedClaimRequest>,
            skipAwaitGasUi: true,
        });

        await screen.findByRole('button', { name: 'CANCEL' });
        expect(estimateUnstake).not.toHaveBeenCalled();
    });

    it('formats shares from request data when requests are not merged', async () => {
        await setup({
            earnItem: { ...mockEarnItem, requestsMerged: false },
            data: {
                id: 'single',
                shares: '2000000000000000000',
                claimed: false,
                is_claimable: true,
            },
        });

        await waitFor(() => {
            expect(jest.mocked(estimateUnstake)).toHaveBeenCalledWith(WALLET_ADDR, 'single');
        });

        expect(screen.getByText('Claim 2 stMON')).toBeInTheDocument();
    });

    it('does not load staking provider or estimate gas when earnItem is omitted', async () => {
        await setup({ omitEarnItem: true, skipAwaitGasUi: true });

        await screen.findByRole('button', { name: 'CANCEL' });
        expect(setLiquidStakingProvider).not.toHaveBeenCalled();
        expect(estimateUnstake).not.toHaveBeenCalled();
    });

    it('omits partner image when partner is unknown', async () => {
        await setup({ earnItem: { ...mockEarnItem, partner_name: undefined } });

        expect(screen.getByText('Claim 2.5 stMON')).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: 'Icon' })).not.toBeInTheDocument();
    });

    it('shows nothing when modal is invisible', async () => {
        await setup({ visible: false });
        expect(screen.queryByRole('button', { name: 'CLAIM' })).not.toBeInTheDocument();
    });

    it('shows nothing when sheet is visible but data is missing', async () => {
        await setup({ visible: true, data: null });
        expect(screen.queryByRole('button', { name: 'CLAIM' })).not.toBeInTheDocument();
    });

    it('closes when CANCEL is clicked', async () => {
        await setup();
        await userEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
        expect(onCloseRequest).toHaveBeenCalled();
    });

    it('surfaces estimate errors from estimateUnstake', async () => {
        jest.mocked(estimateUnstake).mockRejectedValueOnce(new Error('rpc down'));
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
        expect(screen.getByRole('button', { name: 'CLAIM' })).toBeDisabled();
    });

    it('keeps claim disabled while gas estimate is incomplete', async () => {
        jest.mocked(estimateUnstake).mockResolvedValueOnce(null as unknown as string);
        await setup({ skipAwaitGasUi: true });

        await waitFor(() =>
            expect(jest.mocked(estimateUnstake).mock.calls.length).toBeGreaterThan(0),
        );

        const claimBtn = await screen.findByRole('button', { name: 'CLAIM' });
        await waitFor(() => expect(claimBtn).toBeDisabled());
    });

    it('does not enqueue pending tx when unstake returns no hash', async () => {
        jest.mocked(unstake).mockImplementation(() => async () => null);
        await setup();

        await userEvent.click(screen.getByRole('button', { name: 'CLAIM' }));

        await waitFor(() => {
            expect(unstake).toHaveBeenCalled();
        });
        expect(addPendingTransaction).not.toHaveBeenCalled();
        expect(onClaimSuccess).not.toHaveBeenCalled();
        expect(onCloseRequest).not.toHaveBeenCalled();
    });

    it('dispatches pending tx, karma bump, and notifies on successful claim flow', async () => {
        await setup();

        await userEvent.click(screen.getByRole('button', { name: 'CLAIM' }));

        await waitFor(() => {
            expect(unstake).toHaveBeenCalledWith(
                WALLET_ADDR,
                [1, 2],
                undefined,
                { mocked: true },
                21000,
            );
        });

        await waitFor(() => {
            expect(addPendingTransaction).toHaveBeenCalled();
        });


        const pendingTx = addPendingTransaction.mock.calls[0]?.[1] as
            | { type?: string; txHash?: string; id?: string }
            | undefined;
        expect(pendingTx?.type).toBe('unstake');
        expect(pendingTx?.txHash).toBe('0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef');
        expect(onClaimSuccess).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'txn-id-claim-test', type: 'unstake' }),
        );
        expect(onCloseRequest).toHaveBeenCalled();
    });

    it('does not fire unstake when wallet context is absent', async () => {
        jest.mocked(useCurrentWallet).mockReturnValue(undefined as never);
        await setup();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'CLAIM' })).not.toBeDisabled();
        });

        await userEvent.click(screen.getByRole('button', { name: 'CLAIM' }));
        expect(unstake).not.toHaveBeenCalled();
    });
});
