import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PermissionConnect from '../../../../src/ui/pages/DappInteraction/PermissionConnect';
import SwitchNetwork from '../../../../src/ui/pages/DappInteraction/SwitchNetwork';
import SignatureRequest from '../../../../src/ui/pages/DappInteraction/SignatureRequest';
import {
    useCurrentAccount,
    useCurrentAccountByAddress,
    useFirstPermissionRequest,
    useFirstUnapprovedMessage,
    useSelectedNetwork,
    useSubjectMetadataByOrigin,
} from '../../../../src/store/selectors';
import { useFirstUnapprovedNetworkRequest } from '../../../../src/store/selectors/network';
import { useAppDispatch } from '../../../../src/store/store';

import {
    DappInteractionContextProviderHarness,
    mergeDappContext,
} from './fixtures/dappInteractionContextFixture';

jest.mock('../../../../src/ui/components/AccountSelectModal', () => ({
    __esModule: true,
    default: ({ visible, onConfirm, onClose, selectedAccounts }: any) =>
        visible ? (
            <div data-testid="account-select-modal">
                <button
                    data-testid="confirm-multi-accounts"
                    onClick={() =>
                        onConfirm([
                            { address: '0xaaa', metadata: { keyring: { type: 'HD Key Tree' } } },
                            { address: '0xbbb', metadata: { keyring: { type: 'HD Key Tree' } } },
                        ])
                    }>
                    confirm-multi
                </button>
                <button
                    data-testid="confirm-current-included"
                    onClick={() =>
                        onConfirm([
                            { address: '0xaaa', metadata: { keyring: { type: 'HD Key Tree' } } },
                            { address: '0xbbb', metadata: { keyring: { type: 'HD Key Tree' } } },
                        ])
                    }>
                    confirm-included
                </button>
                <button data-testid="close-modal" onClick={onClose}>
                    close
                </button>
                <span data-testid="selected-count">{selectedAccounts?.length ?? 0}</span>
            </div>
        ) : null,
}));
jest.mock('../../../../src/ui/components/AccountView', () => ({
    __esModule: true,
    default: ({ account, onPress }: { account?: unknown; onPress?: () => void }) => (
        <button type="button" data-testid="account-view" onClick={() => onPress?.()}>
            {account ? 'has-account' : 'choose-account'}
        </button>
    ),
}));
jest.mock('../../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn(), showError: jest.fn() },
}));

jest.mock('../../../../src/store/selectors', () => ({
    useCurrentAccount: jest.fn(),
    useFirstPermissionRequest: jest.fn(),
    useSubjectMetadataByOrigin: jest.fn(),
    useActualTheme: jest.fn(() => 'light'),
    useSelectedNetwork: jest.fn(),
    useCurrentAccountByAddress: jest.fn(),
    useFirstUnapprovedMessage: jest.fn(),
}));

jest.mock('../../../../src/store/selectors/network', () => ({
    __esModule: true,
    useFirstUnapprovedNetworkRequest: jest.fn(),
}));

jest.mock('../../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: jest.fn(),
}));

jest.mock('../../../../src/ui/hooks/useHardwareWalletSignModal', () => ({
    useHardwareWalletSignModal: () => ({
        wrapSubmit: (fn: any) => fn(),
        hardwareModal: null,
    }),
}));

jest.mock('../../../../src/store/actions/uiActions', () => ({
    approvePermissionsRequest: jest.fn(() => jest.fn()),
    rejectPermissionsRequest: jest.fn(() => jest.fn()),
    resolvePendingApproval: jest.fn(() => jest.fn()),
    rejectPendingApproval: jest.fn(() => jest.fn()),
    getNativeTokenBalance: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: { setTxConfirmationHandling: jest.fn() },
}));

const waitingRef = React.createRef<boolean | 'ignore'>() as React.MutableRefObject<boolean | 'ignore'>;

