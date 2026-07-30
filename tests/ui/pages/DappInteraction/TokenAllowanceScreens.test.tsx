import React from 'react';
import { BigNumber } from '@ethersproject/bignumber';
import { createMemoryHistory } from 'history';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';

import Toast from '../../../../src/ui/components/Toast';
import TokenAllowance from '../../../../src/ui/pages/DappInteraction/TokenAllowance';
import TokenAllowanceConfirmation from '../../../../src/ui/pages/DappInteraction/TokenAllowanceConfirmation';
import { TX_CONFIRMATION_TOKEN_ALLOWANCE_CONFIRMATION_ROUTE } from '../../../../src/shared/constants/routes';
import { useCoinByTokenAddress, useSelectedNetwork } from '../../../../src/store/selectors';

import {
    DappInteractionContextProviderHarness,
    defaultDappInteractionContextValue,
    mergeDappContext,
} from './fixtures/dappInteractionContextFixture';

jest.mock('../../../../src/ui/components/AccountView', () => ({
    __esModule: true,
    default: ({ account }: { account?: unknown }) =>
        account ? <div data-testid="account-view">account</div> : <div data-testid="account-view-empty" />,
}));
jest.mock('../../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: jest.fn(), showError: jest.fn() },
}));
jest.mock('../../../../src/ui/components/ThirdPartyModal', () => ({
    __esModule: true,
    default: ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
        visible ? (
            <div data-testid="third-party-modal">
                <button onClick={onClose}>third-party-close</button>
            </div>
        ) : null,
}));
jest.mock('../../../../src/ui/components/TokenAllowanceData', () => ({
    __esModule: true,
    default: () => <div data-testid="token-allowance-data" />,
}));

jest.mock('../../../../src/store/selectors', () => ({
    useSelectedNetwork: jest.fn(),
    useActualTheme: jest.fn(() => 'light'),
    useCoinByTokenAddress: jest.fn(),
}));

jest.mock('../../../../src/ui/hooks/useHardwareWalletSignModal', () => ({
    useHardwareWalletSignModal: () => ({
        wrapSubmit: (fn: any) => fn(),
        hardwareModal: null,
    }),
}));

jest.mock('../../../../src/ui/components/GasFee', () => ({
    __esModule: true,
    default: ({
        onGasChange,
    }: {
        onGasChange?: (handled: { gasInfo: { gasPrice: bigint } }, fee: bigint) => void;
    }) => {
        const React = jest.requireActual('react');
        React.useEffect(() => {
            onGasChange?.({ gasInfo: { gasPrice: 10n } } as any, 1n);
        }, [onGasChange]);
        return <div data-testid="gas-fee" />;
    },
}));

const selectedNetworkMock = {
    explorer_url: 'https://explorer.test',
};

beforeEach(() => {
    jest.clearAllMocks();
    (useSelectedNetwork as jest.Mock).mockReturnValue(selectedNetworkMock);
    (useCoinByTokenAddress as jest.Mock).mockReturnValue({
        symbol: 'TST',
        logo: '',
        coin_balance: 10,
        coin_price: 1,
    });
    Object.assign(navigator, {
        clipboard: { writeText: jest.fn(() => Promise.resolve()) },
    });
    (global as any).platform = { openLink: jest.fn() };
});

