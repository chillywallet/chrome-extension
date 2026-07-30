

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SendCallsConfirmation from '../../../../src/ui/pages/DappInteraction/SendCallsConfirmation';
import * as uiActions from '../../../../src/store/actions/uiActions';
import {
    useAccounts,
    useCurrentAccountByAddress,
    useNativeCoinBalance,
    useSelectedNetwork,
    useSubjectMetadataByOrigin,
} from '../../../../src/store/selectors';
import { useFirstWalletSendCallsApprovalRequest } from '../../../../src/store/selectors/eip5792';
import { useAppDispatch } from '../../../../src/store/store';

import {
    DappInteractionContextProviderHarness,
    mergeDappContext,
} from './fixtures/dappInteractionContextFixture';

jest.mock('framer-motion', () => ({
    __esModule: true,
    AnimatePresence: ({ children }: any) => children ?? null,
    motion: new Proxy({}, { get: () => (props: any) => props.children ?? null }),
}));

jest.mock('../../../../src/ui/components/ConfirmationHeader', () => ({
    __esModule: true,
    default: () => <div data-testid="confirmation-header" />,
}));

jest.mock('../../../../src/ui/components/GasFee', () => ({
    __esModule: true,
    default: ({
        onGasChange,
    }: {
        onGasChange?: (handled: any, fee: bigint) => void;
    }) => {
        const React = jest.requireActual('react');
        React.useEffect(() => {
            onGasChange?.(
                {
                    gasInfo: { gasPrice: BigInt('1000000000') },
                    gasPrice: BigInt('1000000000'),
                },
                1n,
            );
        }, [onGasChange]);
        return <div data-testid="gas-fee" />;
    },
}));

const mockGaslessState = {
    isGaslessDisableRequired: false,
    loadingGasless: false,
    resetWallet: undefined as any,
};


jest.mock('../../../../src/store/selectors', () => ({
    useAccounts: jest.fn(() => []),
    useSelectedNetwork: jest.fn(),
    useSubjectMetadataByOrigin: jest.fn(),
    useNativeCoinBalance: jest.fn(),
    useCurrentAccountByAddress: jest.fn(),
}));

jest.mock('../../../../src/store/selectors/eip5792', () => ({
    __esModule: true,
    useWalletSendCallsApprovalRequests: jest.fn(() => []),
    useWalletShowCallsStatusApprovalRequests: jest.fn(() => []),
    useFirstWalletSendCallsApprovalRequest: jest.fn(),
    useFirstWalletShowCallsStatusApprovalRequest: jest.fn(),
}));

jest.mock('../../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(() => jest.fn().mockResolvedValue(undefined)),
    getReduxStore: jest.fn(() => undefined),
}));

jest.mock('../../../../src/ui/hooks/useHardwareWalletSignModal', () => ({
    useHardwareWalletSignModal: () => ({
        wrapSubmit: (fn: any) => fn(),
        hardwareModal: null,
    }),
}));

const mockGetAllAccounts = jest.fn(() => [] as any[]);
jest.mock('../../../../src/store/selectorUtils', () => ({
    getAllAccounts: () => mockGetAllAccounts(),
}));

jest.mock('../../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: { setTxConfirmationHandling: jest.fn() },
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn() },
}));

jest.mock('../../../../src/api/graphQL/BaseRequest', () => ({
    getErrorMessage: jest.fn(e => (e instanceof Error ? e.message : String(e))),
}));

const waitingRef = { current: false } as React.MutableRefObject<boolean | 'ignore'>;

let uiActionSpies: jest.SpyInstance[] = [];

function buildRequest(callCount: number) {
    const calls = Array.from({ length: callCount }, (_, i) => ({
        to: `0x${String(i + 1).padStart(40, '0')}` as const,
        value: '0x0' as const,
        data: '0x',
    }));

    return {
        id: 'sendcalls-1',
        origin: 'https://dapp.example',
        requestData: {
            from: '0xaaaa000000000000000000000000000000aaaa',
            origin: 'https://dapp.example',
            params: {
                version: '1.0',
                chainId: '0x1',
                atomicRequired: false,
                calls,
            },
        },
    };
}