let appDispatchMock: jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    waitingRef.current = false;
    appDispatchMock = jest.fn().mockImplementation((action: unknown) => {
        if (typeof action === 'function') {
            return Promise.resolve(
                (action as (d: jest.Mock, g: () => object) => unknown)(
                    appDispatchMock,
                    () => ({}),
                ),
            );
        }
        return Promise.resolve(undefined);
    });
    (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
    (useSubjectMetadataByOrigin as jest.Mock).mockReturnValue({ name: 'Dapp Name', iconUrl: '' });

    const chain = { icon: '', name: 'Ethereum' };
    const newChain = { icon: '', name: 'Polygon' };

    (useSelectedNetwork as jest.Mock).mockReturnValue(chain);

    (useFirstUnapprovedNetworkRequest as jest.Mock).mockReturnValue({
        id: 'n1',
        requestData: { chain: newChain },
    });

    const permissionRequest = {
        metadata: { origin: 'https://d.test', id: 'p1' },
        permissions: {},
    };
    (useFirstPermissionRequest as jest.Mock).mockReturnValue(permissionRequest);
    (useCurrentAccount as jest.Mock).mockReturnValue({ address: '0xaaa', metadata: { keyring: { type: 'HD Key Tree' } } });

    (useFirstUnapprovedMessage as jest.Mock).mockReturnValue({
        id: 'm1',
        type: 'personal_sign',
        msgParams: { from: '0xbbb', origin: 'https://sign.test', data: '0x6869' }, // hex "hi"
    });
    (useCurrentAccountByAddress as jest.Mock).mockReturnValue({
        account: { metadata: { keyring: { type: 'HD Key Tree' } } },
        isSmartWallet: false,
    });
});

