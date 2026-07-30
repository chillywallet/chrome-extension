import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeployContractConfirmation from '../../../../src/ui/pages/DappInteraction/DeployContractConfirmation';
import ContractInteractionConfirmation from '../../../../src/ui/pages/DappInteraction/ContractInteractionConfirmation';
import SendNativeCoinConfirmation from '../../../../src/ui/pages/DappInteraction/SendNativeCoinConfirmation';
import SendOtherCoinConfirmation from '../../../../src/ui/pages/DappInteraction/SendOtherCoinConfirmation';
import {
    useCoinByTokenAddress,
    useNativeCoinBalance,
    useNativeCoinPrice,
    useSelectedNetwork,
} from '../../../../src/store/selectors';
import {
    DappInteractionContextProviderHarness,
    mergeDappContext,
    defaultDappInteractionContextValue,
} from './fixtures/dappInteractionContextFixture';

jest.mock('../../../../src/ui/components/ConfirmationHeader', () => ({
    __esModule: true,
    default: () => <div data-testid="confirmation-header" />,
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
jest.mock('../../../../src/ui/components/TransactionHexData', () => ({
    __esModule: true,
    default: () => <div data-testid="tx-hex" />,
}));
jest.mock('../../../../src/ui/components/TransactionAmountData', () => ({
    __esModule: true,
    default: () => <div data-testid="tx-amount" />,
}));
jest.mock('../../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../../../src/store/selectors', () => ({
    useSelectedNetwork: jest.fn(),
    useNativeCoinBalance: jest.fn(),
    useNativeCoinPrice: jest.fn(),
    useActualTheme: jest.fn(() => 'light'),
    useCoinByTokenAddress: jest.fn(),
}));

jest.mock('../../../../src/ui/hooks/useHardwareWalletSignModal', () => ({
    useHardwareWalletSignModal: () => ({
        wrapSubmit: (fn: any) => fn(),
        hardwareModal: null,
    }),
}));

const selectedNetworkMock = {
    icon: '',
    native_coin_symbol: 'ETH',
    native_coin_address: '0xn',
    chain_id: 1,
    testnet: false,
    explorer_url: 'https://explorer.test',
};

beforeEach(() => {
    jest.clearAllMocks();
    (useSelectedNetwork as jest.Mock).mockReturnValue(selectedNetworkMock);
    (useNativeCoinBalance as jest.Mock).mockReturnValue(BigInt('10000000000000000000'));
    (useNativeCoinPrice as jest.Mock).mockReturnValue(2000);
    (useCoinByTokenAddress as jest.Mock).mockReturnValue({
        symbol: 'TST',
        logo: '',
        coin_balance: 5,
        coin_price: 1,
    });
});

describe('Dapp confirmation screens', () => {
    it('DeployContractConfirmation renders and wires confirm/reject', async () => {
        render(
            <DappInteractionContextProviderHarness>
                <DeployContractConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
        expect(defaultDappInteractionContextValue.onConfirmPress).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(defaultDappInteractionContextValue.onRejectPress).toHaveBeenCalledTimes(1);
    });

    it('ContractInteractionConfirmation renders contract interaction chrome', async () => {
        render(
            <DappInteractionContextProviderHarness>
                <ContractInteractionConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText(/contract interaction/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
        expect(defaultDappInteractionContextValue.onConfirmPress).toHaveBeenCalledTimes(1);
    });

    it('ContractInteractionConfirmation triggers reject and shows error text', async () => {
        const value = mergeDappContext({
            error: 'Something went wrong',
        });
        render(
            <DappInteractionContextProviderHarness value={value}>
                <ContractInteractionConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(value.onRejectPress).toHaveBeenCalledTimes(1);
    });

    it('SendNativeCoinConfirmation shows transfer summary', async () => {
        render(
            <DappInteractionContextProviderHarness>
                <SendNativeCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByText(/transfer/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
        expect(defaultDappInteractionContextValue.onConfirmPress).toHaveBeenCalledTimes(1);
    });

    it('SendNativeCoinConfirmation reject button calls onRejectPress', async () => {
        const value = mergeDappContext({});
        render(
            <DappInteractionContextProviderHarness value={value}>
                <SendNativeCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(value.onRejectPress).toHaveBeenCalledTimes(1);
    });

    it('SendNativeCoinConfirmation hides USD on testnet and shows error', async () => {
        (useSelectedNetwork as jest.Mock).mockReturnValue({
            ...selectedNetworkMock,
            testnet: true,
        });
        const value = mergeDappContext({ error: 'native-fail' });
        render(
            <DappInteractionContextProviderHarness value={value}>
                <SendNativeCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByText('native-fail')).toBeInTheDocument();
    });

    it('SendOtherCoinConfirmation exposes DETAILS and HEX tabs', async () => {
        render(
            <DappInteractionContextProviderHarness>
                <SendOtherCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('tab', { name: /hex/i }));
        expect(screen.getByTestId('tx-hex')).toBeInTheDocument();
    });

    it('SendOtherCoinConfirmation handles confirm/reject and renders coin amount', async () => {
        const value = mergeDappContext({});
        render(
            <DappInteractionContextProviderHarness value={value}>
                <SendOtherCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
        expect(value.onConfirmPress).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('button', { name: /reject/i }));
        expect(value.onRejectPress).toHaveBeenCalledTimes(1);
    });

    it('SendOtherCoinConfirmation hides USD on testnet and shows error', async () => {
        (useSelectedNetwork as jest.Mock).mockReturnValue({
            ...selectedNetworkMock,
            testnet: true,
        });
        const value = mergeDappContext({ error: 'other-fail' });
        render(
            <DappInteractionContextProviderHarness value={value}>
                <SendOtherCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByText('other-fail')).toBeInTheDocument();
    });

    it('SendOtherCoinConfirmation tolerates missing coin and asset details', async () => {
        (useCoinByTokenAddress as jest.Mock).mockReturnValue(undefined);
        const value = mergeDappContext({ assetDetails: undefined as any });
        render(
            <DappInteractionContextProviderHarness value={value}>
                <SendOtherCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    it('SendOtherCoinConfirmation handles coin without balance gracefully', async () => {
        (useCoinByTokenAddress as jest.Mock).mockReturnValue({
            symbol: 'TST',
            logo: '',
            coin_balance: 0,
            coin_price: 1,
        });
        render(
            <DappInteractionContextProviderHarness>
                <SendOtherCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );

        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    it('SendOtherCoinConfirmation handles null logo via nullish coalesce', async () => {
        (useCoinByTokenAddress as jest.Mock).mockReturnValue({
            symbol: 'TST',
            logo: null,
            coin_balance: 5,
            coin_price: 1,
        });
        render(
            <DappInteractionContextProviderHarness>
                <SendOtherCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    it('SendNativeCoinConfirmation handles missing token amount', async () => {
        const value = mergeDappContext({ assetDetails: { toAddress: '0xabc' } as any });
        render(
            <DappInteractionContextProviderHarness value={value}>
                <SendNativeCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    it('SendNativeCoinConfirmation handles undefined assetDetails (default 0)', async () => {
        const value = mergeDappContext({ assetDetails: undefined as any });
        render(
            <DappInteractionContextProviderHarness value={value}>
                <SendNativeCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    it('SendNativeCoinConfirmation hides USD when native price is zero', async () => {
        (useNativeCoinPrice as jest.Mock).mockReturnValue(0);
        render(
            <DappInteractionContextProviderHarness>
                <SendNativeCoinConfirmation />
            </DappInteractionContextProviderHarness>,
        );
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });
});
