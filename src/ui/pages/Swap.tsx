import { formatMoney, formatNumber } from '../../shared/utils/format';
import { ethers, formatUnits } from 'ethers';
import _, { random } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiFillCaretDown } from 'react-icons/ai';
import { FaChevronDown, FaInfoCircle } from 'react-icons/fa';
import { MdOutlineSwapVert } from 'react-icons/md';
import { PiArrowsVerticalBold } from 'react-icons/pi';
import { v4 as uuid } from 'uuid';
import { Hex } from 'viem';
import { WalletRequest } from '../../api/graphQL';
import { getErrorMessage } from '../../api/graphQL/BaseRequest';
import { AccountCallInput, SwapQuotes } from '../../api/graphQL/Types';
import { KeyringTypes } from '../../controller/KeyringController';
import { getCurrentChains } from '../../lib/ChainsUtils';
import CoinsUtils from '../../lib/CoinsUtils';
import {
    getGasData,
    getNativeSymbol,
    getSwapTokenAddress,
    isNativeCoinByTokenAddress,
    retryFunc,
    safeParseUnits,
} from '../../lib/WalletUtils';
import {
    DEBOUNCED_DURATION,
    DEFAULT_SLIPPAGE,
    MAX_SLIPPAGE,
    MIN_SLIPPAGE,
    UPDATE_BALANCE_INTERVAL,
    UPDATE_QUOTE_INTERVAL,
} from '../../shared/constants/swap';
import ErrorMessages from '../../shared/messages/ErrorMessages';
import { ChainData } from '../../shared/types/Chain';
import {
    HandledGasData,
    PendingTransaction,
    PlatformCoin,
    SelectedCoinData,
    TxtToken,
} from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import { getCoinHoldings } from '../../shared/utils/portfolio';
import { getSafeBigNumber } from '../../shared/utils/string';
import validator from '../../shared/utils/validator';
import {
    addPendingTransaction,
    approveAllowance,
    checkAllowance,
    estimateGas,
    estimateGasAllowance,
    getNativeTokenBalance,
    getTokenBalance,
    hideLoadingIndicator,
    newSendTransaction,
    setPortfolioCoins,
    setSelectedNetwork,
    setUseDefaultNetwork,
    showLoadingIndicator,
    updatePendingTransactionStatus,
} from '../../store/actions/uiActions';
import {
    useActualTheme,
    useCurrentAccount,
    useCurrentWallet,
    useNativeCoinBalance,
    usePortfolioCoins,
    useSelectedNetwork,
} from '../../store/selectors';
import { useCurrentPlatformId } from '../../store/selectors/wallet';
import { useAppDispatch } from '../../store/store';
import AssetLogo from '../components/AssetLogo';
import CoinSelectorModal from '../components/CoinSelectorModal';
import CustomCoinSelectorModal from '../components/CustomCoinSelectorModal';
import GasFee from '../components/GasFee';
import Header from '../components/Header';
import NetworkMenu from '../components/NetworkMenu';
import PercentageSlider from '../components/PercentageSlider';
import SpeedUpAndCancelModal from '../components/SpeedUpAndCancelModal';
import SwapSentModal from '../components/SwapSentModal';
import Toast from '../components/Toast';
import { useHardwareWalletSignModal } from '../hooks/useHardwareWalletSignModal';
import { useRoutesData } from './RoutesProvider';
type Props = {};

const MAX_RETRY_TIMES = 4;
const HARDCODED_GAS_LIMIT = 500_000;