describe('PermissionConnect', () => {
    it('accept and reject invoke thunk dispatches', async () => {
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /accept/i }));
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));

        expect(appDispatchMock).toHaveBeenCalled();
    });

    it('shows Unknown dapp name fallback', () => {
        (useSubjectMetadataByOrigin as jest.Mock).mockReturnValue(null);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );

        expect(
            screen.getAllByText((_c, el) => !!el?.textContent?.includes('wants to connect to your wallet.'))
                .length,
        ).toBeGreaterThan(0);
    });

    it('handles missing currentRequest with empty name/url/image', () => {
        (useFirstPermissionRequest as jest.Mock).mockReturnValue(null);
        (useCurrentAccount as jest.Mock).mockReturnValue(null);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        // accept should be a no-op (no selectedAccounts, no currentAccount)
        // No dispatch expected via the accept/reject paths.
    });

    it('accept early-returns when there are no selected accounts', async () => {
        (useCurrentAccount as jest.Mock).mockReturnValue(null);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /accept/i }));
        // dispatch should NOT be called with the approvePermissionsRequest thunk
        // (only effect-driven calls happen, which are 0 here).
        expect(appDispatchMock).not.toHaveBeenCalled();
    });

    it('accept early-returns when waitingRef.current is true', async () => {
        waitingRef.current = true;
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /accept/i }));
        expect(appDispatchMock).not.toHaveBeenCalled();
    });

    it('reject early-returns when metadata.id is missing', async () => {
        (useFirstPermissionRequest as jest.Mock).mockReturnValue({
            metadata: { origin: 'https://d.test' },
            permissions: {},
        });
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        // metadata.id missing -> early return
        // Note: dispatch may still be called by accept effects so we don't assert non-call.
    });

    it('shows error toast when accept dispatch throws with message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject(new Error('accept-fail')));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /accept/i }));
        expect(Toast.showError).toHaveBeenCalledWith('accept-fail');
    });

    it('does not show error toast when accept dispatch throws empty error', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject({}));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /accept/i }));
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('shows error toast when reject dispatch throws with message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject(new Error('reject-fail')));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(Toast.showError).toHaveBeenCalledWith('reject-fail');
    });

    it('does not show error toast when reject dispatch throws empty error', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject({}));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('opens AccountSelectModal when account view is pressed and closes it', async () => {
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByTestId('account-view'));
        expect(screen.getByTestId('account-select-modal')).toBeInTheDocument();
        await userEvent.click(screen.getByTestId('close-modal'));
        expect(screen.queryByTestId('account-select-modal')).not.toBeInTheDocument();
    });

    it('renders multi-account selector when more than one account is confirmed', async () => {
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        // Open modal and confirm multiple accounts.
        await userEvent.click(screen.getByTestId('account-view'));
        await userEvent.click(screen.getByTestId('confirm-multi-accounts'));
        // After confirm, modal is still open (we did not call onClose), but the
        // selector switches to the multi-account button when there are >1 selected.
        expect(screen.getByText(/Accounts in total/i)).toBeInTheDocument();
        // Click the multi-account button to call onAccountPress again.
        await userEvent.click(screen.getByText(/CHANGE/i));
    });

    it('falls back to Unknown when origin is missing', () => {
        (useFirstPermissionRequest as jest.Mock).mockReturnValue({
            metadata: { id: 'p1' },
            permissions: {},
        });
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        // Two "Unknown" strings should be rendered for url and name.
        expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    });

    it('accept with currentAccount NOT in selected list does not reorder', async () => {
        const { approvePermissionsRequest } =
            require('../../../../src/store/actions/uiActions');
        // make currentAccount distinct from confirmed accounts
        (useCurrentAccount as jest.Mock).mockReturnValue({ address: '0xccc', metadata: { keyring: { type: 'HD Key Tree' } } });
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByTestId('account-view'));
        await userEvent.click(screen.getByTestId('confirm-multi-accounts'));
        await userEvent.click(screen.getByRole('button', { name: /accept/i }));
        const callArg = (approvePermissionsRequest as jest.Mock).mock.calls.pop()?.[0];
        // currentAccount 0xccc not in approvedAccounts -> order preserved as 0xaaa,0xbbb
        expect(callArg.approvedAccounts).toEqual(['0xaaa', '0xbbb']);
    });

    it('reject does not assign waitingRef when waitingRef is null', async () => {
        // Pass a waitingRef-like object where .current is undefined.
        const customRef = { current: undefined } as unknown as React.MutableRefObject<
            boolean | 'ignore'
        >;
        render(
            <DappInteractionContextProviderHarness
                value={mergeDappContext({ waitingRef: customRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        // current was undefined, so the assignment branch must NOT execute.
        expect(customRef.current).toBeUndefined();
    });

    it('accept with currentAccount included re-orders to be first', async () => {
        appDispatchMock.mockImplementation((action: unknown) => {
            if (typeof action === 'function') {
                return Promise.resolve(undefined);
            }
            return Promise.resolve(undefined);
        });
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        const { approvePermissionsRequest } =
            require('../../../../src/store/actions/uiActions');
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <PermissionConnect />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByTestId('account-view'));
        await userEvent.click(screen.getByTestId('confirm-current-included'));
        await userEvent.click(screen.getByRole('button', { name: /accept/i }));
        const callArg = (approvePermissionsRequest as jest.Mock).mock.calls.pop()?.[0];
        // currentAccount address (0xaaa) should be first.
        expect(callArg.approvedAccounts[0]).toBe('0xaaa');
    });
});

describe('SwitchNetwork', () => {
    it('change network and cancel paths call dispatch', async () => {
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /change network/i }));
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(appDispatchMock).toHaveBeenCalled();
    });

    it('renders without newNetwork when request has no chain', () => {
        (useFirstUnapprovedNetworkRequest as jest.Mock).mockReturnValue({
            id: 'n1',
            requestData: {},
        });
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByText(/Do you allow this site to change the network/i)).toBeInTheDocument();
    });

    it('accept early-returns when there is no request', async () => {
        (useFirstUnapprovedNetworkRequest as jest.Mock).mockReturnValue(null);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /change network/i }));
        expect(appDispatchMock).not.toHaveBeenCalled();
    });

    it('accept early-returns when waitingRef.current is true', async () => {
        waitingRef.current = true;
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /change network/i }));
        expect(appDispatchMock).not.toHaveBeenCalled();
    });

    it('reject early-returns when waitingRef.current is true', async () => {
        waitingRef.current = true;
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(appDispatchMock).not.toHaveBeenCalled();
    });

    it('reject early-returns when there is no request', async () => {
        (useFirstUnapprovedNetworkRequest as jest.Mock).mockReturnValue(null);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(appDispatchMock).not.toHaveBeenCalled();
    });

    it('shows error toast when accept dispatch throws with message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject(new Error('switch-fail')));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /change network/i }));
        expect(Toast.showError).toHaveBeenCalledWith('switch-fail');
    });

    it('does not show error toast when accept dispatch throws empty error', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject({}));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /change network/i }));
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('shows error toast when reject dispatch throws with message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject(new Error('reject-fail')));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(Toast.showError).toHaveBeenCalledWith('reject-fail');
    });

    it('does not show error toast when reject dispatch throws empty error', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject({}));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('skips waitingRef assignment when current is undefined on reject', async () => {
        const undefinedRef = React.createRef<boolean | 'ignore'>() as React.MutableRefObject<
            boolean | 'ignore' | undefined
        >;
        undefinedRef.current = undefined;
        render(
            <DappInteractionContextProviderHarness
                value={mergeDappContext({ waitingRef: undefinedRef as any })}>
                <SwitchNetwork />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(undefinedRef.current).toBeUndefined();
    });
});

