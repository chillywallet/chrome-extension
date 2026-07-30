import { formatMoney, formatNumber } from '../../shared/utils/format';
import { formatEther } from 'ethers';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaInfoCircle, FaPencilAlt } from 'react-icons/fa';
import { MdOutlineSwapVert } from 'react-icons/md';
import CoinsUtils from '../../lib/CoinsUtils';
import { handleGasPrice } from '../../lib/WalletUtils';
import { UPDATE_GAS_INTERVAL } from '../../shared/constants/swap';
import ErrorMessages from '../../shared/messages/ErrorMessages';
import { GasPriceType } from '../../shared/types/Chain';
import EventType from '../../shared/types/EventType';
import { AccountCallInput } from '../../api/graphQL/Types';
import { GasInfo, GasType, HandledGasData } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import logger from '../../shared/utils/logger';
import { getTokenBalance, loadGasOptions } from '../../store/actions/uiActions';
import {
    useActualTheme,
    useCurrentAddress,
    useGasInfo,
    useIsTestnet,
    useNativeCoinPrice,
    useSelectedNetwork,
} from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import GasOptionModal from './GasOptionModal';

type Props = {
    gasLimit?: number;
    isLoading?: boolean;
    customGasFee?: bigint;
    customGasType?: GasType;
    suggestionGas?: GasInfo;
    onGasChange?: (gasData: HandledGasData, gasFee: bigint) => void;
    className?: string;
    border?: boolean;
    isAAWallet?: boolean;

    /** Calls being confirmed; used to account for value already being sent. */
    calls?: AccountCallInput[];
    /** Reports a fee-related problem (balance lookup failure, insufficient funds). */
    onError?: (message: string) => void;
    hardCodeGasLimit?: number;
};

type GasFeeData = {
    maxGasFee: bigint;
    estimatedGasFee: bigint;
    estimatedGasPrice: bigint;
};

