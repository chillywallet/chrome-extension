import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';

import LiquidStaking from '../../../../src/ui/pages/Earn/LiquidStaking';
import { EARN_LIST_ROUTE } from '../../../../src/shared/constants/routes';
import { useEarnData } from '../../../../src/ui/pages/Earn/EarnProvider';
import { useSelectedNetwork } from '../../../../src/store/selectors';

import { mockEarnItem } from './fixtures/earnFixtures';
import { PlatformId } from '../../../../src/shared/types/Chain';


const mockUseLiquidStaking = jest.fn();
jest.mock('../../../../src/ui/pages/Earn/LiquidStaking.hooks', () => ({
    __esModule: true,
    default: (data: unknown) => mockUseLiquidStaking(data),
}));

jest.mock('../../../../src/ui/components/AssetLogo', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../../src/ui/components/GasFee', () => ({
    __esModule: true,
    default: () => <div data-testid="gas-fee" />,
}));
jest.mock('../../../../src/ui/components/PercentageSlider', () => ({
    __esModule: true,
    default: ({ onValueChange, maxValue }: { onValueChange: (v: bigint) => void; maxValue: bigint }) => (
        <button type="button" data-testid="slider" onClick={() => onValueChange(maxValue)}>
            slide
        </button>
    ),
}));
jest.mock('../../../../src/ui/components/SwapSentModal', () => ({
    __esModule: true,
    default: () => null,
}));
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
            <span data-testid="header-title">{title}</span>
            <button type="button" data-testid="header-back" onClick={onBackPress}>
                back
            </button>
            {action}
        </div>
    ),
}));

jest.mock('../../../../src/ui/pages/Earn/EarnProvider', () => ({
    ...jest.requireActual('../../../../src/ui/pages/Earn/EarnProvider'),
    useEarnData: jest.fn(),
}));

jest.mock('../../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../../src/store/selectors'),
    useSelectedNetwork: jest.fn(),
}));

function hookDefaults(overrides: Record<string, unknown> = {}) {
    return {
        formattedFromValue: 1,
        fromPrice: 2,
        fromValue: '1',
        fromUSDValue: '2',
        loadingFromPrice: false,
        loadingFromCoinData: false,
        fromBalance: 100n,
        toValue: 1,
        toPrice: 1,
        loadingToCoinData: false,
        error: '',
        inputMode: 'coin' as const,
        handleOnFromUSDValueChange: jest.fn(),
        handleOnFromValueChange: jest.fn(),
        onStakePress: jest.fn(),
        onClaimPress: jest.fn(),
        onRequestUnstakePress: jest.fn(),
        onUnstakePress: jest.fn(),
        onChangeInputModePress: jest.fn(),
        loadingGasLimit: false,
        onSliderValueChange: jest.fn(),
        fromValueBigInt: 1n,
        currentGasLimit: 21000,
        setHandledGasData: jest.fn(),
        exchangeRate: 1,
        loadingExchangeRate: false,
        txtData: undefined,
        swapSentSheetVisible: false,
        onSwapSentClose: jest.fn(),
        onTryAgainPress: jest.fn(),
        onSwapSuccess: jest.fn(),
        setTxtData: jest.fn(),
        onChangeModePress: jest.fn(),
        mode: 'Stake' as const,
        fromCoin: mockEarnItem.fromCoin,
        toCoin: mockEarnItem.toCoin,
        loadingWaitTime: false,
        waitTime: 100,
        stakingProvider: { unlockRequired: false },
        confirmCalls: [],
        hasWaitTime: true,
        formattedFromBalance: 5,
        formattedToBalance: 5,
        ...overrides,
    };
}