const Swap = React.memo<Props>((props: Props) => {
    const { setPrefilledCoinsToSwap, prefilledCoinsToSwap } = useRoutesData();

    const dispatch = useAppDispatch();
    const actualTheme = useActualTheme();
    const selectedNetwork = useSelectedNetwork();
    const currentChain = selectedNetwork.chain_key;

    const currentAccount = useCurrentAccount();
    const currentWallet = useCurrentWallet();
    const quoteLoadingCheckerRef = useRef(false);
    const refreshQuoteRef = useRef<NodeJS.Timer>();
    const walletAddress = currentAccount?.address;

    const walletType = useMemo(
        () => (currentAccount?.metadata?.keyring?.type as KeyringTypes) ?? KeyringTypes.hd,
        [currentAccount?.metadata?.keyring?.type],
    );

    const isHardwareWallet = useMemo(
        () => walletType === KeyringTypes.ledger || walletType === KeyringTypes.trezor,
        [walletType],
    );

    const { wrapSubmit, hardwareModal } = useHardwareWalletSignModal(
        currentAccount?.metadata.keyring.type,
    );

    const walletCoins = usePortfolioCoins(walletAddress);
    const platformId = useCurrentPlatformId();
    const nativeCoinBalance = useNativeCoinBalance(currentAccount?.address);

    const refreshFromBalanceChecker = useRef(false);
    const refreshToBalanceChecker = useRef(false);
    const slippageInputRef = useRef(null);
    const fromCoinRef = useRef<PlatformCoin | null>(null);
    const fromValueRef = useRef(0n);
    const toCoinRef = useRef<PlatformCoin | null>(null);
    const suggestedSlippageRef = useRef<number | undefined>(DEFAULT_SLIPPAGE);
    const retryTimesRef = useRef(0);
    const isMountedRef = useRef(true);

    const [networkMenuVisible, setNetworkMenuVisible] = useState(false);
    const [fromValue, setFromValue] = useState('');
    const [fromValueValid, setFromValueValid] = useState(true);
    const [fromUSDValue, setFromUSDValue] = useState('');
    const [fromValueBigInt, setFromValueBigInt] = useState<bigint>(0n);
    const [fromCoin, setFromCoin] = useState<PlatformCoin | null>(null);
    const [fromPrice, setFromPrice] = useState(0);
    const [loadingFromPrice, setLoadingFromPrice] = useState(false);
    const [
        { decimals: fromDecimals, loading: loadingFromCoinData, balance: fromBalance },
        setFromCoinData,
    ] = useState<SelectedCoinData>({
        decimals: 18,
        loading: false,
        balance: 0n,
    });
    const [loadingFromCoins, setLoadingFromCoins] = useState(true);
    const [loadingHoldings, setLoadingHoldings] = useState(true);

    const [toCoin, setToCoin] = useState<PlatformCoin | null>(null);
    const [toValue, setToValue] = useState(0);
    const [toPrice, setToPrice] = useState(0);
    const [loadingToPrice, setLoadingToPrice] = useState(false);
    const [
        { decimals: toDecimals, loading: loadingToCoinData, balance: toBalance },
        setToCoinData,
    ] = useState<SelectedCoinData>({
        decimals: 18,
        loading: false,
        balance: 0n,
    });
    const [loadingToCoins, setLoadingToCoins] = useState(true);

    const [checkingAlowance, setCheckingAllowance] = useState(false);
    const [needApproveAllowance, setNeedApproveAllowance] = useState(false);
    const [approvingAllowance, setApprovingAllowance] = useState(false);
    const [loading, setLoading] = useState(true);
    const [{ coinSelectorModal }, setCoinSelectorModal] = useState({
        coinSelectorModal: false,
        type: '',
    });
    const [coins, setCoins] = useState<PlatformCoin[]>([]);
    const [fromCoinSelectorModalVisible, setFromCoinSelectorModalVisible] = useState(false);
    const [swapSentSheetVisible, setSwapSentSheetVisible] = useState(false);
    const [txtData, setTxtData] = useState<PendingTransaction | undefined>();
    const [quote, setQuote] = useState<SwapQuotes | null>(null);
    const [localError, setLocalError] = useState('');
    const [remoteError, setRemoteError] = useState('');
    const [warningMessage, setWarningMessage] = useState('');
    const [loadingQuote, setLoadingQuote] = useState(false);

    const [partnerCode, setPartnerCode] = useState('');
    const [referrerCode, setReferrerCode] = useState('');
    const [refreshBalanceRandom, setRefreshBalanceRandom] = useState(0);

    const [swapGasLimit, setSwapGasLimit] = useState(0);
    const [allowanceGasLimit, setAllowanceGasLimit] = useState(0);
    const [loadingGasLimit, setLoadingGasLimit] = useState(false);
    const [loadingAllowanceGasLimit, setLoadingAllowanceGasLimit] = useState(false);
    const [{ gasInfo, gasPrice }, setHandledGasData] = useState<HandledGasData>({
        gasInfo: {},
        gasPrice: 0n,
    });

    const [{ speedupAndCancelSheetVisible, speedupAndCancelType }, setSpeedupAndCancelSheetData] =
        useState<{
            speedupAndCancelSheetVisible: boolean;
            speedupAndCancelType?: 'cancel' | 'speedup';
        }>({ speedupAndCancelSheetVisible: false });
    const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE + '');
    const [slippageErrorMessage, setSlippageErrorMessage] = useState('');
    const [slippageNum, setSlippageNum] = useState(DEFAULT_SLIPPAGE);
    const [inputMode, setInputMode] = useState<'coin' | 'usd'>('coin');

    // Fee-related problems reported by the GasFee component.
    const [feeError, setFeeError] = useState('');

    const formattedFromBalance = useMemo(() => {
        return Number(ethers.formatUnits(fromBalance.toString(), fromDecimals));
    }, [fromBalance, fromDecimals]);

    const formattedToBalance = useMemo(() => {
        return Number(ethers.formatUnits(toBalance.toString(), toDecimals));
    }, [toBalance, toDecimals]);

    const defaultFromCoin = useMemo(() => {
        if (
            prefilledCoinsToSwap?.fromCoin &&
            prefilledCoinsToSwap.fromCoin.platformId === selectedNetwork.platform_id
        ) {
            return prefilledCoinsToSwap.fromCoin;
        }

        return null;
    }, [prefilledCoinsToSwap?.fromCoin, selectedNetwork.platform_id]);

    const defaultToCoin = useMemo(() => {
        if (
            prefilledCoinsToSwap?.toCoin &&
            prefilledCoinsToSwap.toCoin.platformId === selectedNetwork.platform_id
        ) {
            return prefilledCoinsToSwap.toCoin;
        }

        return null;
    }, [prefilledCoinsToSwap?.toCoin, selectedNetwork.platform_id]);

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    const supportApproveAndSwap = useMemo(() => {
        return (
            (selectedNetwork.chain_key === 'base' ||
                selectedNetwork.chain_key === 'monad' ||
                selectedNetwork.chain_key === 'monad_testnet') &&
            !isHardwareWallet
        );
    }, [selectedNetwork.chain_key, isHardwareWallet]);

    const gasLimit = useMemo(() => {
        if (supportApproveAndSwap) {
            return needApproveAllowance
                ? allowanceGasLimit + Number(quote?.gasEstimate ?? 0)
                : Number(quote?.gasEstimate ?? 0);
        }

        return needApproveAllowance || approvingAllowance ? allowanceGasLimit : swapGasLimit;
    }, [
        supportApproveAndSwap,
        needApproveAllowance,
        approvingAllowance,
        allowanceGasLimit,
        swapGasLimit,
        quote?.gasEstimate,
    ]);

    const gasFee = useMemo(() => {
        return gasPrice * BigInt(gasLimit);
    }, [gasPrice, gasLimit]);

    const error = useMemo(() => {
        return localError === 'loading'
            ? ''
            : localError
              ? localError
              : remoteError
                ? remoteError
                : slippageErrorMessage
                  ? slippageErrorMessage
                  : feeError;
    }, [localError, remoteError, slippageErrorMessage, feeError]);

    const buttonDisabled = useMemo(() => {
        if (error || loadingQuote || !quote) {
            return true;
        }

        return gasFee === 0n || loadingGasLimit || loadingAllowanceGasLimit;
    }, [gasFee, loadingQuote, quote, loadingGasLimit, error, loadingAllowanceGasLimit]);

    const spenderAddress = useMemo(() => {
        return quote?.swapVersion === '2' ? quote?.spender : (quote?.to ?? '');
    }, [quote]);

    const chainId = useMemo(() => {
        const chain = getCurrentChains().find(c => c.chain_key === selectedNetwork.chain_key);
        return chain?.chain_id;
    }, [selectedNetwork]);

    const poweredBy = useMemo(() => {
        return quote?.poweredBy ?? '';
    }, [quote]);

    const poweredByLogo = useMemo(() => {
        return actualTheme !== 'light' ? quote?.poweredByLogoLight : (quote?.poweredByLogo ?? '');
    }, [quote, actualTheme]);

    const formattedFromValue = useMemo(() => {
        if (fromValueBigInt === 0n || !fromDecimals) return 0;

        return parseFloat(formatUnits(fromValueBigInt, fromDecimals));
    }, [fromValueBigInt, fromDecimals]);

    const fromTokenAddress = useMemo(() => {
        return getSwapTokenAddress(fromCoin, selectedNetwork.chain_key);
    }, [fromCoin, selectedNetwork.chain_key]);

    const toTokenAddress = useMemo(() => {
        return getSwapTokenAddress(toCoin, selectedNetwork.chain_key);
    }, [toCoin, selectedNetwork.chain_key]);

    const isNativeFromCoin = useMemo(() => {
        return isNativeCoinByTokenAddress(selectedNetwork.chain_key, fromTokenAddress);
    }, [fromTokenAddress, selectedNetwork.chain_key]);

    const isNativeToCoin = useMemo(() => {
        return isNativeCoinByTokenAddress(selectedNetwork.chain_key, toTokenAddress);
    }, [toTokenAddress, selectedNetwork.chain_key]);

    const maxSendable = useMemo(() => {
        const hardcodedGasFee = gasPrice * BigInt(HARDCODED_GAS_LIMIT * 1.5);
        return isNativeFromCoin
            ? fromBalance > hardcodedGasFee
                ? fromBalance - hardcodedGasFee
                : 0n
            : fromBalance;
    }, [isNativeFromCoin, gasPrice, fromBalance]);

    const confirmCalls = useMemo(() => {
        if (
            !quote ||
            !fromTokenAddress ||
            !spenderAddress ||
            fromValueBigInt === 0n ||
            !fromDecimals
        ) {
            return [];
        }

        const calls: AccountCallInput[] = [];

        // Allowance call if needed
        if (needApproveAllowance) {
            // Create ERC20 approve call data
            const iface = new ethers.Interface([
                'function approve(address spender, uint256 amount) returns (bool)',
            ]);
            const approveData = iface.encodeFunctionData('approve', [
                spenderAddress,
                fromValueBigInt.toString(),
            ]);

            calls.push({
                to: fromTokenAddress,
                data: approveData,
                value: '0',
            });
        }

        // Swap call
        calls.push({
            to: quote.to,
            data: quote.data,
            value: quote.value || '0',
        });

        return calls;
    }, [
        quote,
        fromTokenAddress,
        spenderAddress,
        fromValueBigInt,
        fromDecimals,
        needApproveAllowance,
    ]);

    const slippageDebounceFunc = useMemo(() => {
        const cb = (_slippage: string) => {
            const handledValue = _slippage.split(',').join('.');
            let errorMessage = '';

            if (validator.isEmpty(handledValue)) {
                errorMessage = 'Slippage is required';
            }

            if (!validator.isFloat(handledValue)) {
                errorMessage = 'Slippage is invalid';
            }

            if (!errorMessage) {
                const num = parseFloat(handledValue);

                if (num < MIN_SLIPPAGE || num > MAX_SLIPPAGE) {
                    errorMessage = `Slippage should be between ${MIN_SLIPPAGE} and ${MAX_SLIPPAGE}`;
                } else {
                    setSlippageNum(num);
                }
            }

            setSlippageErrorMessage(errorMessage);
        };
        return _.debounce(cb, DEBOUNCED_DURATION);
    }, []);

    const isLatestCoins = useCallback(() => {
        const _latestFromAddress = getSwapTokenAddress(
            fromCoinRef.current,
            selectedNetwork.chain_key,
        );
        const _latestToAddress = getSwapTokenAddress(toCoinRef.current, selectedNetwork.chain_key);

        return (
            fromTokenAddress === _latestFromAddress &&
            toTokenAddress === _latestToAddress &&
            fromValueBigInt === fromValueRef.current
        );
    }, [fromTokenAddress, toTokenAddress, selectedNetwork.chain_key, fromValueBigInt]);

    const refreshBalance = useCallback(() => {
        if (!refreshFromBalanceChecker.current && !refreshToBalanceChecker.current) {
            setRefreshBalanceRandom(random(0, 100, false));
        }
    }, []);

    const handleSetToCoin = useCallback((coin: PlatformCoin) => {
        if (
            toCoinRef.current?.coinAddress !== coin.coinAddress ||
            toCoinRef.current?.platformId !== coin.platformId
        ) {
            setToCoinData({ decimals: 18, balance: 0n, loading: true });
            setToCoin(coin);
            toCoinRef.current = coin;
        }
    }, []);

    const handleSetFromCoin = useCallback((coin: PlatformCoin) => {
        if (
            fromCoinRef.current?.coinAddress !== coin.coinAddress ||
            fromCoinRef.current?.platformId !== coin.platformId
        ) {
            setFromCoinData({ decimals: 18, balance: 0n, loading: true });
            setFromCoin(coin);
            fromCoinRef.current = coin;
        }
    }, []);

    const resetData = useCallback(
        (options?: { input?: boolean; error?: boolean }) => {
            const { input = true, error = true } = options ?? {};

            if (refreshQuoteRef.current) {
                clearInterval(refreshQuoteRef.current);
            }

            if (input) {
                setFromValue('');
                setFromUSDValue('');
                setFromValueBigInt(0n);
                fromValueRef.current = 0n;
            }

            if (error) {
                setLocalError('');
                setRemoteError('');
                setFeeError('');
            }

            setQuote(null);
            setCheckingAllowance(false);
            setNeedApproveAllowance(false);
            setApprovingAllowance(false);
            setSwapGasLimit(0);
            setAllowanceGasLimit(0);
            retryTimesRef.current = 0;
            quoteLoadingCheckerRef.current = false;
            setWarningMessage('');
        },
        [],
    );

    const resetQuote = useCallback(() => {
        resetData({ input: false, error: false });
    }, [resetData]);

    const inputDebounceFunc = useMemo(() => {
        return _.debounce((input: string) => {
            // Parse input to bigint
            const amount = safeParseUnits(input, fromDecimals);

            // If input is the same as the current value, skip
            if (amount === fromValueRef.current) {
                return;
            }

            resetQuote();
            setLocalError('loading');
            setRemoteError('');
            setFeeError('');

            setFromValueBigInt(amount);
            fromValueRef.current = amount;
        }, DEBOUNCED_DURATION);
    }, [resetQuote, fromDecimals]);

    const getQuoteAfterCheckingAllowance = useCallback(
        (displayLoader: boolean = true) => {
            if (
                !fromTokenAddress ||
                !toTokenAddress ||
                fromTokenAddress === toTokenAddress ||
                fromValueBigInt === 0n ||
                !walletAddress ||
                !currentChain ||
                slippageErrorMessage ||
                localError
            ) {
                return;
            }

            quoteLoadingCheckerRef.current = true;
            displayLoader && setLoadingQuote(true);
            const weiAmount = fromValueBigInt.toString();
            WalletRequest.getSwapQuotes(
                fromTokenAddress,
                toTokenAddress,
                weiAmount,
                currentChain,
                walletAddress,
                partnerCode,
                slippageNum,
                0,
                false,
            )
                .then(_result => {
                    if (_result.data.getSwapQuotes && isLatestCoins()) {
                        setRemoteError('');
                        const _quote = _result.data.getSwapQuotes;
                        setQuote(_quote);
                        logger.log('🔄 Quote refreshed');
                    } else {
                        logger.log('🔄 Refresh quote skipped');
                    }
                })
                .catch(e => {
                    if (isLatestCoins()) {
                        setQuote(null);
                        const message = getErrorMessage(e);
                        setRemoteError(message);
                    }
                })
                .finally(() => {
                    displayLoader && setLoadingQuote(false);
                    quoteLoadingCheckerRef.current = false;
                });
        },
        [
            fromValueBigInt,
            walletAddress,
            toTokenAddress,
            fromTokenAddress,
            partnerCode,
            currentChain,
            slippageNum,
            slippageErrorMessage,
            isLatestCoins,
            localError,
        ],
    );

    const refreshQuote = useCallback(() => {
        if (refreshQuoteRef.current) {
            clearInterval(refreshQuoteRef.current);
        }

        refreshQuoteRef.current = setInterval(
            () => getQuoteAfterCheckingAllowance(false),
            UPDATE_QUOTE_INTERVAL,
        );
    }, [getQuoteAfterCheckingAllowance]);

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
        [inputDebounceFunc, fromPrice],
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

    const onSlippageInputFocus = useCallback(() => {
        if (slippageInputRef.current) {
            const textLength = slippage?.length ?? 0;
            //@ts-ignore
            slippageInputRef.current.setSelectionRange(textLength, textLength);
        }
    }, [slippage]);

    const onFromCoinPress = useCallback(() => {
        setFromCoinSelectorModalVisible(true);
    }, []);

    const onToCoinPress = useCallback(() => {
        setCoinSelectorModal({ coinSelectorModal: true, type: 'to' });
    }, []);

    const onFromCoinItemPress = useCallback(
        (coin: PlatformCoin) => {
            setFromCoinSelectorModalVisible(false);

            if (
                fromCoinRef.current?.coinAddress !== coin.coinAddress ||
                fromCoinRef.current?.platformId !== coin.platformId
            ) {
                resetData();
            }

            handleSetFromCoin(coin);
        },
        [resetData, handleSetFromCoin],
    );

    const onToCoinItemPress = useCallback(
        (coin: PlatformCoin) => {
            setCoinSelectorModal({ coinSelectorModal: false, type: '' });
            handleSetToCoin(coin);
        },
        [handleSetToCoin],
    );

    const onLoadToCoinsEnd = useCallback(
        (_coins: PlatformCoin[]) => {
            setLoadingToCoins(false);

            if (defaultToCoin) {
                handleSetToCoin(defaultToCoin);
            } else if (_coins && _coins.length) {
                const findIndex = _coins.findIndex(_coin => _coin.symbol === 'USDC');
                handleSetToCoin(_coins[findIndex >= 0 ? findIndex : 0]);
            }
        },
        [handleSetToCoin, defaultToCoin],
    );

    const checkCoinAllowance = useCallback(
        (_spenderAddress: string, callback: (error: boolean, needAllowance?: boolean) => void) => {
            if (fromTokenAddress && walletAddress && fromValueBigInt > 0n && _spenderAddress) {
                if (!isNativeFromCoin) {
                    setCheckingAllowance(true);
                    checkAllowance(
                        _spenderAddress,
                        walletAddress,
                        fromTokenAddress,
                        fromValueBigInt.toString(),
                    )
                        .then(result => {
                            if (isLatestCoins()) {
                                setNeedApproveAllowance(!result);
                                callback(false, !result);
                            } else {
                                logger.log('🔄 Check allowance skipped');
                            }
                        })
                        .catch(e => {
                            logger.log('🔴 Check allowance', e?.message);

                            if (isLatestCoins()) {
                                callback(true);
                            }
                        })
                        .finally(() => setCheckingAllowance(false));
                } else {
                    setCheckingAllowance(false);
                    setNeedApproveAllowance(false);
                    callback(false, false);
                }
            } else {
                setCheckingAllowance(false);
                setNeedApproveAllowance(false);
                callback(true);
            }
        },
        [fromValueBigInt, walletAddress, fromTokenAddress, isNativeFromCoin, isLatestCoins],
    );

    const getQuoteBeforeCheckingAllowance = useCallback(
        async (displayLoader: boolean = true, retryTimes: number = 0) => {
            if (
                !fromTokenAddress ||
                !toTokenAddress ||
                fromTokenAddress === toTokenAddress ||
                fromValueBigInt === 0n ||
                !walletAddress ||
                !currentChain ||
                slippageErrorMessage ||
                loadingFromCoinData ||
                localError ||
                quoteLoadingCheckerRef.current
            ) {
                return;
            }

            const fetchQuote = async (slippage: number) => {
                const weiAmount = fromValueBigInt.toString();
                logger.log('🔄 Swap quotes query', {
                    sellToken: fromTokenAddress,
                    buyToken: toTokenAddress,
                    sellAmount: weiAmount,
                    chain: currentChain,
                    walletAddress,
                    partnerCode,
                    slippage,
                    retryTimes,
                });

                const _result = await WalletRequest.getSwapQuotes(
                    fromTokenAddress,
                    toTokenAddress,
                    weiAmount,
                    currentChain,
                    walletAddress,
                    partnerCode,
                    slippage,
                    retryTimes,
                    false,
                );

                if (_result.data.getSwapQuotes) {
                    const _quote: SwapQuotes = _result.data.getSwapQuotes;
                    return _quote;
                } else {
                    throw new Error('Failed to retrieve Swap Quote');
                }
            };

            try {
                quoteLoadingCheckerRef.current = true;
                displayLoader && setLoadingQuote(true);
                let _slippage = slippageNum;

                let _quote = await fetchQuote(_slippage);

                setRemoteError('');

                if (isLatestCoins()) {
                    // If the suggested slippage is different from the current slippage, refetch the quote
                    if (
                        _quote.suggestedSlippage &&
                        _quote.suggestedSlippage !== suggestedSlippageRef.current
                    ) {
                        // Update the slippage
                        const _suggestedSlippage = _quote.suggestedSlippage;
                        suggestedSlippageRef.current = _suggestedSlippage;
                        setSlippageNum(_suggestedSlippage);
                        setSlippage(_suggestedSlippage.toString());

                        logger.log(
                            '🔄 Refetching quote with suggested slippage',
                            _suggestedSlippage,
                        );
                        _quote = await fetchQuote(_suggestedSlippage);
                        _slippage = _suggestedSlippage;
                    }

                    const _spenderAddress = _quote.swapVersion === '2' ? _quote.spender : _quote.to;
                    logger.log('🔄 Spender address', _spenderAddress);

                    if (_quote.requiredSlippage && _quote.requiredSlippage > _slippage) {
                        setSlippageNum(_quote.requiredSlippage);
                        setSlippage(_quote.requiredSlippage.toString());
                        setWarningMessage(
                            `The slippage you entered is too low. We’ve raised it to ${_quote.requiredSlippage}% so your transaction can has a higher chance of succeeding.`,
                        );

                        // Wait for the slippage to be updated
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } else {
                        setWarningMessage('');
                    }

                    checkCoinAllowance(_spenderAddress, (_error, _needAllowance) => {
                        setQuote(_quote);

                        if (refreshQuoteRef.current) {
                            clearInterval(refreshQuoteRef.current);
                            refreshQuoteRef.current = undefined;
                        }

                        if (!_error) {
                            if (!_needAllowance) {
                                refreshQuote();
                            }
                        }
                    });
                    displayLoader && setLoadingQuote(false);
                    quoteLoadingCheckerRef.current = false;
                } else {
                    logger.log('🔄 getQuoteBeforeCheckingAllowance skipped');

                    if (!fromValueRef.current) {
                        displayLoader && setLoadingQuote(false);
                        quoteLoadingCheckerRef.current = false;
                    }
                }
            } catch (e) {
                if (isLatestCoins()) {
                    // Retry logic for Get quote failure
                    if (retryTimesRef.current < MAX_RETRY_TIMES) {
                        retryTimesRef.current += 1;
                        logger.log('🔄 Get quote failed, retrying', {
                            retryTimes: retryTimesRef.current,
                            error: e,
                        });

                        // Retry after a short delay
                        setTimeout(() => {
                            quoteLoadingCheckerRef.current = false;
                            getQuoteBeforeCheckingAllowance(displayLoader, retryTimesRef.current);
                        }, 1000);
                        return;
                    }

                    setQuote(null);
                    const message = getErrorMessage(e);
                    setRemoteError(message);

                    displayLoader && setLoadingQuote(false);
                    quoteLoadingCheckerRef.current = false;
                }
            }
        },
        [
            fromTokenAddress,
            toTokenAddress,
            fromValueBigInt,
            walletAddress,
            currentChain,
            slippageErrorMessage,
            loadingFromCoinData,
            partnerCode,
            slippageNum,
            isLatestCoins,
            checkCoinAllowance,
            refreshQuote,
            localError,
        ],
    );

    const handleApproveAllowance = useCallback(async () => {
        if (
            !fromTokenAddress ||
            !walletAddress ||
            !currentWallet ||
            !currentAccount ||
            !gasInfo ||
            !fromCoin ||
            !spenderAddress
        ) {
            return false;
        }

        const sendApproveTx = () =>
            approveAllowance(
                spenderAddress,
                walletAddress,
                fromTokenAddress,
                fromValueBigInt.toString(),
                selectedNetwork,
                gasInfo,
                false,
            );

        const tx = isHardwareWallet
            ? await sendApproveTx()
            : await retryFunc(async () => sendApproveTx());

        if (!tx) {
            return false;
        }

        const txtTokens: TxtToken[] = [
            {
                token_id: fromCoin.coinAddress,
                symbol: fromCoin.symbol,
                icon: fromCoin.icon ?? fromCoin.logo ?? '',
                is_nft: false,
                name: fromCoin.name,
            },
        ];
        const pendingTx: PendingTransaction = {
            id: uuid(),
            type: 'approve',
            sender: walletAddress,
            receiver: spenderAddress,
            txHash: tx.hash,
            gasInfo,
            amount: formattedFromValue,
            network: selectedNetwork,
            tokens: txtTokens,
        };

        dispatch(addPendingTransaction(selectedNetwork.platform_id, pendingTx));

        setApprovingAllowance(true);
        let success = false;
        const maxStatusRetries = 3;

        try {
            let status = await dispatch(
                updatePendingTransactionStatus(selectedNetwork.platform_id, pendingTx),
            );
            let statusRetries = 0;

            while (
                status === 'sending' &&
                statusRetries < maxStatusRetries &&
                isMountedRef.current
            ) {
                if (!isMountedRef.current) break;

                status = await dispatch(
                    updatePendingTransactionStatus(selectedNetwork.platform_id, pendingTx),
                );
                statusRetries++;
            }

            success = status === 'sent';
        } catch (_error) {
            const message = getErrorMessage(_error);
            throw new Error(message);
        } finally {
            if (isMountedRef.current) {
                setApprovingAllowance(false);

                if (!success) {
                    getQuoteBeforeCheckingAllowance();
                }
            }
        }

        return success;
    }, [
        fromTokenAddress,
        walletAddress,
        currentWallet,
        currentAccount,
        gasInfo,
        fromCoin,
        spenderAddress,
        fromValueBigInt,
        formattedFromValue,
        selectedNetwork,
        isHardwareWallet,
        dispatch,
        getQuoteBeforeCheckingAllowance,
    ]);

    const onSwapPress = useCallback(async () => {
        if (!quote || !walletAddress || !currentWallet || !currentAccount || !fromCoin || !toCoin)
            return;

        const { to, value, data } = quote;

        const onError = (e: any) => {
            const message = getErrorMessage(e);
            Toast.showError(message);
        };

        const onSuccessTxt = (txHash: string) => {
            const txtTokens: TxtToken[] = [
                {
                    token_id: fromCoin.coinAddress,
                    symbol: fromCoin.symbol,
                    icon: fromCoin.icon ?? fromCoin.logo ?? '',
                    is_nft: false,
                    name: fromCoin.name,
                },
                {
                    token_id: toCoin.coinAddress,
                    symbol: toCoin.symbol,
                    icon: toCoin.icon ?? toCoin.logo ?? '',
                    is_nft: false,
                    name: fromCoin.name,
                },
            ];
            const pendingTx: PendingTransaction = {
                id: uuid(),
                type: 'swap',
                sender: walletAddress,
                receiver: to,
                txHash,
                gasInfo,
                amount: formattedFromValue,
                network: selectedNetwork,
                tokens: txtTokens,
                trackData: {
                    amountUSD: formattedFromValue * fromPrice,
                    amount: formattedFromValue,
                    symbol: fromCoin?.symbol,
                    partnerCode: referrerCode ? referrerCode : 'NONE-CHILLY',
                },
            };

            dispatch(addPendingTransaction(selectedNetwork.platform_id, pendingTx));

            setTxtData(pendingTx);
            setSwapSentSheetVisible(true);
        };

        let needEstimateGas = false;

        if (!gasInfo) return;

        try {
            dispatch(showLoadingIndicator());
            let _gasLimit = swapGasLimit;

            if (needApproveAllowance && supportApproveAndSwap) {
                logger.log('🔄 Approving allowance');
                const success = await handleApproveAllowance();

                if (!success) {
                    throw new Error('Failed to approve allowance');
                }

                needEstimateGas = true;
            }

            if (needEstimateGas) {
                try {
                    // Estimate the gas for the swap
                    const _gasLimitStr = await retryFunc(
                        async () => {
                            return await estimateGas({
                                from: walletAddress as Hex,
                                to: quote.to as Hex,
                                data: quote.data as Hex,
                                value: quote.value || '0',
                            });
                        },
                        { delay: 1000, count: 3 },
                    );

                    if (_gasLimitStr) {
                        _gasLimit = Number(_gasLimitStr);
                        logger.log('🔄 Regenerated gasLimit', _gasLimit);
                    } else {
                        // If the gas estimate is not available, use the quote gas estimate.
                        _gasLimit = Number(quote.gasEstimate);
                    }
                } catch (error) {
                    logger.log('🔄 Error estimating gas', error);
                    // If the gas estimate is not available, use the quote gas estimate.
                    _gasLimit = Number(quote.gasEstimate);
                }
            }

            logger.log('🔄 Swapping');
            const swapTxRequest = {
                transaction: {
                    to,
                    data,
                    value,
                    gasLimit: _gasLimit,
                    chainId,
                    ...getGasData(gasInfo),
                },
            };

            const tx = isHardwareWallet
                ? await newSendTransaction(walletAddress, swapTxRequest)
                : await retryFunc(async () => newSendTransaction(walletAddress, swapTxRequest));

            if (tx?.hash) {
                onSuccessTxt(tx.hash);
            }
        } catch (error) {
            onError(error);
        } finally {
            dispatch(hideLoadingIndicator());
        }
    }, [
        quote,
        walletAddress,
        currentWallet,
        currentAccount,
        fromCoin,
        toCoin,
        gasInfo,
        formattedFromValue,
        selectedNetwork,
        fromPrice,
        referrerCode,
        dispatch,
        needApproveAllowance,
        handleApproveAllowance,
        swapGasLimit,
        chainId,
        supportApproveAndSwap,
        isHardwareWallet,
    ]);

    const onGivePermissionPress = useCallback(async () => {
        dispatch(showLoadingIndicator());

        try {
            const success = await handleApproveAllowance();

            if (success) {
                setNeedApproveAllowance(false);
                setAllowanceGasLimit(0);
                refreshQuote();
            }
        } catch (e) {
            const message = getErrorMessage(e);
            Toast.showError(message);
        } finally {
            dispatch(hideLoadingIndicator());
        }
    }, [dispatch, refreshQuote, handleApproveAllowance]);

    const onTryAgainPress = useCallback(() => {
        setSwapSentSheetVisible(false);
        setTxtData(undefined);
        void wrapSubmit(() => onSwapPress());
    }, [onSwapPress, wrapSubmit]);

    const onSwitchPress = useCallback(() => {
        if (fromCoin && toCoin && !loading) {
            handleSetFromCoin(_.cloneDeep(toCoin));
            handleSetToCoin(_.cloneDeep(fromCoin));
            resetData();
        }
    }, [fromCoin, toCoin, resetData, handleSetToCoin, handleSetFromCoin, loading]);

    const onPendingTransactionMenuPress = useCallback(
        (item: PendingTransaction, type: 'cancel' | 'speedup') => {
            setSpeedupAndCancelSheetData({
                speedupAndCancelSheetVisible: true,
                speedupAndCancelType: type,
            });
        },
        [],
    );

    const onSwapSuccess = useCallback(
        (trackData: any, cancelled: boolean) => {
            const message = cancelled ? 'Swap Cancelled' : 'Swap Succeeded';
            Toast.showSuccess(message);
            refreshBalance();
        },
        [refreshBalance],
    );

    const onChangeModePress = useCallback(() => {
        if (inputMode === 'coin') {
            if (fromValueRef.current === 0n) {
                setFromUSDValue('');
            } else {
                setFromUSDValue(getSafeBigNumber(formattedFromValue * fromPrice, 2) + '');
            }
        } else {
            if (fromValueRef.current === 0n) {
                setFromValue('');
            }
        }

        setInputMode(inputMode === 'coin' ? 'usd' : 'coin');
    }, [inputMode, formattedFromValue, fromPrice]);

    const onCustomCoinSelectorLoadEnd = useCallback(() => {
        setLoadingFromCoins(false);
    }, []);

    const onNetworkChange = useCallback(
        (_network: ChainData) => {
            // Reset data
            resetData();
            toCoinRef.current = null;
            setToCoin(null);

            // Display loading indicator
            setLoading(true);
            setLoadingHoldings(true);

            // Delay 200ms to make sure eveything are refreshed properly
            setTimeout(() => {
                dispatch(setSelectedNetwork(_network.chain_id));
                dispatch(setUseDefaultNetwork(false));
            }, 200);
        },
        [dispatch, resetData],
    );

    const excludedNetworks = useMemo(() => {
        return getCurrentChains().filter(_chain => !_chain.swapSupport);
    }, []);

    const onSwapSentClose = useCallback(() => {
        setSwapSentSheetVisible(false);
        setTxtData(undefined);
        resetData();
    }, [resetData]);

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

    useEffect(() => {
        return () => {
            inputDebounceFunc.cancel();
        };
    }, [inputDebounceFunc]);

    useEffect(() => {
        const interval = setInterval(refreshBalance, UPDATE_BALANCE_INTERVAL);

        return () => {
            clearInterval(interval);

            if (refreshQuoteRef.current) {
                clearInterval(refreshQuoteRef.current);
            }
        };
    }, [refreshBalance]);

    useEffect(() => {
        const marketCoins = walletCoins.map((_coin, index) => {
            const _marketCoin: PlatformCoin = {
                name: _coin.coin_name,
                id: 1_000_000 + index,
                rank: 0,
                logo_lrg: '',
                symbol: _coin.symbol ?? '',
                coinAddress: _coin.token_address,
                coinId: _coin.token_id,
                icon: _coin.icon,
                logo: _coin.logo ?? '',
                platformId: _coin.platform_id,
                latest: {
                    price: 1,
                    percent_change_24h: 0,
                },
                is_verified: _coin.is_verified,
            };
            return _marketCoin;
        });

        if (marketCoins.length) {
            if (defaultFromCoin) {
                handleSetFromCoin(defaultFromCoin);
            } else {
                if (!fromCoinRef.current || fromCoinRef.current.platformId !== platformId) {
                    const nativeSymbol = getNativeSymbol(selectedNetwork.chain_key);
                    const findIndex = marketCoins.findIndex(_coin => _coin.symbol === nativeSymbol);
                    handleSetFromCoin(marketCoins[findIndex >= 0 ? findIndex : 0]);
                }
            }

            setCoins(marketCoins);
            setLoadingHoldings(false);
        } else {
            logger.log('🔄 Loading coins');
        }
    }, [walletCoins, handleSetFromCoin, platformId, selectedNetwork.chain_key, defaultFromCoin]);

    useEffect(() => {
        return () => {
            setPrefilledCoinsToSwap(undefined);
        };
    }, [setPrefilledCoinsToSwap]);

    useEffect(() => {
        if (walletCoins.length === 0 && walletAddress) {
            getCoinHoldings(walletAddress, true, selectedNetwork.platform_id, true, true).then(
                response => {
                    const _coins = response.assets.groupByCoins.map(_group => {
                        const { items, ...rest } = _group;
                        return rest;
                    });
                    dispatch(
                        setPortfolioCoins(walletAddress, selectedNetwork.platform_id, _coins),
                    );
                },
            );
        }
    }, [walletAddress, walletCoins, selectedNetwork, dispatch]);

    useEffect(() => {
        if (loading) {
            if (!loadingFromCoins && !loadingToCoins && !loadingHoldings) {
                setLoading(false);
            }
        }
    }, [loading, loadingFromCoins, loadingToCoins, loadingHoldings]);

    useEffect(() => {
        slippageDebounceFunc(slippage);

        return () => {
            slippageDebounceFunc.cancel();
        };
    }, [slippage, slippageDebounceFunc]);

    useEffect(() => {
        if (fromTokenAddress && toTokenAddress && fromTokenAddress === toTokenAddress) {
            setLocalError(ErrorMessages.SWAP_SAME_COIN);
            resetQuote();
            return;
        } else if (fromValueBigInt > 0n) {
            if (isNativeFromCoin) {
                if (fromValueBigInt >= fromBalance) {
                    setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS);
                    resetQuote();
                    return;
                }
            } else if (fromValueBigInt > fromBalance) {
                resetQuote();
                setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT);
                return;
            }
        }

        setLocalError('');
    }, [
        isNativeFromCoin,
        fromValueBigInt,
        fromBalance,
        resetQuote,
        fromTokenAddress,
        toTokenAddress,
    ]);

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
        getQuoteBeforeCheckingAllowance();
    }, [getQuoteBeforeCheckingAllowance]);

    useEffect(() => {
        if (walletAddress && !swapSentSheetVisible) {
            if (fromCoin) {
                refreshFromBalanceChecker.current = true;
                getTokenBalance(walletAddress, fromCoin.coinAddress, isNativeFromCoin).then(
                    ({ balance, decimals, error: _error }) => {
                        if (
                            fromCoin.coinAddress === fromCoinRef.current?.coinAddress &&
                            fromCoin.platformId === fromCoinRef.current?.platformId &&
                            !_error
                        ) {
                            setFromCoinData({ decimals, balance, loading: false });
                        }

                        refreshFromBalanceChecker.current = false;
                    },
                );
            }
        }
    }, [fromCoin, isNativeFromCoin, walletAddress, refreshBalanceRandom, swapSentSheetVisible]);

    useEffect(() => {
        if (walletAddress && !swapSentSheetVisible) {
            if (toCoin) {
                refreshToBalanceChecker.current = true;
                getTokenBalance(walletAddress, toCoin.coinAddress, isNativeToCoin).then(
                    ({ balance, decimals, error: _error }) => {
                        if (
                            toCoin.coinAddress === toCoinRef.current?.coinAddress &&
                            toCoin.platformId === toCoinRef.current?.platformId &&
                            !_error
                        ) {
                            setToCoinData({ decimals, balance, loading: false });
                        }

                        refreshToBalanceChecker.current = false;
                    },
                );
            }
        }
    }, [toCoin, isNativeToCoin, walletAddress, refreshBalanceRandom, swapSentSheetVisible]);

    useEffect(() => {
        if (fromCoin?.coinAddress) {
            setLoadingFromPrice(true);
            CoinsUtils.getCoinPrice(platformId, fromCoin.coinAddress).then(_price => {
                setFromPrice(_price);
                setLoadingFromPrice(false);

                if (_price === 0) {
                    setInputMode('coin');
                }
            });
        } else {
            setInputMode('coin');
            setFromPrice(0);
        }
    }, [fromCoin, platformId]);

    useEffect(() => {
        if (toCoin?.coinAddress) {
            setLoadingToPrice(true);
            CoinsUtils.getCoinPrice(platformId, toCoin.coinAddress).then(_price => {
                setToPrice(_price);
                setLoadingToPrice(false);
            });
        } else {
            setToPrice(0);
        }
    }, [toCoin, platformId]);

    useEffect(() => {
        if (quote && !loadingQuote) {
            const { buyAmount } = quote;
            const _toValue = Number(ethers.formatUnits(buyAmount, toDecimals));
            setToValue(_toValue);
        } else {
            setToValue(0);
        }
    }, [quote, loadingQuote, toDecimals]);

    useEffect(() => {
        if (
            quote &&
            !loadingQuote &&
            walletAddress &&
            !checkingAlowance &&
            !needApproveAllowance &&
            !localError
        ) {
            setLoadingGasLimit(true);

            estimateGas({
                from: walletAddress as Hex,
                to: quote.to as Hex,
                data: quote.data as Hex,
                value: quote.value || '0',
            })
                .then(_gasLimit => {
                    if (_gasLimit) {
                        setSwapGasLimit(Number(_gasLimit));
                        setRemoteError('');
                    }

                    setLoadingGasLimit(false);
                })
                .catch(e => {
                    // Retry logic for Estimate Gas failure
                    if (retryTimesRef.current < MAX_RETRY_TIMES) {
                        retryTimesRef.current += 1;
                        logger.log('🔄 Estimate Gas failed, retrying', {
                            retryTimes: retryTimesRef.current,
                            error: e,
                        });

                        getQuoteBeforeCheckingAllowance();
                    } else {
                        setRemoteError(ErrorMessages.SWAP_ESTIMATE_GAS_ERROR);
                        logger.log('🔴 Estimate Gas', e, quote);
                        setLoadingGasLimit(false);
                    }
                });
        }
    }, [
        quote,
        loadingQuote,
        walletAddress,
        needApproveAllowance,
        localError,
        checkingAlowance,
        spenderAddress,
        fromTokenAddress,
        getQuoteBeforeCheckingAllowance,
    ]);

    useEffect(() => {
        if (
            spenderAddress &&
            walletAddress &&
            fromTokenAddress &&
            needApproveAllowance &&
            !localError
        ) {
            setLoadingAllowanceGasLimit(true);

            estimateGasAllowance(
                spenderAddress,
                fromTokenAddress,
                fromValueBigInt.toString(),
                walletAddress,
            )
                .then(_gasLimit => {
                    if (_gasLimit) {
                        setAllowanceGasLimit(Number(_gasLimit));
                        setRemoteError('');
                    }
                })
                .catch(e => {
                    const message = getErrorMessage(e);
                    setRemoteError(message);
                    logger.log('🔴 Estimate Gas Allowance', message);
                })
                .finally(() => {
                    setLoadingAllowanceGasLimit(false);
                });
        }
    }, [
        walletAddress,
        needApproveAllowance,
        fromTokenAddress,
        fromValueBigInt,
        spenderAddress,
        localError,
    ]);

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
    }, [
        fromValueBigInt,
        gasFee,
        isNativeFromCoin,
        nativeCoinBalance,
        localError,
        remoteError,
    ]);

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

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return (
        <div className="flex flex-col h-full min-h-[400px] relative bg-white dark:bg-dark">
            <Header
                title="Swap"
                action={
                    <div
                        className={
                            'flex flex-row items-center cursor-pointer text-white px-3 py-1.5 rounded-lg h-[28px] text-xs whitespace-nowrap shadow-sm transition-all hover:shadow-md ' +
                            (selectedNetwork.testnet
                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                : 'bg-header hover:bg-darker')
                        }
                        onClick={() => {
                            setNetworkMenuVisible(true);
                        }}>
                        <img
                            src={selectedNetwork.icon}
                            className="w-4 h-4 rounded-full mr-2 overflow-hidden"
                            alt="icon"
                        />
                        <div className="text-nowrap mr-2 font-medium">
                            {selectedNetwork.short_name}
                        </div>
                        <AiFillCaretDown size={12} />
                    </div>
                }
            />

            <div className="flex flex-col flex-1 p-5 overflow-auto">
                {/* Main Swap Card */}
                <div className="bg-white dark:bg-darker rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-3 px-5 mb-3">
                    {/* You Pay Section */}
                    <div className="flex items-center justify-between space-x-4">
                        <div className="flex flex-col gap-2 min-w-[120px]">
                            <p className="text-sm text-black dark:text-white font-medium">
                                You Pay
                            </p>
                            {loading ? (
                                <div className="h-[36px] w-[120px] animate-pulse bg-placeholder rounded-full"></div>
                            ) : (
                                <button
                                    className="gap-2 flex items-center text-primary dark:text-white border rounded-full border-[#4AA8DC40] bg-[#4AA8DC40] hover:bg-[#4AA8DC66] pl-[5px] pr-[10px] pr-3 h-[36px] transition-colors max-w-[140px]"
                                    onClick={onFromCoinPress}>
                                    <AssetLogo
                                        src={fromCoin?.icon ? fromCoin?.icon : fromCoin?.logo}
                                        platform_id={selectedNetwork.platform_id}
                                        width={26}
                                        className="flex-shrink-0"
                                    />
                                    <span className="text-sm font-medium flex-1 truncate">
                                        {fromCoin?.symbol || 'Select'}
                                    </span>
                                    <FaChevronDown size={12} className="flex-shrink-0" />
                                </button>
                            )}
                            {loading || loadingFromCoinData ? (
                                <div className="flex flex-row items-center gap-2">
                                    <div className="w-24 h-4 animate-pulse bg-placeholder rounded"></div>
                                </div>
                            ) : (
                                <div className="flex flex-row items-center gap-2 text-gray-500">
                                    <span className="text-xs text-gray-500 max-w-[120px] truncate">
                                        {formatNumber(formattedFromBalance)} {fromCoin?.symbol}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="min-w-[150px] max-w-[200px] w-full">
                            {loading ? (
                                <div className="flex flex-col items-end w-full">
                                    <div className="w-full h-4 animate-pulse bg-placeholder rounded mb-2"></div>
                                    <div className="w-full h-6 animate-pulse bg-placeholder rounded mb-2"></div>
                                    <div className="w-full h-12 animate-pulse bg-placeholder rounded-xl mb-1"></div>
                                    {!selectedNetwork?.testnet && (
                                        <div className="w-20 h-6 animate-pulse bg-placeholder rounded"></div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <PercentageSlider
                                        className="w-full mb-2"
                                        onValueChange={onSliderValueChange}
                                        value={fromValueBigInt}
                                        maxValue={maxSendable}
                                        disabled={loading || loadingFromCoinData}
                                    />

                                    <div
                                        className={
                                            'w-full flex flex-row items-center justify-between border-2 rounded-xl dark:bg-white/5 transition-all overflow-hidden mb-1 ' +
                                            (fromValueValid
                                                ? 'border-gray-200 dark:border-gray-600 dark:focus-within:border-primary focus-within:border-primary'
                                                : 'border-red-500')
                                        }>
                                        {inputMode === 'usd' && (
                                            <div className="text-lg ml-3 text-gray-500">$</div>
                                        )}
                                        <input
                                            type="text"
                                            value={inputMode === 'coin' ? fromValue : fromUSDValue}
                                            autoFocus
                                            onChange={e =>
                                                inputMode === 'coin'
                                                    ? handleOnFromValueChange(e.target.value)
                                                    : handleOnFromUSDValueChange(e.target.value)
                                            }
                                            className={
                                                'h-12 px-3 border-0 bg-transparent font-display tabular-nums text-lg focus:outline-none font-medium text-right flex-1 min-w-0'
                                            }
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div className="flex flex-row justify-end">
                                        {!selectedNetwork?.testnet &&
                                            (loadingFromPrice || loading ? (
                                                <div className="w-20 h-6 animate-pulse bg-placeholder rounded-md"></div>
                                            ) : fromPrice > 0 ? (
                                                <button
                                                    className="flex flex-row h-6 items-center bg-primary hover:bg-primarydark text-white cursor-pointer rounded-md px-3 gap-2 transition-colors shadow-sm hover:shadow-md"
                                                    onClick={onChangeModePress}>
                                                    <div className="text-xs font-medium truncate max-w-[150px]">
                                                        {inputMode === 'coin'
                                                            ? formatMoney(
                                                                  formattedFromValue * fromPrice,
                                                              )
                                                            : `${formatNumber(
                                                                  formattedFromValue,
                                                              )} ${fromCoin?.symbol ?? ''}`}
                                                    </div>
                                                    <MdOutlineSwapVert />
                                                </button>
                                            ) : null)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Separator */}
                    {loading ? (
                        <div className="flex items-center justify-center space-x-2 mt-2">
                            <div className="w-full h-px bg-gray-300 dark:bg-gray-600"></div>
                            <div className="h-[35px] w-[35px] shrink-0 animate-pulse bg-placeholder rounded-full"></div>
                            <div className="w-full h-px bg-gray-300 dark:bg-gray-600"></div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center space-x-2 mt-2">
                            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                            <button
                                onClick={onSwitchPress}
                                className="flex items-center justify-center h-[35px] w-[35px] border-[1px] border-primary rounded-full text-primary hover:bg-primary hover:text-white transition-all shadow-sm hover:shadow-md">
                                <PiArrowsVerticalBold size={20} />
                            </button>
                            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                        </div>
                    )}

                    {/* You Receive Section */}
                    <div className="flex items-center justify-between space-x-4">
                        <div className="flex flex-col gap-2 min-w-[120px]">
                            <p className="text-sm text-black dark:text-white font-medium">
                                You Receive
                            </p>
                            {loading ? (
                                <div className="h-[36px] w-[120px] animate-pulse bg-placeholder rounded-full"></div>
                            ) : (
                                <button
                                    className="gap-2 flex items-center text-primary dark:text-white border rounded-full border-[#4AA8DC40] bg-[#4AA8DC40] hover:bg-[#4AA8DC66] pl-[5px] pr-[10px] pr-3 h-[36px] transition-colors max-w-[140px]"
                                    onClick={onToCoinPress}>
                                    <AssetLogo
                                        src={toCoin?.icon ? toCoin?.icon : toCoin?.logo}
                                        platform_id={selectedNetwork.platform_id}
                                        width={26}
                                        className="flex-shrink-0"
                                    />
                                    <span className="text-sm font-medium flex-1 truncate">
                                        {toCoin?.symbol || 'Select'}
                                    </span>
                                    <FaChevronDown size={12} className="flex-shrink-0" />
                                </button>
                            )}
                            {loading || loadingToCoinData ? (
                                <div className="flex flex-row items-center gap-2">
                                    <div className="w-24 h-4 animate-pulse bg-placeholder rounded"></div>
                                </div>
                            ) : (
                                <div className="flex flex-row items-center gap-2 text-gray-500">
                                    <span className="text-xs max-w-[120px] truncate">
                                        {formatNumber(formattedToBalance)} {toCoin?.symbol}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="min-w-[150px] max-w-[200px] flex flex-col gap-1 items-end w-full">
                            {loadingQuote || loading ? (
                                <div className="w-[120px] h-6 animate-pulse bg-placeholder rounded"></div>
                            ) : (
                                <div className="flex flex-row justify-end text-xl font-semibold">
                                    {formatNumber(toValue)}
                                </div>
                            )}

                            {!selectedNetwork.testnet &&
                                (loadingQuote || loadingToPrice || loading ? (
                                    <div className="w-[90px] h-4 animate-pulse bg-placeholder rounded"></div>
                                ) : toPrice > 0 ? (
                                    <div className="text-sm font-medium text-gray-500">
                                        {formatMoney(toValue * toPrice)}
                                    </div>
                                ) : null)}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col bg-white gap-2 dark:bg-darker rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
                    {((!approvingAllowance && !needApproveAllowance) ||
                        supportApproveAndSwap) && (
                        <>
                            {loadingQuote || loading || checkingAlowance ? (
                                <div className="flex flex-row items-center justify-between">
                                    <div className="w-24 h-5 animate-pulse bg-placeholder rounded"></div>
                                    <div className="w-16 h-5 animate-pulse bg-placeholder rounded"></div>
                                </div>
                            ) : (
                                <div className="flex flex-row items-center justify-between">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        Price
                                    </div>
                                    <div className="flex-1 text-sm font-medium truncate ml-2 text-right">
                                        {quote
                                            ? `1 ${fromCoin?.symbol} = ${formatNumber(
                                                  Number(quote.price),
                                              )} ${toCoin?.symbol}`
                                            : 'N/A'}
                                    </div>
                                </div>
                            )}
                            {loading ? (
                                <div className="flex flex-row items-center justify-between">
                                    <div className="w-12 h-5 animate-pulse bg-placeholder rounded"></div>
                                    <div className="w-12 h-5 animate-pulse bg-placeholder rounded"></div>
                                </div>
                            ) : (
                                <div className="flex flex-row items-center justify-between">
                                    <div className="flex flex-1 flex-col">
                                        <div className="flex flex-row items-center gap-2">
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                Slippage (%)
                                            </div>
                                            <button
                                                data-tooltip-id="chilly-tooltip"
                                                data-tooltip-variant={tooltipVariant}
                                                data-tooltip-html="Slippage refers to the tolerance for price fluctuations that you're willing to accommodate while a trade is in progress.">
                                                <FaInfoCircle className="text-gray-500" />
                                            </button>
                                        </div>
                                    </div>

                                    <input
                                        ref={slippageInputRef}
                                        type="text"
                                        placeholder="0.00"
                                        value={slippage}
                                        onChange={e => setSlippage(e.target.value)}
                                        onFocus={onSlippageInputFocus}
                                        className="h-10 w-[100px] bg-transparent text-right border-2 border-slate-200 dark:border-darkline dark:bg-white/5 rounded-xl px-3 text-sm focus:border-primary focus:outline-none transition-colors"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <GasFee
                        isLoading={loadingQuote || loading || checkingAlowance || loadingGasLimit}
                        className="mb-0"
                        gasLimit={gasLimit}
                        onGasChange={setHandledGasData}
                        border={false}
                        calls={confirmCalls}
                        onError={setFeeError}
                        hardCodeGasLimit={HARDCODED_GAS_LIMIT}
                    />
                </div>

                {!!warningMessage && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                        <div className="text-amber-700 dark:text-amber-300 text-sm">
                            {warningMessage}
                        </div>
                    </div>
                )}

                {!!error && !swapSentSheetVisible && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                        <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
                    </div>
                )}

                {/* Action Button */}
                {supportApproveAndSwap ? (
                    <button
                        className="btn btn-primary w-full h-14 min-h-[56px] text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
                        onClick={() => void wrapSubmit(() => onSwapPress())}
                        disabled={buttonDisabled}>
                        {needApproveAllowance ? 'Approve & Swap' : 'Swap'}
                    </button>
                ) : (
                    <div className="mb-4 mt-2">
                        {approvingAllowance ? (
                            <button
                                className="btn btn-primary w-full h-14 min-h-[56px] text-base font-semibold shadow-lg"
                                disabled>
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Approving...
                                </div>
                            </button>
                        ) : needApproveAllowance ? (
                            <button
                                disabled={!!error || loadingGasLimit}
                                className="btn btn-primary w-full h-14 min-h-[56px] text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
                                onClick={() => void wrapSubmit(() => onGivePermissionPress())}>
                                Give permission to swap {fromCoin?.symbol}
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary w-full h-14 min-h-[56px] text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
                                onClick={() => void wrapSubmit(() => onSwapPress())}
                                disabled={buttonDisabled}>
                                {needApproveAllowance ? 'Approve & Swap' : 'Swap'}
                            </button>
                        )}
                    </div>
                )}

                {/* Powered By Section */}
                {poweredBy ? (
                    <div className="flex flex-row items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Powered by{' '}
                            <p className="inline-block text-black dark:text-white font-semibold">
                                {poweredBy}
                            </p>
                        </div>
                        {poweredByLogo ? (
                            <img src={poweredByLogo} className="w-5 h-5" alt={poweredBy} />
                        ) : null}
                    </div>
                ) : null}
            </div>
            <CoinSelectorModal
                visible={coinSelectorModal}
                onClose={() => setCoinSelectorModal({ coinSelectorModal: false, type: '' })}
                onCoinPress={onToCoinItemPress}
                onLoadStart={() => setLoadingToCoins(true)}
                onLoadEnd={onLoadToCoinsEnd}
                excludeUsd={true}
                network={selectedNetwork}
            />
            <CustomCoinSelectorModal
                visible={fromCoinSelectorModalVisible}
                onClose={() => setFromCoinSelectorModalVisible(false)}
                onCoinPress={onFromCoinItemPress}
                data={coins}
                walletAddress={walletAddress ?? ''}
                network={selectedNetwork}
                onLoadStart={() => setLoadingFromCoins(true)}
                onLoadEnd={onCustomCoinSelectorLoadEnd}
            />

            <SwapSentModal
                visible={swapSentSheetVisible}
                onCloseRequest={onSwapSentClose}
                onTryAgainPress={onTryAgainPress}
                txtData={txtData}
                onMenuPress={onPendingTransactionMenuPress}
                onSwapSuccess={onSwapSuccess}
                setTxtData={setTxtData}
                network={selectedNetwork}
            />
            <SpeedUpAndCancelModal
                visible={speedupAndCancelSheetVisible}
                data={txtData}
                type={speedupAndCancelType}
                onCloseRequest={() =>
                    setSpeedupAndCancelSheetData({ speedupAndCancelSheetVisible: false })
                }
            />

            <NetworkMenu
                visible={networkMenuVisible}
                excludeNetworks={excludedNetworks}
                onNetworkChange={onNetworkChange}
                onClosePress={() => setNetworkMenuVisible(false)}
                customNetwork
            />

            {hardwareModal}
        </div>
    );
});

export default Swap;