beforeEach(() => {
    uiActionSpies.forEach(spy => spy.mockRestore());
    uiActionSpies = [];

    jest.clearAllMocks();
    waitingRef.current = false;

    // Restore implementations wiped by resetMocks for mocks defined inline.

    // Reset gasless state
    mockGaslessState.isGaslessDisableRequired = false;
    mockGaslessState.loadingGasless = false;
    mockGaslessState.resetWallet = jest.fn().mockResolvedValue(true);

    const { getErrorMessage } = require('../../../../src/api/graphQL/BaseRequest');
    (getErrorMessage as jest.Mock).mockImplementation((e: any) =>
        e instanceof Error ? e.message : String(e),
    );

    uiActionSpies.push(
        jest.spyOn(uiActions, 'estimateWalletSendCallsGas').mockResolvedValue(21000),
        jest.spyOn(uiActions, 'checkContract').mockResolvedValue(false),
        jest.spyOn(uiActions, 'getNativeTokenBalance').mockImplementation(() =>
            jest.fn().mockResolvedValue(undefined),
        ),
        jest.spyOn(uiActions, 'rejectPendingApproval').mockImplementation(() =>
            jest.fn().mockResolvedValue(undefined),
        ),
        jest.spyOn(uiActions, 'resolvePendingApproval').mockImplementation(() =>
            jest.fn().mockResolvedValue(undefined),
        ),
    );
    (useSelectedNetwork as jest.Mock).mockReturnValue({
        chain_id: 1,
        native_coin_symbol: 'ETH',
        chain_key: 'ethereum',
        icon: '',
    });
    (useSubjectMetadataByOrigin as jest.Mock).mockReturnValue({ iconUrl: '' });
    (useNativeCoinBalance as jest.Mock).mockReturnValue(BigInt('10000000000000000000'));
    const defaultAccounts = [
        {
            address: `0x${'1'.repeat(40)}`,
            metadata: { name: 'One' },
        },
    ];
    (useAccounts as jest.Mock).mockReturnValue(defaultAccounts);
    mockGetAllAccounts.mockReturnValue(defaultAccounts);

    (useCurrentAccountByAddress as jest.Mock).mockReturnValue({
        account: {
            metadata: {
                name: 'Signer',
                avatar: '',
                keyring: { type: 'HD Key Tree' },
            },
        },
        isSmartWallet: false,
    });

    (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(buildRequest(2));

    (useAppDispatch as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue(undefined));
});

describe('SendCallsConfirmation', () => {
    it('renders batch calls and reacts to reveal / buttons', async () => {
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await waitFor(() => expect(uiActions.estimateWalletSendCallsGas).toHaveBeenCalled());

        expect(screen.getByText(/batch transaction/i)).toBeInTheDocument();

        await userEvent.click(screen.getAllByRole('button', { name: /show data/i })[0]);
        await userEvent.click(screen.getAllByRole('button', { name: /hide data/i })[0]);

        await userEvent.click(screen.getByRole('button', { name: /confirm$/i }));
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
    });

    it('shows error for smart-wallet accounts', async () => {
        (useCurrentAccountByAddress as jest.Mock).mockReturnValue({
            account: { metadata: { keyring: { type: 'HD Key Tree' } } },
            isSmartWallet: true,
        });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await waitFor(() => {
            expect(
                screen.getByText(/Smart Wallet does not support wallet_sendCalls batch/i),
            ).toBeInTheDocument();
        });
    });

    it('shows overflow copy when batch has many calls', async () => {
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(buildRequest(8));

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await screen.findByText(/\+3 more call/i);
    });

    it('shows empty batch error when calls array is empty', async () => {
        const req = buildRequest(0);
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(req);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await screen.findByText(/Invalid or empty batch/i);
    });

    it('shows insufficient funds error when value exceeds balance', async () => {
        (useNativeCoinBalance as jest.Mock).mockReturnValue(0n);
        const req = buildRequest(1);
        req.requestData.params.calls[0].value = ('0x' +
            BigInt('1000000000000000000').toString(16)) as any;
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(req);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await screen.findByText(/balance is too low/i);
    });

    it('shows insufficient funds for amount + gas error', async () => {
        // Have just enough for value but not for value+gas
        (useNativeCoinBalance as jest.Mock).mockReturnValue(BigInt('1000000000000000000'));
        const req = buildRequest(1);
        req.requestData.params.calls[0].value = ('0x' +
            BigInt('1000000000000000000').toString(16)) as any;
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(req);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await waitFor(() => {
            expect(
                screen.getByText(/cover the amount and network fee/i),
            ).toBeInTheDocument();
        });
    });

    it('does not call confirm when waitingRef is true', async () => {
        const myWaitingRef = { current: true } as React.MutableRefObject<boolean | 'ignore'>;
        const resolveSpy = jest.spyOn(uiActions, 'resolvePendingApproval');

        render(
            <DappInteractionContextProviderHarness
                value={mergeDappContext({ waitingRef: myWaitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        // The button might be disabled, but invoke directly
        const btn = await screen.findByRole('button', { name: /confirm$/i });
        await userEvent.click(btn);
        expect(resolveSpy).not.toHaveBeenCalled();
    });

    it('confirms request and dispatches resolvePendingApproval', async () => {
        const dispatchMock = jest.fn().mockResolvedValue(undefined);
        (useAppDispatch as jest.Mock).mockReturnValue(dispatchMock);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await waitFor(() => expect(uiActions.estimateWalletSendCallsGas).toHaveBeenCalled());

        const confirmBtn = await screen.findByRole('button', { name: /confirm$/i });
        await waitFor(() => expect(confirmBtn).not.toBeDisabled());
        await userEvent.click(confirmBtn);
        await waitFor(() => expect(dispatchMock).toHaveBeenCalled());
    });

    it('shows error toast when confirm dispatch fails', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        const showErrorSpy = jest.spyOn(Toast, 'showError').mockImplementation(() => {});
        (uiActions.resolvePendingApproval as jest.Mock).mockImplementation(() => {
            throw new Error('confirm failed');
        });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await waitFor(() => expect(uiActions.estimateWalletSendCallsGas).toHaveBeenCalled());

        const confirmBtn = await screen.findByRole('button', { name: /confirm$/i });
        await waitFor(() => expect(confirmBtn).not.toBeDisabled());
        await userEvent.click(confirmBtn);
        await waitFor(() => expect(showErrorSpy).toHaveBeenCalled());
        showErrorSpy.mockRestore();
    });

    it('rejects request and shows success toast', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        const showSuccessSpy = jest.spyOn(Toast, 'showSuccess').mockImplementation(() => {});
        const dispatchMock = jest.fn().mockResolvedValue(undefined);
        (useAppDispatch as jest.Mock).mockReturnValue(dispatchMock);

        const myWaitingRef = { current: false } as React.MutableRefObject<boolean | 'ignore'>;

        render(
            <DappInteractionContextProviderHarness
                value={mergeDappContext({ waitingRef: myWaitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        await waitFor(() => expect(showSuccessSpy).toHaveBeenCalledWith('Rejected request'));
        expect(myWaitingRef.current).toBe('ignore');
        showSuccessSpy.mockRestore();
    });

    it('shows error toast when reject dispatch fails', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        const showErrorSpy = jest.spyOn(Toast, 'showError').mockImplementation(() => {});
        (uiActions.rejectPendingApproval as jest.Mock).mockImplementation(() => {
            throw new Error('reject failed');
        });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        await waitFor(() => expect(showErrorSpy).toHaveBeenCalled());
        showErrorSpy.mockRestore();
    });

    it('does not reject when waitingRef is true', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        const showSuccessSpy = jest.spyOn(Toast, 'showSuccess').mockImplementation(() => {});

        const myWaitingRef = { current: true } as React.MutableRefObject<boolean | 'ignore'>;
        render(
            <DappInteractionContextProviderHarness
                value={mergeDappContext({ waitingRef: myWaitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        // Should not have called showSuccess
        expect(showSuccessSpy).not.toHaveBeenCalled();
        showSuccessSpy.mockRestore();
    });

    it('shows error when gas estimation fails', async () => {
        (uiActions.estimateWalletSendCallsGas as jest.Mock).mockRejectedValueOnce(
            new Error('gas-fail'),
        );

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await screen.findByText(/gas-fail/i);
    });

    it('uses fallback message when gas estimation returns falsy error', async () => {
        (uiActions.estimateWalletSendCallsGas as jest.Mock).mockRejectedValueOnce('');
        const { getErrorMessage } = require('../../../../src/api/graphQL/BaseRequest');
        (getErrorMessage as jest.Mock).mockReturnValueOnce('');

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await screen.findByText(/Failed to estimate gas/i);
    });

    it('handles checkContract rejection', async () => {
        (uiActions.checkContract as jest.Mock).mockRejectedValueOnce(new Error('cc-fail'));

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await waitFor(() =>
            expect(uiActions.checkContract).toHaveBeenCalled(),
        );
    });

    it('does not run early effects when from is empty', async () => {
        const req = buildRequest(1);
        req.requestData.from = '';
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(req);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        // Without `from`, checkContract & native balance loaders shouldn't run
        await waitFor(() => {
            expect(uiActions.estimateWalletSendCallsGas).not.toHaveBeenCalled();
        });
    });

    it('handles atomicRequired with non-smart wallet (needs delegation)', async () => {
        const req = buildRequest(1);
        req.requestData.params.atomicRequired = true;
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(req);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await screen.findByText(/Setup & Confirm/i);

        // Expand the delegation notice
        await userEvent.click(screen.getByRole('button', { name: /EIP-7702 setup required/i }));
        expect(screen.getByText(/atomic batch transactions can run/i)).toBeInTheDocument();
    });



    it('renders account name for batch call recipient', async () => {
        const target = '0x' + '2'.repeat(40);
        const accs = [
            {
                address: target,
                metadata: { name: 'Recipient' },
            },
            {
                smartAddress: '0x' + '3'.repeat(40),
                metadata: { name: 'SmartHolder' },
            },
        ];
        (useAccounts as jest.Mock).mockReturnValue(accs);
        mockGetAllAccounts.mockReturnValue(accs);

        const req = buildRequest(2);
        req.requestData.params.calls[0].to = target as any;
        req.requestData.params.calls[1].to = ('0x' + '3'.repeat(40)) as any;
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(req);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await waitFor(() =>
            expect(uiActions.estimateWalletSendCallsGas).toHaveBeenCalled(),
        );
        // The trimmed name should appear in the To label
        expect(screen.getByText(/Recipient/i)).toBeInTheDocument();
    });

    it('skips account without name in accountNameByAddress map', async () => {
        const accs = [
            { address: '0x' + 'a'.repeat(40), metadata: {} },
            { address: '0x' + 'b'.repeat(40), metadata: { name: 'Named' } },
        ];
        (useAccounts as jest.Mock).mockReturnValue(accs);
        mockGetAllAccounts.mockReturnValue(accs);
        const req = buildRequest(1);
        req.requestData.params.calls[0].to = ('0x' + 'b'.repeat(40)) as any;
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(req);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await screen.findByText(/Named/);
    });



    it('handles when payload is undefined (no request data)', async () => {
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(null);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        // Should render without crashing
        expect(screen.getByRole('button', { name: /confirm$/i })).toBeInTheDocument();
    });

    it('handles calls with all fields undefined (defaults for to/data/value)', async () => {
        const req: any = {
            id: 'sendcalls-empty-fields',
            origin: 'https://dapp.example',
            requestData: {
                from: '0xaaaa000000000000000000000000000000aaaa',
                origin: 'https://dapp.example',
                params: {
                    version: '1.0',
                    chainId: '0x1',
                    atomicRequired: false,
                    calls: [{}], // no to, data, or value
                },
            },
        };
        (useFirstWalletSendCallsApprovalRequest as jest.Mock).mockReturnValue(req);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await screen.findByText(/Call #1/);
        // "-" label is shown when no address
        expect(screen.getByText('-')).toBeInTheDocument();

        // Expand to render call.data ?? '0x'
        await userEvent.click(screen.getByRole('button', { name: /show data/i }));
    });

    it('reject path uses fallback message when rejectError has no message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        const showErrorSpy = jest.spyOn(Toast, 'showError').mockImplementation(() => {});
        (uiActions.rejectPendingApproval as jest.Mock).mockImplementation(() => {
            // eslint-disable-next-line no-throw-literal
            throw {};
        });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        await waitFor(() =>
            expect(showErrorSpy).toHaveBeenCalledWith('Failed to reject request'),
        );
        showErrorSpy.mockRestore();
    });

    it('confirm path uses fallback message when confirmError has no message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        const showErrorSpy = jest.spyOn(Toast, 'showError').mockImplementation(() => {});
        (uiActions.resolvePendingApproval as jest.Mock).mockImplementation(() => {
            // eslint-disable-next-line no-throw-literal
            throw {};
        });

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await waitFor(() => expect(uiActions.estimateWalletSendCallsGas).toHaveBeenCalled());
        const btn = await screen.findByRole('button', { name: /confirm$/i });
        await waitFor(() => expect(btn).not.toBeDisabled());
        await userEvent.click(btn);
        await waitFor(() =>
            expect(showErrorSpy).toHaveBeenCalledWith('Failed to confirm request'),
        );
        showErrorSpy.mockRestore();
    });


    it('reject path with waitingRef.current === undefined does not set ignore', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        const showSuccessSpy = jest.spyOn(Toast, 'showSuccess').mockImplementation(() => {});
        const wRef = {} as React.MutableRefObject<boolean | 'ignore'>;
        // Intentionally leave current as undefined
        (wRef as any).current = undefined;

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef: wRef })}>
                <SendCallsConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        await waitFor(() => expect(showSuccessSpy).toHaveBeenCalled());
        expect((wRef as any).current).toBeUndefined();
        showSuccessSpy.mockRestore();
    });

});
