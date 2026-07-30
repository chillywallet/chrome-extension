/* eslint-disable jsx-a11y/alt-text */
import { formatMoney, formatNumber } from '../../../shared/utils/format';
import moment from 'moment';
import React, { useEffect, useMemo } from 'react';
import { FaWallet } from 'react-icons/fa';
import { MdOutlineSwapVert } from 'react-icons/md';
import { PiArrowsVerticalBold } from 'react-icons/pi';
import { useHistory } from 'react-router-dom';
import { EARN_LIST_ROUTE } from '../../../shared/constants/routes';
import { PlatformId } from '../../../shared/types/Chain';
import { EARN_PARTNERS, EarnItem, EarnType } from '../../../shared/types/Earn';
import { useSelectedNetwork } from '../../../store/selectors';
import AssetLogo from '../../components/AssetLogo';
import GasFee from '../../components/GasFee';
import Header from '../../components/Header';
import PercentageSlider from '../../components/PercentageSlider';
import SwapSentModal from '../../components/SwapSentModal';
import { useEarnData } from './EarnProvider';
import useLiquidStaking from './LiquidStaking.hooks';

type Props = {};

const DEFAULT_VALUE: EarnItem = {
    type: EarnType.aPriori,
    name: '',
    description: '',
    fromCoin: { name: '', symbol: '', imageUrl: '', tokenAddress: '', decimals: 18 },
    toCoin: { name: '', symbol: '', imageUrl: '', tokenAddress: '', decimals: 18 },
    partner_name: '',
    platformId: PlatformId.MonadTestnet,
    requestsMerged: true,
};