describe('LiquidStaking', () => {
    const replace = jest.fn();

    beforeEach(() => {
        mockUseLiquidStaking.mockImplementation(() => hookDefaults());
        jest.mocked(useEarnData).mockReturnValue({
            liquidStakingData: mockEarnItem,
            setLiquidStakingData: jest.fn(),
            liquidStakingClaimData: undefined,
            setLiquidStakingClaimData: jest.fn(),
            yieldData: undefined,
            setYieldData: jest.fn(),
        });
        jest.mocked(useSelectedNetwork).mockReturnValue({
            chain_id: 1,
            platform_id: PlatformId.MonadTestnet,
            chain_key: 'monad_testnet',
            testnet: true,
        } as never);
        replace.mockClear();
    });

    function setup() {
        const history = createMemoryHistory({ initialEntries: ['/earn/liquid-staking'] });
        jest.spyOn(history, 'replace').mockImplementation(replace);
        return render(
            <Router history={history}>
                <LiquidStaking />
            </Router>,
        );
    }

    it('redirects to earn list when liquid staking data missing', () => {
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

    it('shows stake layout and toggles mode controls', async () => {
        const onChangeModePress = jest.fn();
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({ onChangeModePress, mode: 'Stake' }),
        );

        setup();

        expect(screen.getByTestId('header-title')).toHaveTextContent(`Stake ${mockEarnItem.name}`);

        await userEvent.click(screen.getByRole('button', { name: 'Unstake' }));
        expect(onChangeModePress).toHaveBeenCalledWith('Unstake');

        await userEvent.click(screen.getByTestId('header-back'));
        expect(replace).toHaveBeenCalledWith(EARN_LIST_ROUTE);
    });

    it('unstake with unlockRequired shows request withdrawal and claim', async () => {
        const onRequestUnstakePress = jest.fn();
        const onClaimPress = jest.fn();
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({
                mode: 'Unstake',
                stakingProvider: { unlockRequired: true },
                onRequestUnstakePress,
                onClaimPress,
            }),
        );

        setup();

        await userEvent.click(screen.getByRole('button', { name: 'Request Withdrawal' }));
        expect(onRequestUnstakePress).toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: 'Go To Claim' }));
        expect(onClaimPress).toHaveBeenCalled();
    });

    it('Stake header button calls onChangeModePress with Stake', async () => {
        const onChangeModePress = jest.fn();
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({ onChangeModePress, mode: 'Unstake' }),
        );
        setup();
        await userEvent.click(screen.getByRole('button', { name: 'Stake' }));
        expect(onChangeModePress).toHaveBeenCalledWith('Stake');
    });

    it('middle swap arrow toggles to Unstake from Stake mode', async () => {
        const onChangeModePress = jest.fn();
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({ onChangeModePress, mode: 'Stake' }),
        );
        setup();
        const swapButtons = screen.getAllByRole('button').filter(b =>
            b.className.includes('rounded-full'),
        );
        await userEvent.click(swapButtons[0]);
        expect(onChangeModePress).toHaveBeenCalledWith('Unstake');
    });

    it('middle swap arrow toggles to Stake from Unstake mode', async () => {
        const onChangeModePress = jest.fn();
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({ onChangeModePress, mode: 'Unstake' }),
        );
        setup();
        const swapButtons = screen.getAllByRole('button').filter(b =>
            b.className.includes('rounded-full'),
        );
        await userEvent.click(swapButtons[0]);
        expect(onChangeModePress).toHaveBeenCalledWith('Stake');
    });

    it('coin input change calls handleOnFromValueChange', async () => {
        const handleOnFromValueChange = jest.fn();
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({
                handleOnFromValueChange,
                inputMode: 'coin',
                fromValue: '',
            }),
        );
        setup();
        const input = screen.getByPlaceholderText('0.00');
        await userEvent.type(input, '1');
        expect(handleOnFromValueChange).toHaveBeenCalled();
    });

    it('USD input change calls handleOnFromUSDValueChange', async () => {
        const handleOnFromUSDValueChange = jest.fn();
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({
                handleOnFromUSDValueChange,
                inputMode: 'usd',
                fromUSDValue: '',
            }),
        );
        setup();
        const input = screen.getByPlaceholderText('0.00');
        await userEvent.type(input, '5');
        expect(handleOnFromUSDValueChange).toHaveBeenCalled();
    });

    it('displays the loading-from-price placeholders on non-testnet networks', () => {
        jest.mocked(useSelectedNetwork).mockReturnValue({
            chain_id: 1,
            platform_id: PlatformId.MonadTestnet,
            chain_key: 'monad_testnet',
            testnet: false,
        } as never);
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({ loadingFromPrice: true }),
        );
        const { container } = setup();
        // Two placeholder rectangles render: one near the price toggle, one in the separator.
        expect(container.querySelectorAll('.bg-placeholder').length).toBeGreaterThan(0);
    });

    it('shows the price-swap affordance on mainnet and triggers onChangeInputModePress', async () => {
        const onChangeInputModePress = jest.fn();
        jest.mocked(useSelectedNetwork).mockReturnValue({
            chain_id: 1,
            platform_id: PlatformId.MonadTestnet,
            chain_key: 'monad_testnet',
            testnet: false,
        } as never);
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({
                onChangeInputModePress,
                loadingFromPrice: false,
                fromValue: '2',
                fromPrice: 3,
            }),
        );
        const { container } = setup();
        const priceToggle = container.querySelector('.bg-primary.text-white.cursor-pointer');
        expect(priceToggle).not.toBeNull();
        await userEvent.click(priceToggle as Element);
        expect(onChangeInputModePress).toHaveBeenCalled();
    });

    it('USD mode shows formatted from value with the coin symbol', () => {
        jest.mocked(useSelectedNetwork).mockReturnValue({
            chain_id: 1,
            platform_id: PlatformId.MonadTestnet,
            chain_key: 'monad_testnet',
            testnet: false,
        } as never);
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({
                inputMode: 'usd',
                fromUSDValue: '12',
                formattedFromValue: 0.5,
            }),
        );
        setup();
        // The swap affordance label reads "{formattedFromValue} {fromCoin.symbol}".
        expect(screen.getByText(/0\.5/)).toBeInTheDocument();
    });

    it('shows the wait time row only in Unstake when waitTime is positive', () => {
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({
                mode: 'Unstake',
                hasWaitTime: true,
                waitTime: 600,
                stakingProvider: { unlockRequired: true },
            }),
        );
        setup();
        expect(screen.getByText(/Wait time/)).toBeInTheDocument();
    });

    it('renders error and disables the action button when error is non-empty', () => {
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({ error: 'Boom error', formattedFromValue: 0 }),
        );
        setup();
        expect(screen.getByText('Boom error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'STAKE' })).toBeDisabled();
    });

    it('clicking STAKE when no error invokes onStakePress', async () => {
        const onStakePress = jest.fn();
        mockUseLiquidStaking.mockImplementation(() => hookDefaults({ onStakePress }));
        setup();
        await userEvent.click(screen.getByRole('button', { name: 'STAKE' }));
        expect(onStakePress).toHaveBeenCalled();
    });

    it('UNSTAKE label appears when unlock is not required and triggers onUnstakePress', async () => {
        const onUnstakePress = jest.fn();
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({
                mode: 'Unstake',
                stakingProvider: { unlockRequired: false },
                onUnstakePress,
            }),
        );
        setup();
        await userEvent.click(screen.getByRole('button', { name: 'UNSTAKE' }));
        expect(onUnstakePress).toHaveBeenCalled();
        // No Go To Claim should be rendered when unlockRequired is false.
        expect(screen.queryByRole('button', { name: 'Go To Claim' })).not.toBeInTheDocument();
    });

    it('renders the powered-by partner image when partner has an imageUrl', () => {
        // Find an EARN_PARTNER that has an imageUrl
        const { EARN_PARTNERS } = jest.requireActual('../../../../src/shared/types/Earn');
        const withImage = EARN_PARTNERS.find((p: any) => p.imageUrl) ?? EARN_PARTNERS[0];
        jest.mocked(useEarnData).mockReturnValue({
            liquidStakingData: { ...mockEarnItem, partner_name: withImage.name },
            setLiquidStakingData: jest.fn(),
            liquidStakingClaimData: undefined,
            setLiquidStakingClaimData: jest.fn(),
            yieldData: undefined,
            setYieldData: jest.fn(),
        });
        const { container } = setup();
        // Image renders inline alongside the name.
        const imgs = container.querySelectorAll('img');
        const hasPartnerImg = Array.from(imgs).some(
            i => i.getAttribute('src') === withImage.imageUrl,
        );
        expect(hasPartnerImg).toBe(true);
    });

    it('updates input value via the percentage slider in coin mode', async () => {
        const onSliderValueChange = jest.fn();
        mockUseLiquidStaking.mockImplementation(() => hookDefaults({ onSliderValueChange }));
        setup();
        await userEvent.click(screen.getByTestId('slider'));
        expect(onSliderValueChange).toHaveBeenCalled();
    });

    it('shows the toCoin loading placeholder when the to-coin data is still loading', () => {
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({ loadingToCoinData: true }),
        );
        const { container } = setup();
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('shows the exchange rate loading placeholder when loadingExchangeRate', () => {
        mockUseLiquidStaking.mockImplementation(() =>
            hookDefaults({ loadingExchangeRate: true }),
        );
        const { container } = setup();
        // exchange-rate row should not render the formatted "1 FROM = ..." text.
        expect(screen.queryByText(/1 .* = .*/)).not.toBeInTheDocument();
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
});