export default React.memo<Props>((props: Props) => {
    const {
        onGasChange,
        gasLimit = 0,
        customGasFee,
        customGasType,
        suggestionGas,
        className = '',
        isLoading = false,
        border = true,
        isAAWallet = false,
        calls,
        onError,
    } = props;
    const dispatch = useAppDispatch();
    const selectedNetwork = useSelectedNetwork();
    const { gasType, gasOptionsData, customGas } = useGasInfo(selectedNetwork.chain_id);
    const isTestnet = useIsTestnet();
    const actualTheme = useActualTheme();
    const walletAddress = useCurrentAddress(isAAWallet);
    const nativeCoinPrice = useNativeCoinPrice();

    // Kept in a ref so the effects below don't re-run when the parent passes a new
    // inline callback on every render.
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const setError = useCallback((message: string) => {
        onErrorRef.current?.(message);
    }, []);

    const [showGasFee, setShowGasFee] = useState(false);
    const [currentGasType, setCurrentGasType] = useState<GasType>(
        customGasType ? customGasType : gasType,
    );
    const [gasFeeData, setGasFeeData] = useState<GasFeeData>({
        maxGasFee: 0n,
        estimatedGasFee: 0n,
        estimatedGasPrice: 0n,
    });
    const [totalFeeMode, setTotalFeeMode] = useState<'coin' | 'usd'>('usd');
    const [nativeCoinBalance, setNativeCoinBalance] = useState(0n);
    const [loadingNativeCoinBalance, setLoadingNativeCoinBalance] = useState(true);
    const [sendingBalance, setSendingBalance] = useState<bigint>(0n);

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    const loading = isLoading;

    const estimatedGasFeeFormatted = useMemo(() => {
        return parseFloat(formatEther(customGasFee ? customGasFee : gasFeeData.estimatedGasFee));
    }, [customGasFee, gasFeeData.estimatedGasFee]);

    const currentGasFee = useMemo(() => {
        return customGasFee ? customGasFee : gasFeeData.maxGasFee;
    }, [customGasFee, gasFeeData.maxGasFee]);

    const currentBaseFeeBigInt = useMemo(() => {
        if (!gasOptionsData?.currentBaseFee) {
            return 0n;
        }
        return typeof gasOptionsData.currentBaseFee === 'bigint'
            ? gasOptionsData.currentBaseFee
            : BigInt(gasOptionsData.currentBaseFee);
    }, [gasOptionsData?.currentBaseFee]);

    const disabled = useMemo(() => {
        return !currentGasFee || !!customGasType;
    }, [currentGasFee, customGasType]);

    const onTotalFeePress = useCallback(() => {
        setTotalFeeMode(totalFeeMode === 'usd' ? 'coin' : 'usd');
    }, [totalFeeMode]);

    const computeGasFeeData = useCallback(
        (params: { priorityFee?: bigint; maxGasFee: bigint; gasPrice: bigint }): GasFeeData => {
            const { priorityFee, maxGasFee, gasPrice } = params;

            if (
                selectedNetwork.gasPriceType === GasPriceType.BaseAndPriority &&
                currentBaseFeeBigInt
            ) {
                const estimatedGasPrice = currentBaseFeeBigInt + (priorityFee ?? 0n);
                const estimatedGasFee = estimatedGasPrice * BigInt(gasLimit);
                return {
                    maxGasFee,
                    estimatedGasFee,
                    estimatedGasPrice,
                };
            }

            return {
                maxGasFee,
                estimatedGasFee: maxGasFee,
                estimatedGasPrice: gasPrice,
            };
        },
        [selectedNetwork.gasPriceType, currentBaseFeeBigInt, gasLimit],
    );

    const fetchNativeCoinBalance = useCallback(() => {
        if (walletAddress) {
            setLoadingNativeCoinBalance(true);
            getTokenBalance(walletAddress, undefined, true).then(result => {
                setLoadingNativeCoinBalance(false);

                if (!result.error) {
                    setNativeCoinBalance(result.balance);
                } else {
                    setError('Failed to fetch native coin balance.');
                }
            });
        }
    }, [walletAddress, setError]);

    useEffect(() => {
        const nativeTx = calls?.find(call => call.value && call.value !== '0');
        setSendingBalance(nativeTx ? BigInt(nativeTx.value) : 0n);
    }, [calls]);

    useEffect(() => {
        CoinsUtils.fetchNativeCoinPrice(selectedNetwork, price => {
            if (price === 0) {
                setTotalFeeMode('coin');
            }
        });
    }, [selectedNetwork]);

    useEffect(() => {
        fetchNativeCoinBalance();
    }, [fetchNativeCoinBalance, selectedNetwork.chain_key]);

    useEffect(() => {
        if (isTestnet) {
            setTotalFeeMode('coin');
        }
    }, [isTestnet]);

    useEffect(() => {
        if (suggestionGas) {
            setCurrentGasType(GasType.Suggest);
        }
    }, [dispatch, selectedNetwork, suggestionGas]);

    useEffect(() => {
        if (!walletAddress || isAAWallet || loadingNativeCoinBalance) {
            return;
        }

        const totalAmount = currentGasFee + sendingBalance;

        if (nativeCoinBalance < totalAmount) {
            logger.log('⛽️ Insufficient funds', nativeCoinBalance, totalAmount);

            setError(
                sendingBalance > 0n
                    ? ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS
                    : ErrorMessages.INSUFFICIENT_FUNDS_FOR_GAS,
            );
        }
    }, [
        loadingNativeCoinBalance,
        nativeCoinBalance,
        walletAddress,
        isAAWallet,
        setError,
        currentGasFee,
        sendingBalance,
    ]);

    useEffect(() => {
        if (suggestionGas && currentGasType === GasType.Suggest) {
            const gasPrice = suggestionGas.maxFeePerGas
                ? suggestionGas.maxFeePerGas
                : (suggestionGas.gasPrice ?? 0n);
            const maxGasFee = gasPrice * BigInt(gasLimit);

            const computedGasFeeData = computeGasFeeData({
                priorityFee: suggestionGas.priorityFee,
                maxGasFee,
                gasPrice,
            });
            setGasFeeData(computedGasFeeData);

            const _data: HandledGasData = {
                gasInfo: suggestionGas,
                gasPrice,
            };
            onGasChange && onGasChange(_data, maxGasFee);
        }
    }, [currentGasType, gasLimit, onGasChange, suggestionGas, computeGasFeeData]);

    useEffect(() => {
        if (currentGasType !== GasType.Suggest) {
            const _data = handleGasPrice(
                gasOptionsData,
                currentGasType,
                customGas,
                selectedNetwork.gasPriceType,
            );

            const maxGasFee = _data.gasPrice * BigInt(gasLimit);

            const computedGasFeeData = computeGasFeeData({
                priorityFee: _data.gasInfo.priorityFee,
                maxGasFee,
                gasPrice: _data.gasPrice,
            });
            setGasFeeData(computedGasFeeData);

            onGasChange && onGasChange(_data, maxGasFee);
        }
    }, [
        gasOptionsData,
        currentGasType,
        customGas,
        gasLimit,
        onGasChange,
        selectedNetwork.gasPriceType,
        computeGasFeeData,
    ]);

    useEffect(() => {
        const refreshGasOptions = () => {
            if (currentGasType !== GasType.Custom && currentGasType !== GasType.Suggest) {
                try {
                    dispatch(loadGasOptions(selectedNetwork.chain_key));
                } catch (error) {
                    // Silently handle errors
                }
            }
        };

        refreshGasOptions();

        const interval = setInterval(() => refreshGasOptions(), UPDATE_GAS_INTERVAL);

        return () => clearInterval(interval);
    }, [currentGasType, dispatch, selectedNetwork.chain_key]);

    useEffect(() => {
        const handleGasTypeChange = (_type: GasType) => {
            setCurrentGasType(_type);
        };
        eventManager.on(EventType.CHANGE_GAS_TYPE, handleGasTypeChange);

        return () => {
            eventManager.off(EventType.CHANGE_GAS_TYPE, handleGasTypeChange);
        };
    }, []);

    const renderFee = useCallback(
        (value: React.ReactNode) => {
            return !isTestnet && nativeCoinPrice > 0 ? (
                <button
                    disabled={disabled}
                    onClick={onTotalFeePress}
                    className="flex flex-row items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                    {value}
                    <MdOutlineSwapVert className="text-primary text-[18px]" />
                </button>
            ) : (
                <span
                    className={
                        'text-sm font-medium ' +
                        (disabled ? 'text-gray-500' : 'text-black dark:text-white')
                    }>
                    {value}
                </span>
            );
        },
        [isTestnet, disabled, onTotalFeePress, nativeCoinPrice],
    );

    const renderLegacyFee = useCallback(() => {
        return renderFee(
            totalFeeMode === 'usd'
                ? formatMoney(nativeCoinPrice * estimatedGasFeeFormatted)
                : `${formatNumber(estimatedGasFeeFormatted)} ${selectedNetwork.native_coin_symbol}`,
        );
    }, [
        renderFee,
        totalFeeMode,
        nativeCoinPrice,
        estimatedGasFeeFormatted,
        selectedNetwork.native_coin_symbol,
    ]);

    return (
        <div className={'flex flex-col w-full ' + className}>
            <div
                className={`${
                    border ? 'border border-slate-200 dark:border-darkline rounded-xl p-3' : ''
                }`}>
                {loading ? (
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-row items-center gap-2">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Network Fee
                            </div>
                            <button
                                data-tooltip-id="chilly-tooltip"
                                data-tooltip-variant={tooltipVariant}
                                data-tooltip-html="The network fee is the fee paid to<br />the network to process the
                                transaction.">
                                <FaInfoCircle className="text-gray-500" />
                            </button>
                        </div>
                        <div className="animate-pulse bg-placeholder h-4 w-20 rounded"></div>
                    </div>
                ) : (
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-row items-center gap-2">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Network Fee
                            </div>
                            <button
                                data-tooltip-id="chilly-tooltip"
                                data-tooltip-variant={tooltipVariant}
                                data-tooltip-html="The network fee is the fee paid to<br />the network to process the
                                transaction.">
                                <FaInfoCircle className="text-gray-500" />
                            </button>
                        </div>
                        <div className="flex flex-row items-center gap-1">
                            <button
                                onClick={() => setShowGasFee(true)}
                                className="p-1 text-primary hover:text-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                <FaPencilAlt className="text-primary text-sm" />
                            </button>
                            {renderLegacyFee()}
                        </div>
                    </div>
                )}
            </div>

            <GasOptionModal
                visible={showGasFee}
                gasLimit={gasLimit}
                suggestionGas={suggestionGas}
                onClosePress={() => setShowGasFee(false)}
                initGasType={currentGasType}
            />
        </div>
    );
});
