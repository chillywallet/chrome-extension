import { formatNumber } from '../../../shared/utils/format';
import { ethers, formatUnits, TransactionResponse } from 'ethers';
import _, { random } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { getErrorMessage } from '../../../api/graphQL/BaseRequest';
import { AccountCallInput } from '../../../api/graphQL/Types';
import { getCurrentChains } from '../../../lib/ChainsUtils';
import CoinsUtils from '../../../lib/CoinsUtils';
import { LiquidStakingData } from '../../../lib/liquid-staking/Types';
import { isNativeCoinByTokenAddress, safeParseUnits } from '../../../lib/WalletUtils';
import { EARN_LIQUID_STAKING_CLAIM_ROUTE, EARN_LIST_ROUTE } from '../../../shared/constants/routes';
import { DEBOUNCED_DURATION, UPDATE_BALANCE_INTERVAL } from '../../../shared/constants/swap';
import ErrorMessages from '../../../shared/messages/ErrorMessages';
import { ChainData } from '../../../shared/types/Chain';
import { EarnItem } from '../../../shared/types/Earn';
import {
    HandledGasData,
    PendingTransaction,
    SelectedCoinData,
    TxtToken,
} from '../../../shared/types/Wallet';
import eventManager from '../../../shared/utils/eventManager';
import logger from '../../../shared/utils/logger';
import { getSafeBigNumber } from '../../../shared/utils/string';
import validator from '../../../shared/utils/validator';
import {
    addPendingTransaction,
    estimateRequestUnstake,
    estimateStake,
    estimateUnstake,
    getExchangeRate,
    getNativeTokenBalance,
    getRequestUnstakeCall,
    getStakeCall,
    getTokenBalance,
    getUnstakeCall,
    getUnstakeExchangeRate,
    getWaitTime,
    requestUnstake,
    setLiquidStakingProvider,
    setSelectedNetwork,
    stake,
    unstake,
} from '../../../store/actions/uiActions';
import {
    useCurrentAccount,
    useCurrentWallet,
    useNativeCoinBalance,
    useSelectedNetwork,
} from '../../../store/selectors';
import { useStringToFloatSelector } from '../../../store/selectors/string';
import { useAppDispatch } from '../../../store/store';
import Toast from '../../components/Toast';
import { useEarnData } from './EarnProvider';

