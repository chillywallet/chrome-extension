import { formatMoney, formatNumber } from '../../../shared/utils/format';
import { formatUnits, getAddress } from 'ethers';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { MdOutlineSwapVert } from 'react-icons/md';
import { Link, useHistory } from 'react-router-dom';
import CoinsUtils from '../../../lib/CoinsUtils';
import { handleGasPrice, safeParseUnits } from '../../../lib/WalletUtils';
import { DEFAULT_ROUTE } from '../../../shared/constants/routes';
import { UPDATE_GAS_INTERVAL } from '../../../shared/constants/swap';
import ErrorMessages from '../../../shared/messages/ErrorMessages';
import { GasPriceType } from '../../../shared/types/Chain';
import { Coin, GasType, Receiver } from '../../../shared/types/Wallet';
import logger from '../../../shared/utils/logger';
import { getTokenBalance, loadGasOptions, setCoinPrices } from '../../../store/actions/uiActions';
import {
    useCurrentAddress,
    useGasInfo,
    useIsTestnet,
    useSelectedNetwork,
} from '../../../store/selectors';
import { useAppDispatch } from '../../../store/store';
import AssetLogo from '../../components/AssetLogo';
import EmojiView from '../../components/EmojiView';
import Header from '../../components/Header';
import PercentageSlider from '../../components/PercentageSlider';
import TextTruncate from '../../components/TextTruncate';
import WalletTag from '../../components/WalletTag';

type Props = {
    coin: Coin;
    isAAWallet: boolean;
    receiver: Receiver | null;
    goToNextStep: (data: {
        value: bigint;
        usdValue?: number;
        balance: bigint;
        decimals: number;
    }) => void;
};

// Validation utilities
const isEmpty = (value: string) => {
    return !value || value.trim() === '';
};

const isFloat = (value: string) => {
    const handledValue = value.split(',').join('.');
    return !isNaN(parseFloat(handledValue)) && isFinite(parseFloat(handledValue));
};

const HARDCODED_GAS_LIMIT = 24_000;