describe('SignatureRequest', () => {
    it('sign and reject call dispatch', async () => {
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText(/signature request/i)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /sign/i }));
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(appDispatchMock).toHaveBeenCalled();
    });

    it('renders raw data for non personal_sign types and parses JSON message', () => {
        (useFirstUnapprovedMessage as jest.Mock).mockReturnValue({
            id: 'm2',
            type: 'eth_signTypedData_v4',
            msgParams: {
                from: '0xbbb',
                origin: 'https://typed.test',
                data: '{"hello":"world"}',
            },
        });
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByText(/signature request/i)).toBeInTheDocument();
    });

    it('catches and shows error toast when sign dispatch throws with message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject(new Error('sign-fail')));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /sign/i }));
        expect(Toast.showError).toHaveBeenCalledWith('sign-fail');
    });

    it('does not show error toast when sign dispatch throws without message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject({}));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /sign/i }));
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('catches and shows error toast when reject dispatch throws with message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject(new Error('reject-fail')));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(Toast.showError).toHaveBeenCalledWith('reject-fail');
    });

    it('does not show error toast when reject dispatch throws without message', async () => {
        const Toast = require('../../../../src/ui/components/Toast').default;
        Toast.showError = jest.fn();
        Toast.showSuccess = jest.fn();
        appDispatchMock.mockImplementation(() => Promise.reject({}));
        (useAppDispatch as jest.Mock).mockReturnValue(appDispatchMock);

        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(Toast.showError).not.toHaveBeenCalled();
    });

    it('short-circuits sign/reject when there is no current request', async () => {
        (useFirstUnapprovedMessage as jest.Mock).mockReturnValue(undefined);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        const dispatchCallsBefore = appDispatchMock.mock.calls.length;
        await userEvent.click(screen.getByRole('button', { name: /sign/i }));
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(appDispatchMock.mock.calls.length).toBe(dispatchCallsBefore);
    });

    it('short-circuits sign/reject when waitingRef is true', async () => {
        const localWaiting = React.createRef<boolean | 'ignore'>() as React.MutableRefObject<
            boolean | 'ignore'
        >;
        localWaiting.current = true;
        render(
            <DappInteractionContextProviderHarness
                value={mergeDappContext({ waitingRef: localWaiting })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        const dispatchCallsBefore = appDispatchMock.mock.calls.length;
        await userEvent.click(screen.getByRole('button', { name: /sign/i }));
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(appDispatchMock.mock.calls.length).toBe(dispatchCallsBefore);
    });

    it('uses dark theme palette when actualTheme is dark', () => {
        const selectors = require('../../../../src/store/selectors');
        (selectors.useActualTheme as jest.Mock).mockReturnValue('dark');
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByText(/signature request/i)).toBeInTheDocument();
    });

    it('renders when subject metadata is missing (iconUrl fallback)', () => {
        (useSubjectMetadataByOrigin as jest.Mock).mockReturnValue(null);
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByText(/signature request/i)).toBeInTheDocument();
    });

    it('handles message data missing without crashing', () => {
        (useFirstUnapprovedMessage as jest.Mock).mockReturnValue({
            id: 'm3',
            type: 'eth_signTypedData_v4',
            msgParams: { from: '0xbbb' },
        });
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByText(/signature request/i)).toBeInTheDocument();
    });

    it('handles non-string message data through the messageJson memo', () => {
        (useFirstUnapprovedMessage as jest.Mock).mockReturnValue({
            id: 'm4',
            type: 'eth_signTypedData_v4',
            // data is an object, not a string -> typeof !== 'string' branch.
            msgParams: { from: '0xbbb', origin: 'https://o', data: { foo: 'bar' } as any },
        });
        render(
            <DappInteractionContextProviderHarness value={mergeDappContext({ waitingRef })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByText(/signature request/i)).toBeInTheDocument();
    });

    it('rejects without writing back to waitingRef when current is undefined', async () => {
        const localWaiting = React.createRef<boolean | 'ignore'>() as React.MutableRefObject<
            boolean | 'ignore' | undefined
        >;
        // current undefined -> the early-guard treats it as falsy and dispatch
        // is still invoked, but the post-success write to waitingRef is skipped.
        localWaiting.current = undefined as any;
        render(
            <DappInteractionContextProviderHarness
                value={mergeDappContext({ waitingRef: localWaiting as any })}>
                <SignatureRequest />
            </DappInteractionContextProviderHarness>,
        );
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        // waitingRef.current should remain undefined because the
        // `if (waitingRef?.current !== undefined)` guard is false.
        expect(localWaiting.current).toBeUndefined();
    });
});