export default function useLiquidStaking(data: EarnItem) {
    const { setLiquidStakingClaimData } = useEarnData();

    const dispatch = useAppDispatch();
    const selectedNetwork = useSelectedNetwork();
    const currentWallet = useCurrentWallet();
    const currentAccount = useCurrentAccount();
    const history = useHistory();
    const nativeCoinBalance = useNativeCoinBalance(currentAccount?.address);


    const refreshFromBalanceChecker = useRef(false);
    const refreshToBalanceChecker = useRef(false);
    const fromValueRef = useRef(0n);

    const [fromValue, setFromValue] = useState('');
    const [fromValueValid, setFromValueValid] = useState(true);
    const [fromUSDValue, setFromUSDValue] = useState('');
    const [fromValueBigInt, setFromValueBigInt] = useState<bigint>(0n);
    const [fromPrice, setFromPrice] = useState(0);
    const [loadingFromPrice, setLoadingFromPrice] = useState(false);
    const [
        { decimals: fromDecimals, loading: loadingFromCoinData, balance: fromBalance },
        setFromCoinData,
    ] = useState<SelectedCoinData>({
        decimals: 18,
        loading: true,
        balance: 0n,
    });
    const [toPrice, setToPrice] = useState(0);
    const [loadingToPrice, setLoadingToPrice] = useState(false);
    const [
        { loading: loadingToCoinData, balance: toBalance, decimals: toDecimals },
        setToCoinData,
    ] = useState<SelectedCoinData>({
        decimals: 18,
        loading: true,
        balance: 0n,
    });

    const [localError, setLocalError] = useState('');
    const [remoteError, setRemoteError] = useState('');
    const [refreshBalanceRandom, setRefreshBalanceRandom] = useState(0);
    const [percentage, setPercentage] = useState('');
    const [inputMode, setInputMode] = useState<'coin' | 'usd'>('coin');
    const [loadingGasLimit, setLoadingGasLimit] = useState(false);
    const [currentGasLimit, setCurrentGasLimit] = useState(0);

    const [{ gasInfo, gasPrice }, setHandledGasData] = useState<HandledGasData>({
        gasInfo: {},
        gasPrice: 0n,
    });
    const [{ exchangeRate, loadingExchangeRate }, setExchangeRateData] = useState<{
        exchangeRate: number;
        loadingExchangeRate: boolean;
    }>({ exchangeRate: 0, loadingExchangeRate: true });
    const [{ waitTime, loadingWaitTime }, setWaitTimeData] = useState<{
        waitTime: number;
        loadingWaitTime: boolean;
    }>({ waitTime: 0, loadingWaitTime: true });
    const [txtData, setTxtData] = useState<PendingTransaction | undefined>();
    const [swapSentSheetVisible, setSwapSentSheetVisible] = useState(false);
    const [mode, setMode] = useState<'Stake' | 'Unstake'>('Stake');
    const [stakingProvider, setStakingProvider] = useState<LiquidStakingData | undefined>();
    const [confirmCalls, setConfirmCalls] = useState<AccountCallInput[]>([]);

    const hasWaitTime = useMemo(() => {
        return stakingProvider?.hasWaitTime ?? false;
    }, [stakingProvider]);

    const gasFee = useMemo(() => {
        return gasPrice * BigInt(currentGasLimit);
    }, [gasPrice, currentGasLimit]);

    const error = useMemo(() => {
        return localError === 'loading'
            ? ''
            : localError
              ? localError
              : remoteError
                ? remoteError
                : '';
    }, [localError, remoteError]);

    const formattedFromBalance = useMemo(() => {
        return Number(ethers.formatUnits(fromBalance.toString(), fromDecimals));
    }, [fromBalance, fromDecimals]);

    const formattedToBalance = useMemo(() => {
        return Number(ethers.formatUnits(toBalance.toString(), toDecimals));
    }, [toBalance, toDecimals]);

    const fromCoin = useMemo(() => {
        return mode === 'Stake' ? data.fromCoin : data.toCoin;
    }, [mode, data]);

    const toCoin = useMemo(() => {
        return mode === 'Unstake' ? data.fromCoin : data.toCoin;
    }, [mode, data]);

    const resetData = useCallback((options?: { input?: boolean; error?: boolean }) => {
        const { input = true, error = true } = options ?? {};

        if (input) {
            setFromValue('');
            setFromUSDValue('');
            setFromValueBigInt(0n);
        }

        if (error) {
            setLocalError('');
            setRemoteError('');
        }

        setCurrentGasLimit(0);
    }, []);

    const inputDebounceFunc = useMemo(() => {
        return _.debounce((input: string) => {
            resetData({ input: false, error: false });
            setLocalError('loading');
            setRemoteError('');

            // Parse input to bigint
            const amount = safeParseUnits(input, fromDecimals);
            setFromValueBigInt(amount);
            fromValueRef.current = amount;
        }, DEBOUNCED_DURATION);
    }, [resetData, fromDecimals]);

    const formattedFromValue = useMemo(() => {
        if (fromValueBigInt === 0n || !fromDecimals) return 0;

        return parseFloat(formatUnits(fromValueBigInt, fromDecimals));
    }, [fromValueBigInt, fromDecimals]);

    const toValue = useMemo(() => {
        return formattedFromValue * exchangeRate;
    }, [formattedFromValue, exchangeRate]);

    const fromTokenAddress = useMemo(() => {
        return fromCoin.tokenAddress;
    }, [fromCoin]);

    const toTokenAddress = useMemo(() => {
        return toCoin.tokenAddress;
    }, [toCoin]);

    const isNativeFromCoin = useMemo(() => {
        return isNativeCoinByTokenAddress(selectedNetwork.chain_key, fromTokenAddress);
    }, [fromTokenAddress, selectedNetwork.chain_key]);

    const isNativeToCoin = useMemo(() => {
        return isNativeCoinByTokenAddress(selectedNetwork.chain_key, toTokenAddress);
    }, [toTokenAddress, selectedNetwork.chain_key]);

    const { number: percentNum } = useStringToFloatSelector(percentage);

    const refreshBalance = useCallback(() => {
        if (!refreshFromBalanceChecker.current && !refreshToBalanceChecker.current) {
            setRefreshBalanceRandom(random(0, 100, false));
        }
    }, []);

    const handleOnFromValueChange = useCallback(
        (text: string) => {
            const _text = text.replace(/^0+([0-9]+)/, '$1');
            setFromValue(_text);
            inputDebounceFunc(_text);

            const handledValue = _text.replace(',', '.');
            let _fromUSDValue = '0';

            if (!validator.isEmpty(handledValue) && validator.isFloat(handledValue)) {
                _fromUSDValue = parseFloat(handledValue) * fromPrice + '';
            }

            setFromUSDValue(_fromUSDValue);
        },
        [fromPrice, inputDebounceFunc],
    );

    const handleOnFromUSDValueChange = useCallback(
        (text: string) => {
            const _text = text.replace(/^0+([0-9]+)/, '$1');
            setFromUSDValue(_text);
            const handledValue = _text.replace(',', '.');
            let _fromValue = '0';

            if (!validator.isEmpty(handledValue) && validator.isFloat(handledValue)) {
                const number = parseFloat(handledValue);

                if (fromPrice && number) {
                    if (number < 1) {
                        _fromValue = formatNumber(number / fromPrice, {
                            locale: 'en-US',
                            subscript: false,
                        });
                    } else {
                        _fromValue = (number / fromPrice).toFixed(6);
                    }
                }
            }

            setFromValue(_fromValue);
            inputDebounceFunc(_fromValue);
        },
        [fromPrice, inputDebounceFunc],
    );

    const estimateGasForTransaction = useCallback(
        async (txKind: 'stake' | 'requestUnstake' | 'unstake'): Promise<number> => {
            if (!currentAccount?.address) {
                throw new Error('Account address is required');
            }

            const walletAddress = currentAccount.address;

            let estimatedGasLimit: string | null = null;
            if (txKind === 'stake') {
                estimatedGasLimit = await estimateStake(walletAddress, fromValueBigInt);
            } else if (txKind === 'requestUnstake') {
                estimatedGasLimit = await estimateRequestUnstake(walletAddress, fromValueBigInt);
            } else {
                estimatedGasLimit = await estimateUnstake(
                    walletAddress,
                    undefined,
                    fromValueBigInt,
                );
            }

            if (!estimatedGasLimit) {
                throw new Error('Failed to estimate gas');
            }

            return Number(estimatedGasLimit);
        },
        [fromValueBigInt, currentAccount?.address],
    );

    const performLiquidStakingTx = useCallback(
        async (kind: 'stake' | 'requestUnstake' | 'unstake') => {
            if (!currentAccount?.address || !gasInfo || !currentWallet || !currentAccount) {
                return;
            }

            let _gasLimit = currentGasLimit;

            const onTransactionSent = async (txt: TransactionResponse | null) => {
                if (txt) {
                    const txtTokens: TxtToken[] = [
                        {
                            token_id: fromCoin.tokenAddress,
                            symbol: fromCoin.symbol,
                            icon: fromCoin.imageUrl,
                            is_nft: false,
                            name: fromCoin.name,
                        },
                        {
                            token_id: toCoin.tokenAddress,
                            symbol: toCoin.symbol,
                            icon: toCoin.imageUrl,
                            is_nft: false,
                            name: toCoin.name,
                        },
                    ];

                    const type: PendingTransaction['type'] =
                        kind === 'stake'
                            ? 'liquid-staking'
                            : kind === 'requestUnstake'
                              ? 'request-withdrawal'
                              : 'unstake';

                    const pendingTx: PendingTransaction = {
                        id: uuid(),
                        type,
                        sender: currentAccount.address,
                        receiver: stakingProvider!.contractAddress,
                        txHash: txt.hash,
                        gasInfo,
                        amount: formattedFromValue,
                        network: selectedNetwork,
                        tokens: txtTokens,
                        trackData: {
                            amountUSD: formattedFromValue * fromPrice,
                            amount: formattedFromValue,
                            symbol: fromCoin.symbol,
                        },
                    };
                    dispatch(addPendingTransaction(selectedNetwork.platform_id, pendingTx));

                    setTxtData(pendingTx);
                    setSwapSentSheetVisible(true);
                }
            };

            const walletAddress = currentAccount.address;

            switch (kind) {
                case 'stake':
                    dispatch(stake(walletAddress, fromValueBigInt, gasInfo, _gasLimit)).then(
                        onTransactionSent,
                    );
                    break;
                case 'requestUnstake':
                    dispatch(
                        requestUnstake(walletAddress, fromValueBigInt, gasInfo, _gasLimit),
                    ).then(onTransactionSent);
                    break;
                case 'unstake':
                    dispatch(
                        unstake(walletAddress, undefined, fromValueBigInt, gasInfo, _gasLimit),
                    ).then(onTransactionSent);
                    break;
            }
        },
        [
            currentAccount,
            currentGasLimit,
            currentWallet,
            dispatch,
            fromCoin,
            fromPrice,
            formattedFromValue,
            fromValueBigInt,
            gasInfo,
            selectedNetwork,
            toCoin,
            stakingProvider,
            estimateGasForTransaction,
        ],
    );

    const onStakePress = useCallback(() => {
        performLiquidStakingTx('stake');
    }, [performLiquidStakingTx]);

    const onRequestUnstakePress = useCallback(() => {
        performLiquidStakingTx('requestUnstake');
    }, [performLiquidStakingTx]);

    const onUnstakePress = useCallback(() => {
        performLiquidStakingTx('unstake');
    }, [performLiquidStakingTx]);

    const onClaimPress = useCallback(() => {
        setLiquidStakingClaimData({ data, waitTime });
        history.push(EARN_LIQUID_STAKING_CLAIM_ROUTE);
    }, [data, history, setLiquidStakingClaimData, waitTime]);

    const onChangeInputModePress = useCallback(() => {
        if (inputMode === 'coin') {
            setFromUSDValue(getSafeBigNumber(formattedFromValue * fromPrice, 2) + '');
        }

        setInputMode(inputMode === 'coin' ? 'usd' : 'coin');
    }, [inputMode, formattedFromValue, fromPrice]);

    const onSliderValueChange = useCallback(
        (_value: bigint) => {
            // If the value is the same as the current value, skip
            if (fromValueRef.current === _value) {
                return;
            }

            if (fromBalance > 0n) {
                const result = formatUnits(_value, fromDecimals);
                handleOnFromValueChange(result);
            }
        },
        [fromBalance, handleOnFromValueChange, fromDecimals],
    );

    const onSwapSentClose = useCallback(() => {
        setSwapSentSheetVisible(false);
        setTxtData(undefined);
        resetData();
    }, [resetData]);

    const onTryAgainPress = useCallback(() => {
        setSwapSentSheetVisible(false);
        setTxtData(undefined);

        if (mode === 'Stake') {
            onStakePress();
        } else {
            onRequestUnstakePress();
        }
    }, [onStakePress, onRequestUnstakePress, mode]);

    const onSwapSuccess = useCallback(
        (trackData: any, cancelled: boolean) => {
            const message = cancelled
                ? mode === 'Stake'
                    ? 'Stake Cancelled'
                    : 'Request Withdrawal Cancelled'
                : mode === 'Stake'
                  ? 'Stake Succeeded'
                  : stakingProvider?.unlockRequired
                    ? 'Request Withdrawal Succeeded'
                    : 'Unstake Succeeded';
            Toast.showSuccess(message);

            refreshBalance();
        },
        [refreshBalance, mode, stakingProvider],
    );

    const onChangeModePress = useCallback(
        (value: 'Unstake' | 'Stake') => {
            if (value !== mode) {
                setFromCoinData({ decimals: 18, balance: 0n, loading: true });
                setToCoinData({ decimals: 18, balance: 0n, loading: true });
                resetData();
                setMode(value);
            }
        },
        [mode, resetData],
    );

    useEffect(() => {
        //add condition if opened multiple tab and change network from another tab
        if (selectedNetwork.platform_id !== data.platformId) {
            const stakingNetwork = getCurrentChains().find(
                (chain: ChainData) => chain.platform_id === data.platformId,
            );
            eventManager.showAlertModal({
                title: 'Network Changed',
                message: `Please switch to ${stakingNetwork?.name} to continue.`,
                buttons: [
                    {
                        name: `Switch to ${stakingNetwork?.name}`,
                        type: 'primary',
                        onPress: () => {
                            if (stakingNetwork?.chain_id) {
                                dispatch(setSelectedNetwork(stakingNetwork?.chain_id));
                            }
                        },
                    },
                    {
                        name: 'Exit Page',
                        type: 'cancel',
                        onPress: () => {
                            history.replace(EARN_LIST_ROUTE);
                        },
                    },
                ],
                closable: false,
            });
        }
    }, [data.platformId, dispatch, history, selectedNetwork.platform_id]);

    useEffect(() => {
        if (!currentAccount?.address || fromValueBigInt === 0n || !stakingProvider) {
            setConfirmCalls([]);
            return;
        }

        const loadConfirmCalls = async () => {
            try {
                const calls: AccountCallInput[] = [];

                switch (mode) {
                    case 'Stake': {
                        const stakeCall = await getStakeCall(
                            fromValueBigInt,
                            currentAccount.address,
                        );
                        calls.push(stakeCall);
                        break;
                    }
                    case 'Unstake': {
                        if (stakingProvider.unlockRequired) {
                            const requestUnstakeCall = await getRequestUnstakeCall(
                                fromValueBigInt,
                                currentAccount.address,
                            );
                            calls.push(requestUnstakeCall);
                        } else {
                            const unstakeCall = await getUnstakeCall(
                                fromValueBigInt,
                                currentAccount.address,
                            );
                            calls.push(unstakeCall);
                        }
                        break;
                    }
                }

                setConfirmCalls(calls);
                logger.log('🏄🏽‍♂️ Confirm calls', calls);
            } catch (err) {
                logger.error('Error creating confirm calls', err);
                setConfirmCalls([]);
            }
        };

        loadConfirmCalls();
    }, [currentAccount, fromValueBigInt, mode, stakingProvider]);

    useEffect(() => {
        const interval = setInterval(refreshBalance, UPDATE_BALANCE_INTERVAL);

        return () => {
            clearInterval(interval);
        };
    }, [refreshBalance]);

    useEffect(() => {
        if (percentNum < 0) {
            setPercentage('0');
        }
    }, [percentNum]);

    useEffect(() => {
        if (inputMode === 'coin') {
            const handledValue = fromValue.split(',').join('.');

            if (!validator.isEmpty(handledValue)) {
                if (validator.isFloat(handledValue)) {
                    setFromValueValid(true);
                } else {
                    setFromValueValid(false);
                }
            } else {
                setFromValueValid(true);
            }
        }
    }, [fromValue, inputMode]);

    useEffect(() => {
        if (inputMode === 'usd') {
            const handledValue = fromUSDValue.split(',').join('.');

            if (!validator.isEmpty(handledValue)) {
                if (validator.isFloat(handledValue)) {
                    setFromValueValid(true);
                } else {
                    setFromValueValid(false);
                }
            } else {
                setFromValueValid(true);
            }
        }
    }, [fromUSDValue, inputMode]);

    useEffect(() => {
        if (currentAccount?.address && !swapSentSheetVisible) {
            refreshFromBalanceChecker.current = true;
            getTokenBalance(currentAccount.address, fromCoin.tokenAddress, isNativeFromCoin).then(
                ({ balance, decimals, error: _error }) => {
                    if (!_error) {
                        setFromCoinData({ decimals, balance, loading: false });
                    }

                    refreshFromBalanceChecker.current = false;
                },
            );
        }
    }, [
        currentAccount?.address,
        fromCoin,
        isNativeFromCoin,
        refreshBalanceRandom,
        swapSentSheetVisible,
    ]);

    useEffect(() => {
        if (currentAccount?.address && !swapSentSheetVisible) {
            refreshToBalanceChecker.current = true;
            getTokenBalance(currentAccount.address, toCoin.tokenAddress, isNativeToCoin).then(
                ({ balance, decimals, error: _error }) => {
                    if (!_error) {
                        setToCoinData({ decimals, balance, loading: false });
                    }

                    refreshToBalanceChecker.current = false;
                },
            );
        }
    }, [
        currentAccount?.address,
        toCoin,
        isNativeToCoin,
        refreshBalanceRandom,
        swapSentSheetVisible,
    ]);

    useEffect(() => {
        if (fromCoin?.tokenAddress && !selectedNetwork?.testnet) {
            setLoadingFromPrice(true);
            CoinsUtils.getCoinPrice(selectedNetwork.platform_id, fromCoin.tokenAddress).then(
                _price => {
                    setFromPrice(_price);
                    setLoadingFromPrice(false);
                },
            );
        } else {
            setFromPrice(0);
        }
    }, [fromCoin, selectedNetwork]);

    useEffect(() => {
        if (toCoin?.tokenAddress && !selectedNetwork?.testnet) {
            setLoadingToPrice(true);
            CoinsUtils.getCoinPrice(selectedNetwork.platform_id, toCoin.tokenAddress).then(
                _price => {
                    setToPrice(_price);
                    setLoadingToPrice(false);
                },
            );
        } else {
            setToPrice(0);
        }
    }, [toCoin, selectedNetwork]);

    useEffect(() => {
        setLiquidStakingProvider(data.type).then(provider => {
            setStakingProvider(provider);
        });
    }, [data]);

    useEffect(() => {
        setExchangeRateData({ loadingExchangeRate: true, exchangeRate: 0 });
        const exchangeRateFunc = mode === 'Stake' ? getExchangeRate : getUnstakeExchangeRate;
        exchangeRateFunc('1')
            .then(result => {
                setRemoteError('');
                setExchangeRateData({ loadingExchangeRate: false, exchangeRate: result });
            })
            .catch(e => {
                setRemoteError('Can not load the exchange rate.');
                setExchangeRateData({ loadingExchangeRate: false, exchangeRate: 0 });
                logger.error('ExchangeRate', e);
            });
    }, [mode]);

    useEffect(() => {
        if (hasWaitTime) {
            setWaitTimeData({ loadingWaitTime: true, waitTime: 0 });
            getWaitTime()
                .then(result => {
                    setWaitTimeData({ loadingWaitTime: false, waitTime: result });
                })
                .catch(e => {
                    setWaitTimeData({ loadingWaitTime: false, waitTime: 0 });
                    logger.error('getWaitTime', e);
                });
        }
    }, [hasWaitTime]);

    useEffect(() => {
        if (
            stakingProvider &&
            !loadingExchangeRate &&
            currentAccount?.address &&
            fromValueBigInt > 0n &&
            fromValueBigInt <= fromBalance &&
            !localError
        ) {
            setLoadingGasLimit(true);
            const txKind: 'stake' | 'requestUnstake' | 'unstake' =
                mode === 'Stake'
                    ? 'stake'
                    : stakingProvider.unlockRequired
                      ? 'requestUnstake'
                      : 'unstake';

            estimateGasForTransaction(txKind)
                .then(_gasLimit => {
                    if (_gasLimit) {
                        setCurrentGasLimit(_gasLimit);
                        setRemoteError('');
                    }
                })
                .catch(e => {
                    const message = getErrorMessage(e);
                    setRemoteError(message);
                    logger.error('Estimate Gas', e);
                })
                .finally(() => {
                    setLoadingGasLimit(false);
                });
        }
    }, [
        currentAccount?.address,
        loadingExchangeRate,
        fromValueBigInt,
        fromBalance,
        mode,
        stakingProvider,
        localError,
        estimateGasForTransaction,
    ]);

    useEffect(() => {
        if (fromValueBigInt > 0n) {
            if (isNativeFromCoin) {
                if (fromValueBigInt >= fromBalance) {
                    setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS);
                    return;
                }
            } else {
                if (fromValueBigInt > fromBalance) {
                    setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT);
                    return;
                }
            }

            setLocalError('');
        }
    }, [isNativeFromCoin, fromValueBigInt, fromBalance]);

    useEffect(() => {
        if (fromValueBigInt > 0n && gasFee && !localError) {
            if (!isNativeFromCoin) {
                if (gasFee > nativeCoinBalance) {
                    setRemoteError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_GAS);
                } else if (remoteError === ErrorMessages.INSUFFICIENT_FUNDS_FOR_GAS) {
                    setRemoteError('');
                }
            } else {
                if (fromValueBigInt + gasFee > nativeCoinBalance) {
                    setRemoteError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS);
                } else if (remoteError === ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS) {
                    setRemoteError('');
                }
            }
        }
    }, [fromValueBigInt, gasFee, isNativeFromCoin, nativeCoinBalance, localError, remoteError]);

    useEffect(() => {
        if (currentAccount) {
            dispatch(getNativeTokenBalance(currentAccount.address));

            const interval = setInterval(() => {
                dispatch(getNativeTokenBalance(currentAccount.address));
            }, UPDATE_BALANCE_INTERVAL);

            return () => {
                clearInterval(interval);
            };
        }
    }, [dispatch, currentAccount]);

    return {
        formattedFromValue,
        fromPrice,
        fromValue,
        fromUSDValue,
        fromCoin,
        fromValueValid,
        loadingFromPrice,
        loadingFromCoinData,
        fromBalance,
        toCoin,
        toValue,
        toPrice,
        loadingToPrice,
        loadingToCoinData,
        toBalance,
        error,
        inputMode,
        handleOnFromUSDValueChange,
        handleOnFromValueChange,
        onStakePress,
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
        waitTime,
        loadingWaitTime,
        onClaimPress,
        stakingProvider,
        onUnstakePress,
        confirmCalls,
        fromDecimals,
        hasWaitTime,
        formattedFromBalance,
        formattedToBalance,
    };
}