export default React.memo<Props>((props: Props) => {
    const { coin, isAAWallet, receiver, goToNextStep } = props;
    const history = useHistory();
    const dispatch = useAppDispatch();
    const selectedNetwork = useSelectedNetwork();
    const isTestnet = useIsTestnet();
    const currentAddress = useCurrentAddress(isAAWallet);
    const { gasOptionsData, gasType, customGas } = useGasInfo(selectedNetwork.chain_id);

    const [coinValue, setCoinValue] = useState<string>('');
    const [mode, setMode] = useState<'coin' | 'usd'>('coin');
    const [usdValue, setUsdValue] = useState('');
    const [coinValueBigInt, setCoinValueBigInt] = useState<bigint>(0n);
    const [coinPriceData, setCoinPriceData] = useState<{
        coinPrice: number;
        loading: boolean;
    }>({
        coinPrice: 0,
        loading: true,
    });
    const [balanceData, setBalanceData] = useState<{
        balance: bigint;
        decimals: number;
        loading: boolean;
    }>({
        balance: 0n,
        decimals: 18,
        loading: true,
    });
    const [coinValueValid, setCoinValueValid] = useState(true);

    const { walletAddress, name, avatar } = receiver ?? {};

    const checksumAddress = useMemo(() => {
        try {
            return getAddress(walletAddress ?? '');
        } catch (error) {
            return walletAddress ?? '';
        }
    }, [walletAddress]);

    const formattedBalance = useMemo(() => {
        if (balanceData.loading) {
            return 0;
        }
        // Convert bigint to number for display
        return parseFloat(formatUnits(balanceData.balance, balanceData.decimals));
    }, [balanceData]);

    const formattedCoinValue = useMemo(() => {
        if (coinValueBigInt === 0n) {
            return 0;
        }
        return parseFloat(formatUnits(coinValueBigInt, balanceData.decimals));
    }, [coinValueBigInt, balanceData.decimals]);

    const ready = useMemo(() => {
        return !balanceData.loading && (!coinPriceData.loading || isTestnet);
    }, [balanceData.loading, coinPriceData.loading, isTestnet]);

    const isNativeCoin = useMemo(() => {
        return (
            selectedNetwork.native_coin_address.toLowerCase() === coin.token_address.toLowerCase()
        );
    }, [coin, selectedNetwork]);

    const gasPrice = useMemo(() => {
        const handledGasData = handleGasPrice(
            gasOptionsData,
            gasType,
            customGas,
            selectedNetwork.gasPriceType ?? GasPriceType.BaseAndPriority,
            undefined,
        );

        return handledGasData.gasPrice;
    }, [gasOptionsData, gasType, customGas, selectedNetwork.gasPriceType]);

    const maxSendable = useMemo(() => {
        const hardcodedGasFee = gasPrice * BigInt(HARDCODED_GAS_LIMIT);
        return isNativeCoin
            ? balanceData.balance > hardcodedGasFee
                ? balanceData.balance - hardcodedGasFee
                : 0n
            : balanceData.balance;
    }, [isNativeCoin, gasPrice, balanceData.balance]);

    const errorMessage = useMemo(() => {
        if (!balanceData.loading && balanceData.balance > 0n && coinValueBigInt > 0n) {
            if (coinValueBigInt > balanceData.balance) {
                return ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT;
            }
        }

        return '';
    }, [coinValueBigInt, balanceData]);

    const buttonDisabled = useMemo(() => {
        if (!coinValue || !coinValue.trim() || errorMessage || !coinValueValid || !ready) {
            return true;
        }

        const handledValue = coinValue.replace(',', '.');
        return parseFloat(handledValue) <= 0;
    }, [coinValue, errorMessage, coinValueValid, ready]);

    const loadCoinPrice = useCallback(() => {
        setCoinPriceData({ coinPrice: 0, loading: true });
        CoinsUtils.getCoinsByTokenAddresses(selectedNetwork.platform_id, [coin.token_address])
            .then(result => {
                const key = coin.token_address.toLowerCase();
                const _price = result[key]?.usdPrice ?? 0;
                setCoinPriceData({ coinPrice: _price, loading: false });

                if (Object.keys(result).length > 0) {
                    void dispatch(setCoinPrices(selectedNetwork.platform_id, result));
                }
            })
            .catch(() => {
                setCoinPriceData({ coinPrice: 0, loading: false });
            });
    }, [coin.token_address, dispatch, selectedNetwork.platform_id]);

    const goToConfirmationPage = useCallback(() => {
        let nextData;
        if (coinPriceData.loading) {
            nextData = {
                value: coinValueBigInt,
                balance: balanceData.balance,
                decimals: balanceData.decimals,
            };
        } else {
            nextData = {
                value: coinValueBigInt,
                usdValue: formattedCoinValue * coinPriceData.coinPrice,
                balance: balanceData.balance,
                decimals: balanceData.decimals,
            };
        }

        logger.info('🟢 Send Coin', nextData);
        goToNextStep(nextData);
    }, [
        coinPriceData.loading,
        coinPriceData.coinPrice,
        goToNextStep,
        coinValueBigInt,
        balanceData.balance,
        balanceData.decimals,
        formattedCoinValue,
    ]);

    const onCoinValueChange = useCallback(
        (text: string) => {
            const _text = text.replace(/^0+([0-9]+)/, '$1');
            setCoinValue(_text);

            const amount = safeParseUnits(_text, balanceData.decimals);
            setCoinValueBigInt(amount);

            const handledValue = _text.replace(',', '.');
            const _usdValue = parseFloat(handledValue);

            if (isNaN(_usdValue)) {
                setUsdValue('0');
            } else {
                setUsdValue(_usdValue * coinPriceData.coinPrice + '');
            }
        },
        [coinPriceData.coinPrice, balanceData],
    );

    const onUSDValueChange = useCallback(
        (text: string) => {
            const _text = text.replace(/^0+([0-9]+)/, '$1');
            setUsdValue(_text);
            const handledValue = _text.replace(',', '.');
            const number = parseFloat(handledValue);

            if (coinPriceData.coinPrice && number) {
                let formattedValue;

                if (number < 1) {
                    formattedValue = formatNumber(number / coinPriceData.coinPrice, {
                        locale: 'en-US',
                        subscript: false,
                    });
                } else {
                    formattedValue = (number / coinPriceData.coinPrice).toFixed(6);
                }

                setCoinValue(formattedValue);
                const amount = safeParseUnits(formattedValue, balanceData.decimals);
                setCoinValueBigInt(amount);
            } else {
                setCoinValue('0');
            }
        },
        [balanceData.decimals, coinPriceData.coinPrice],
    );

    const onSliderValueChange = useCallback(
        (_value: bigint) => {
            if (!balanceData.loading && balanceData.balance > 0n) {
                const result = formatUnits(_value, balanceData.decimals);
                onCoinValueChange(result);
            }
        },
        [balanceData, onCoinValueChange],
    );

    useEffect(() => {
        if (mode === 'coin') {
            const handledValue = coinValue.split(',').join('.');

            if (!isEmpty(handledValue)) {
                if (isFloat(handledValue)) {
                    setCoinValueValid(true);
                } else {
                    setCoinValueValid(false);
                }
            } else {
                setCoinValueValid(true);
            }
        }
    }, [coinValue, mode]);

    useEffect(() => {
        if (mode === 'usd') {
            const handledValue = usdValue.split(',').join('.');

            if (!isEmpty(handledValue)) {
                if (isFloat(handledValue)) {
                    setCoinValueValid(true);
                } else {
                    setCoinValueValid(false);
                }
            } else {
                setCoinValueValid(true);
            }
        }
    }, [usdValue, mode]);

    useEffect(() => {
        if (currentAddress) {
            setBalanceData({ balance: 0n, decimals: 18, loading: true });
            getTokenBalance(currentAddress, coin.token_address, isNativeCoin).then(
                ({ balance: balanceResult, decimals, error: err }) => {
                    if (!err) {
                        setBalanceData({ balance: balanceResult, decimals, loading: false });
                        coin.decimals = decimals;
                    } else {
                        setBalanceData({ balance: 0n, decimals: 18, loading: false });
                    }
                },
            );
        }
    }, [currentAddress, selectedNetwork, coin, isNativeCoin]);

    useEffect(() => {
        if (!isTestnet) {
            loadCoinPrice();
        }
    }, [loadCoinPrice, isTestnet]);

    // Refresh gas options periodically (same pattern as chilly-fe)
    useEffect(() => {
        const refreshGasOptions = () => {
            if (gasType !== GasType.Custom) {
                try {
                    dispatch(loadGasOptions(selectedNetwork.chain_key));
                } catch (error) {
                    // silently ignore
                }
            }
        };

        refreshGasOptions();
        const interval = setInterval(refreshGasOptions, UPDATE_GAS_INTERVAL);
        return () => clearInterval(interval);
    }, [dispatch, gasType, selectedNetwork.chain_key]);

    return (
        <div className="flex flex-col h-full">
            <Header title="Send Amount" action={<WalletTag isAAWallet={isAAWallet} />} />

            <div className="flex flex-col flex-1 p-5 min-h-[400px]">
                <div className="flex-1">
                    <div className="flex flex-row items-center w-full text-sm px-3 py-3 mb-3 border border-slate-200 dark:border-darkline rounded-md">
                        <div className="shrink-0">
                            <EmojiView
                                emoji={avatar}
                                walletAddress={walletAddress}
                                width={32}
                                emojiSize={12}
                            />
                        </div>
                        <div className="ml-3 text-left flex-1">
                            <TextTruncate
                                className="whitespace-nowrap max-w-[200px]"
                                text={name ?? 'Unknown'}
                                position="end"
                            />
                            <TextTruncate
                                className="text-gray-400 whitespace-nowrap w-[200px]"
                                text={checksumAddress}
                                position="middle"
                            />
                        </div>
                        <div className="px-2 shrink-0">
                            <Link
                                to="#"
                                onClick={e => {
                                    e.preventDefault();
                                    history.goBack();
                                }}>
                                <FaTimes />
                            </Link>
                        </div>
                    </div>

                    <div className="w-full text-sm py-3 border border-slate-200 dark:border-darkline rounded-md">
                        <div className="mb-1 px-3">Asset</div>
                        <div className="flex flex-row items-center w-full px-3">
                            <AssetLogo
                                src={(coin.icon ? coin.icon : coin.logo) ?? undefined}
                                platform_id={coin.platform_id}
                                width={36}
                            />
                            <div className="flex-1 text-left ml-3">
                                <p className="text-sm font-semibold">{coin.coin_name}</p>
                                <p className="text-sm text-gray-400">{coin.symbol}</p>
                            </div>
                            {ready ? (
                                <div className="text-right">
                                    <p className="text-sm font-semibold">
                                        {formatNumber(formattedBalance)}
                                    </p>
                                    {!coinPriceData.loading &&
                                    !isTestnet &&
                                    coinPriceData.coinPrice > 0 ? (
                                        <p className="text-sm text-gray-400">
                                            {formatMoney(
                                                coinPriceData.coinPrice * formattedBalance,
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="flex flex-col text-right items-end">
                                    <p className="animate-pulse bg-placeholder h-3 w-14 mb-1 rounded-md"></p>
                                    <p className="animate-pulse bg-placeholder h-3 w-20 rounded-md"></p>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-100 dark:bg-darkline/40 my-3 h-[1px]" />

                        <div className="mb-1 px-3">Amount</div>
                        <div className="flex flex-row items-center w-full px-3">
                            <div className="flex-1 flex flex-col w-full">
                                <PercentageSlider
                                    className="w-[180px]"
                                    onValueChange={onSliderValueChange}
                                    value={coinValueBigInt}
                                    maxValue={maxSendable}
                                    disabled={!ready}
                                />
                                <div className="flex flex-row items-center mb-1">
                                    {mode === 'usd' && (
                                        <p className="text-sm text-gray-400 mr-2">$</p>
                                    )}
                                    <input
                                        type="text"
                                        placeholder="0.00"
                                        autoFocus
                                        value={mode === 'coin' ? coinValue : usdValue}
                                        onChange={e =>
                                            mode === 'coin'
                                                ? onCoinValueChange(e.target.value)
                                                : onUSDValueChange(e.target.value)
                                        }
                                        className={`h-9 border-2 rounded-xl px-3 text-sm tabular-nums focus:outline-none transition-colors ${
                                            coinValueValid
                                                ? 'border-slate-200 dark:border-darkline focus:border-primary dark:focus:border-accent'
                                                : 'border-red-500 focus:border-red-500'
                                        } bg-white dark:bg-white/5`}
                                    />
                                    {mode === 'coin' && (
                                        <p className="text-sm text-gray-400 ml-2 truncate flex-1">
                                            {coin.symbol}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-row items-center">
                                    {!coinPriceData.loading &&
                                        !isTestnet &&
                                        coinPriceData.coinPrice > 0 &&
                                        (mode === 'coin' ? (
                                            <div className="text-sm mr-2">
                                                {formatMoney(Number(usdValue))}
                                            </div>
                                        ) : (
                                            <div className="text-sm mr-2">
                                                {formatNumber(Number(coinValue))} {coin.symbol}
                                            </div>
                                        ))}
                                </div>
                            </div>
                            {!coinPriceData.loading &&
                                !isTestnet &&
                                coinPriceData.coinPrice > 0 && (
                                    <button
                                        disabled={!ready}
                                        className="text-right cursor-pointer"
                                        onClick={e => {
                                            e.preventDefault();
                                            setMode(mode === 'coin' ? 'usd' : 'coin');
                                        }}>
                                        <MdOutlineSwapVert className="text-xl" />
                                    </button>
                                )}
                        </div>
                    </div>
                </div>
                {errorMessage ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                        <div className="text-red-600 dark:text-red-400 text-sm text-center">
                            {errorMessage}
                        </div>
                    </div>
                ) : null}
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <button
                            className="btn w-full"
                            onClick={e => {
                                e.preventDefault();
                                history.replace(DEFAULT_ROUTE);
                            }}>
                            Cancel
                        </button>
                    </div>
                    <div>
                        <button
                            disabled={buttonDisabled}
                            className="btn btn-primary w-full"
                            onClick={goToConfirmationPage}>
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