describe('TokenAllowance screens', () => {
    it('navigates to confirmation on Next', async () => {
        const history = createMemoryHistory({ initialEntries: ['/'] });

        render(
            <Router history={history}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        await userEvent.click(screen.getByRole('button', { name: /next/i }));

        expect(history.location.pathname).toBe(TX_CONFIRMATION_TOKEN_ALLOWANCE_CONFIRMATION_ROUTE);
    });

    it('Max wires setApprovalAmount to coin balance', async () => {
        const setApprovalAmount = jest.fn();
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness value={mergeDappContext({ setApprovalAmount })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        await userEvent.click(screen.getByRole('button', { name: /max/i }));
        expect(setApprovalAmount).toHaveBeenCalledWith('10');
    });

    it('TokenAllowanceConfirmation calls onConfirmPress(true)', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        await userEvent.click(screen.getByRole('button', { name: /approve/i }));
        expect(defaultDappInteractionContextValue.onConfirmPress).toHaveBeenCalledWith(true);
    });

    it('copy token shortcut shows clipboard toast on confirmation screen', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        const copyHost = screen
            .getAllByRole('generic')
            .find(node => node.getAttribute('data-tooltip-content') === 'Copy to clipboard');
        expect(copyHost).toBeDefined();
        await userEvent.click(copyHost!);
        expect(Toast.showSuccess).toHaveBeenCalledWith('Copied to clipboard');
    });

    it('Use site suggestion restores dapp proposed amount', async () => {
        const setApprovalAmount = jest.fn();
        const tokenAmount = BigNumber.from(5);

        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({
                        assetDetails: {
                            ...defaultDappInteractionContextValue.assetDetails!,
                            tokenAmount,
                        },
                        approvalAmount: '999',
                        setApprovalAmount,
                    })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        await userEvent.click(screen.getByRole('button', { name: /use site suggestion/i }));
        expect(setApprovalAmount).toHaveBeenCalledWith('5');
    });

    it('shows verify third-party modal trigger', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        await userEvent.click(screen.getByText(/verify third-party details/i));
    });

    it('opens explorer via platform.openLink when token row link is used', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        const linkHost = screen
            .getAllByRole('generic')
            .find(node => node.getAttribute('data-tooltip-content') === 'Open in block explorer');
        expect(linkHost).toBeDefined();
        await userEvent.click(linkHost!);
        expect((global as any).platform.openLink).toHaveBeenCalled();
    });

    it('TokenAllowanceConfirmation Reject button calls onRejectPress', async () => {
        const onRejectPress = jest.fn();
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness value={mergeDappContext({ onRejectPress })}>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(onRejectPress).toHaveBeenCalled();
    });

    it('TokenAllowanceConfirmation Edit button navigates back', async () => {
        const history = createMemoryHistory({ initialEntries: ['/prev', '/confirm'], initialIndex: 1 });

        render(
            <Router history={history}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        await userEvent.click(screen.getByRole('button', { name: /edit/i }));
        expect(history.location.pathname).toBe('/prev');
    });

    it('TokenAllowanceConfirmation opens explorer link with /address/ path', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        const linkHost = screen
            .getAllByRole('generic')
            .find(node => node.getAttribute('data-tooltip-content') === 'Open in block explorer');
        expect(linkHost).toBeDefined();
        await userEvent.click(linkHost!);
        expect((global as any).platform.openLink).toHaveBeenCalledWith(
            expect.stringContaining('/address/'),
            '_blank',
        );
    });

    it('TokenAllowanceConfirmation skips explorer link when explorer_url is missing', async () => {
        (useSelectedNetwork as jest.Mock).mockReturnValue({ explorer_url: '' });

        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        const linkHost = screen
            .getAllByRole('generic')
            .find(node => node.getAttribute('data-tooltip-content') === 'Open in block explorer');
        await userEvent.click(linkHost!);
        expect((global as any).platform.openLink).not.toHaveBeenCalled();
    });

    it('TokenAllowanceConfirmation toggles the third-party modal open and closed', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        await userEvent.click(screen.getByText(/verify third-party details/i));
        expect(screen.getByTestId('third-party-modal')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /third-party-close/i }));
        expect(screen.queryByTestId('third-party-modal')).not.toBeInTheDocument();
    });

    it('TokenAllowanceConfirmation renders error message and disables confirm', () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({
                        error: 'Boom',
                        confirmButtonDisabled: true,
                    })}>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        expect(screen.getByText('Boom')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
    });

    it('TokenAllowanceConfirmation falls back to defaults when coin and asset details are missing', () => {
        (useCoinByTokenAddress as jest.Mock).mockReturnValue(undefined);
        const { useActualTheme } = require('../../../../src/store/selectors');
        (useActualTheme as jest.Mock).mockReturnValue('dark');

        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({
                        assetDetails: undefined as any,
                        currentRequest: { txParams: {} } as any,
                    })}>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('TokenAllowance copy token shortcut shows clipboard toast', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        const copyHost = screen
            .getAllByRole('generic')
            .find(node => node.getAttribute('data-tooltip-content') === 'Copy to clipboard');
        expect(copyHost).toBeDefined();
        await userEvent.click(copyHost!);
        expect(Toast.showSuccess).toHaveBeenCalledWith('Copied to clipboard');
    });

    it('TokenAllowance copy is a no-op when token address is missing', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({ tokenAddress: undefined as any })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        const copyHost = screen
            .getAllByRole('generic')
            .find(node => node.getAttribute('data-tooltip-content') === 'Copy to clipboard');
        await userEvent.click(copyHost!);
        expect(Toast.showSuccess).not.toHaveBeenCalled();
    });

    it('TokenAllowance Reject button calls onRejectPress', async () => {
        const onRejectPress = jest.fn();
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness value={mergeDappContext({ onRejectPress })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(onRejectPress).toHaveBeenCalled();
    });

    it('TokenAllowance updates approvalAmount on input change', async () => {
        const setApprovalAmount = jest.fn();
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({ setApprovalAmount, approvalAmount: '1' })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        const input = screen.getByDisplayValue('1') as HTMLInputElement;
        await userEvent.type(input, '2');
        expect(setApprovalAmount).toHaveBeenCalled();
    });

    it('TokenAllowance closes third-party modal', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        await userEvent.click(screen.getByText(/verify third-party details/i));
        expect(screen.getByTestId('third-party-modal')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /third-party-close/i }));
        expect(screen.queryByTestId('third-party-modal')).not.toBeInTheDocument();
    });

    it('TokenAllowance shows caution icon when approvalAmount exceeds balance', () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({ approvalAmount: '9999' })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        // The caution icon is inside a tooltip-toggling button. Locate by the data-tooltip-html attribute.
        const cautionBtn = screen
            .getAllByRole('button')
            .find(b => b.getAttribute('data-tooltip-html')?.includes('cautious'));
        expect(cautionBtn).toBeDefined();
    });

    it('TokenAllowance uses dark theme tooltip variant', () => {
        const { useActualTheme } = require('../../../../src/store/selectors');
        (useActualTheme as jest.Mock).mockReturnValue('dark');
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        const copyHost = screen
            .getAllByRole('generic')
            .find(node => node.getAttribute('data-tooltip-content') === 'Copy to clipboard');
        expect(copyHost?.getAttribute('data-tooltip-variant')).toBe('light');
    });

    it('TokenAllowance falls back to Unknown when coin is missing', () => {
        (useCoinByTokenAddress as jest.Mock).mockReturnValue(undefined);
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('TokenAllowance Max does nothing when coin_balance is missing', async () => {
        const setApprovalAmount = jest.fn();
        (useCoinByTokenAddress as jest.Mock).mockReturnValue({ symbol: 'TST', logo: '' });
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({ setApprovalAmount })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        await userEvent.click(screen.getByRole('button', { name: /max/i }));
        expect(setApprovalAmount).not.toHaveBeenCalled();
    });

    it('TokenAllowance Use site suggestion does nothing when tokenAmount missing', async () => {
        const setApprovalAmount = jest.fn();
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({
                        assetDetails: {
                            ...defaultDappInteractionContextValue.assetDetails!,
                            tokenAmount: undefined as any,
                        },
                        setApprovalAmount,
                    })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        // Use site suggestion should NOT be present
        expect(
            screen.queryByRole('button', { name: /use site suggestion/i }),
        ).not.toBeInTheDocument();
    });

    it('TokenAllowance handles missing assetDetails, subjectMetadata and currentRequest', () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({
                        assetDetails: undefined as any,
                        subjectMetadata: undefined as any,
                        currentRequest: undefined as any,
                    })}>
                    <TokenAllowance />
                </DappInteractionContextProviderHarness>
            </Router>,
        );
        expect(screen.getByText(/spending cap request/i)).toBeInTheDocument();
    });

    it('TokenAllowanceConfirmation copy is a no-op when token address is missing', async () => {
        render(
            <Router history={createMemoryHistory()}>
                <DappInteractionContextProviderHarness
                    value={mergeDappContext({ tokenAddress: undefined as any })}>
                    <TokenAllowanceConfirmation />
                </DappInteractionContextProviderHarness>
            </Router>,
        );

        const copyHost = screen
            .getAllByRole('generic')
            .find(node => node.getAttribute('data-tooltip-content') === 'Copy to clipboard');
        await userEvent.click(copyHost!);
        expect(Toast.showSuccess).not.toHaveBeenCalled();
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
});