const LiquidStaking = React.memo<Props>((props: Props) => {
    const { liquidStakingData: data } = useEarnData();
    const { partner_name } = data ?? {};
    const selectedNetwork = useSelectedNetwork();

    const partner = useMemo(() => {
        return EARN_PARTNERS.find(p => p.name === partner_name);
    }, [partner_name]);

    const history = useHistory();

    const {
        formattedFromValue,
        fromPrice,
        fromValue,
        fromUSDValue,
        loadingFromPrice,
        loadingFromCoinData,
        fromBalance,
        toValue,
        toPrice,
        loadingToCoinData,
        error,
        inputMode,
        handleOnFromUSDValueChange,
        handleOnFromValueChange,
        onStakePress,
        onClaimPress,
        onRequestUnstakePress,
        onChangeInputModePress,
        loadingGasLimit,
        onSliderValueChange,
        fromValueBigInt,
        currentGasLimit,
        setHandledGasData,
        exchangeRate,
        loadingExchangeRate,
        txtData,
        swapSentSheetVisible,
        onSwapSentClose,
        onTryAgainPress,
        onSwapSuccess,
        setTxtData,
        onChangeModePress,
        mode,
        fromCoin,
        toCoin,
        loadingWaitTime,
        waitTime,
        stakingProvider,
        onUnstakePress,
        confirmCalls,
        hasWaitTime,
        formattedFromBalance,
        formattedToBalance,
    } = useLiquidStaking(data ?? DEFAULT_VALUE);

    useEffect(() => {
        if (!data) {
            history.replace(EARN_LIST_ROUTE);
        }
    }, [data, history]);

    return (
        <div className="flex flex-col h-full min-h-[400px] relative">
            <Header
                title={`${mode} ${data?.name ?? ''}`}
                onBackPress={() => {
                    history.replace(EARN_LIST_ROUTE);
                }}
                action={
                    <div className="flex flex-row items-center rounded-lg overflow-hidden text-sm">
                        <button
                            onClick={() => {
                                onChangeModePress('Stake');
                            }}
                            className={
                                'px-2 py-1 h-[32px] w-[70px] ' +
                                (mode === 'Stake'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-slate-200 text-black')
                            }>
                            Stake
                        </button>
                        <button
                            onClick={() => {
                                onChangeModePress('Unstake');
                            }}
                            className={
                                'px-2 py-1 h-[32px] w-[70px] ' +
                                (mode === 'Unstake'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-slate-200 text-black')
                            }>
                            Unstake
                        </button>
                    </div>
                }
            />

            <div className="flex flex-col flex-1 p-5 overflow-auto">
                <div className="flex items-center justify-between space-x-4">
                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-black font-semibold dark:text-white">
                            You are {mode === 'Stake' ? 'staking' : 'unstaking'}
                        </p>
                        <div className="flex items-center gap-2 text-black dark:text-white">
                            <AssetLogo
                                src={fromCoin.imageUrl}
                                platform_id={selectedNetwork.platform_id}
                                width={34}
                            />
                            <span>{fromCoin.symbol}</span>
                        </div>
                        <p className="text-xs text-gray-500">{fromCoin.name}</p>
                    </div>

                    <div className="w-[180px]">
                        <div>
                            {loadingFromCoinData ? (
                                <div className="flex flex-row items-center gap-2 justify-end">
                                    <p className="text-righ animate-pulse bg-placeholder h-3 w-24 mb-1 rounded-md"></p>
                                </div>
                            ) : (
                                <div className="flex flex-row items-center gap-2 justify-end text-gray-500">
                                    <FaWallet className="text-xs" />
                                    <span className="text-xs">
                                        {formatNumber(formattedFromBalance)} {fromCoin?.symbol}
                                    </span>
                                </div>
                            )}

                            <PercentageSlider
                                className="mt-2"
                                onValueChange={onSliderValueChange}
                                value={fromValueBigInt}
                                maxValue={fromBalance}
                                disabled={loadingFromCoinData}
                            />

                            <div className="w-full flex flex-row items-center border border-primary rounded-md dark:bg-dark focus-within:border-primary overflow-hidden mb-2">
                                <input
                                    type="text"
                                    value={inputMode === 'coin' ? fromValue : fromUSDValue}
                                    onChange={e =>
                                        inputMode === 'coin'
                                            ? handleOnFromValueChange(e.target.value)
                                            : handleOnFromUSDValueChange(e.target.value)
                                    }
                                    className={
                                        'h-9 px-2 bg-transparent border-0 text-lg focus:outline-none ' +
                                        (inputMode === 'coin'
                                            ? 'text-left w-[180px]'
                                            : 'text-right w-[160px]')
                                    }
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="flex flex-row justify-end">
                                {!selectedNetwork?.testnet &&
                                    (loadingFromPrice ? (
                                        <div className="w-20 h-6 animate-pulse bg-placeholder rounded"></div>
                                    ) : (
                                        <div
                                            className="flex flex-row items-center bg-primary text-white cursor-pointer rounded-md px-2 py-1 gap-1"
                                            onClick={onChangeInputModePress}>
                                            <div className="text-xs">
                                                {inputMode === 'coin'
                                                    ? formatMoney(Number(fromValue) * fromPrice)
                                                    : `${formatNumber(formattedFromValue)} ${
                                                          fromCoin.symbol
                                                      }`}
                                            </div>
                                            <MdOutlineSwapVert />
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Separator */}
                {loadingFromPrice ? (
                    <div className="flex items-center justify-center space-x-2">
                        <div className="w-full h-px bg-slate-200 dark:bg-darkline/60"></div>
                        <div className="h-8 w-8 shrink-0 animate-pulse bg-placeholder rounded-full"></div>
                        <div className="w-full h-px bg-slate-200 dark:bg-darkline/60"></div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center space-x-2">
                        <div className="w-full h-px bg-slate-200 dark:bg-darkline/60"></div>
                        <button
                            onClick={() =>
                                onChangeModePress(mode === 'Stake' ? 'Unstake' : 'Stake')
                            }
                            className="p-2 border border-primary rounded-full text-primary">
                            <PiArrowsVerticalBold />
                        </button>
                        <div className="w-full h-px bg-slate-200 dark:bg-darkline/60"></div>
                    </div>
                )}

                <div className="flex items-center justify-between space-x-4 mb-3">
                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-black font-semibold dark:text-white">To get</p>
                        <div className="flex items-center space-x-2 text-black dark:text-white">
                            <AssetLogo
                                src={toCoin.imageUrl}
                                platform_id={selectedNetwork.platform_id}
                                width={34}
                            />
                            <span>{toCoin?.symbol || 'Select'}</span>
                        </div>
                        <p className="text-xs text-gray-500">{toCoin.name}</p>
                    </div>

                    <div className="w-[180px]">
                        <div>
                            {loadingToCoinData ? (
                                <div className="flex flex-row items-center gap-2 justify-end">
                                    <p className="text-righ animate-pulse bg-placeholder h-3 w-24 mb-1 rounded-md"></p>
                                </div>
                            ) : (
                                <div className="flex flex-row items-center gap-2 justify-end text-gray-500">
                                    <FaWallet className="text-xs" />
                                    <span className="text-xs">
                                        {formatNumber(formattedToBalance)} {toCoin?.symbol}
                                    </span>
                                </div>
                            )}

                            <div className="flex flex-row justify-end text-lg">
                                {formatNumber(toValue)}
                            </div>

                            <div className="flex flex-row justify-end text-gray-500">
                                {!selectedNetwork?.testnet && (
                                    <div className="text-xs">{formatMoney(toValue * toPrice)}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-row justify-between mt-3 text-sm">
                    <p className="text-slate-500 dark:text-white">Exchange rate</p>
                    {loadingExchangeRate ? (
                        <div className="w-[130px] h-5 bg-placeholder animate-pulse rounded-md" />
                    ) : (
                        <p className="font-medium">
                            1 {fromCoin.symbol} = {formatNumber(exchangeRate)} {toCoin.symbol}
                        </p>
                    )}
                </div>

                {mode === 'Unstake' && hasWaitTime && waitTime > 0 && (
                    <div className="flex flex-row justify-between text-sm mt-1">
                        <p className="text-slate-500 dark:text-white">Wait time</p>
                        {loadingWaitTime ? (
                            <div className="w-[90px] h-5 bg-placeholder animate-pulse rounded-md" />
                        ) : (
                            <p className="font-medium">
                                {moment.duration(waitTime, 'second').humanize()}
                            </p>
                        )}
                    </div>
                )}

                <GasFee
                    className="mt-5"
                    isLoading={loadingGasLimit}
                    gasLimit={currentGasLimit}
                    onGasChange={setHandledGasData}
                    calls={confirmCalls}
                />

                {error && <p className="text-red-500 mt-2">{error}</p>}

                <button
                    className="btn btn-primary mt-3 w-full"
                    onClick={
                        mode === 'Stake'
                            ? onStakePress
                            : stakingProvider?.unlockRequired
                            ? onRequestUnstakePress
                            : onUnstakePress
                    }
                    disabled={
                        !!error || formattedFromValue <= 0 || loadingGasLimit || loadingExchangeRate
                    }>
                    {mode === 'Stake'
                        ? 'STAKE'
                        : stakingProvider?.unlockRequired
                        ? 'Request Withdrawal'
                        : 'UNSTAKE'}
                </button>

                {mode === 'Unstake' && stakingProvider?.unlockRequired && (
                    <button className="btn mt-2 w-full" onClick={onClaimPress}>
                        Go To Claim
                    </button>
                )}

                <div className="mt-3 text-sm text-center text-black dark:text-white">
                    Powered by {partner?.name ?? ''}
                    {partner?.imageUrl && (
                        <img src={partner.imageUrl} className="inline-block ml-2 w-5 h-5" />
                    )}
                </div>
            </div>

            <SwapSentModal
                visible={swapSentSheetVisible}
                onCloseRequest={onSwapSentClose}
                onTryAgainPress={onTryAgainPress}
                txtData={txtData}
                onSwapSuccess={onSwapSuccess}
                setTxtData={setTxtData}
                network={selectedNetwork}
                successText={
                    mode === 'Unstake' && stakingProvider?.unlockRequired
                        ? `You’ve successfully requested a withdrawal. Your MON tokens will be available to claim in ${moment
                              .duration(waitTime, 'second')
                              .humanize()}.`
                        : undefined
                }
            />
        </div>
    );
});

export default LiquidStaking;
