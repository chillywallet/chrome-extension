import { formatMoney, formatNumber } from '../../shared/utils/format';
import { formatUnits } from 'ethers';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronDown, FaChevronUp, FaInfoCircle } from 'react-icons/fa';
import { MdOutlineSwapVert } from 'react-icons/md';
import { serializeBigInt } from '../../lib/bigintSerializer';
import CoinsUtils from '../../lib/CoinsUtils';
import { getNativeSymbol, safeParseUnits } from '../../lib/WalletUtils';
import { ANIM_DURATION } from '../../shared/constants/app';
import { ChainData, GasPriceType } from '../../shared/types/Chain';
import EventType from '../../shared/types/EventType';
import { GasInfo, GasType, GasTypeNameIcon } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import { getFloatNumber } from '../../shared/utils/string';
import { setCustomGas, setGasType } from '../../store/actions/uiActions';
import {
    useActualTheme,
    useGasInfo,
    useNativeCoinPrice,
    useSelectedNetwork,
} from '../../store/selectors';
import { getReduxStore, useAppDispatch } from '../../store/store';
import AdvancedNumberInput from '../components/AdvancedNumberInput';

const GAS_TYPES = [
    { type: GasType.Low, info: GasTypeNameIcon[GasType.Low] },
    { type: GasType.Medium, info: GasTypeNameIcon[GasType.Medium] },
    { type: GasType.High, info: GasTypeNameIcon[GasType.High] },
    { type: GasType.Custom, info: GasTypeNameIcon[GasType.Custom] },
];

const getGasTypes = (showSuggest: boolean) => {
    const types = [...GAS_TYPES];
    if (showSuggest) {
        types.unshift({
            type: GasType.Suggest,
            info: GasTypeNameIcon[GasType.Suggest],
        });
    }

    return types;
};

type Props = {
    gasLimit?: number;
    suggestionGas?: GasInfo;
    initGasType?: GasType;
    initExpanded?: boolean;
    network?: ChainData;
};

export default React.memo<Props>((props: Props) => {
    const { gasLimit, suggestionGas, initGasType, initExpanded = false, network } = props;

    const actualTheme = useActualTheme();

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    const dispatch = useAppDispatch();
    const globalSelectedNetwork = useSelectedNetwork();
    const nativeCoinPrice = useNativeCoinPrice();

    const gasPriceRef = useRef<string>('');
    const priorityFeeRef = useRef<string>('');
    const baseFeeRef = useRef<string>('');

    const [expanded, setExpanded] = useState<boolean>(initExpanded);
    const [priorityFee, setPriorityFee] = useState('');
    const [priorityFeeCoin, setPriorityFeeCoin] = useState('');
    const [gasPriceCoin, setGasPriceCoin] = useState('');
    const [gasPrice, setGasPrice] = useState('');
    const [baseFee, setBaseFee] = useState('');
    const [baseFeeCoin, setBaseFeeCoin] = useState('');
    const [totalFeeMode, setTotalFeeMode] = useState<'coin' | 'usd'>('usd');

    const selectedNetwork = useMemo(() => {
        return network ? network : globalSelectedNetwork;
    }, [network, globalSelectedNetwork]);

    const { gasType, gasOptionsData, customGas } = useGasInfo(selectedNetwork.chain_id);

    const [currentGasType, setCurrentGasType] = useState(
        initGasType ? initGasType : suggestionGas ? GasType.Suggest : gasType,
    );

    const currentGasLimit = useMemo(() => {
        return gasLimit ? gasLimit : 0;
    }, [gasLimit]);

    const symbol = useMemo(() => {
        return getNativeSymbol(selectedNetwork.chain_key);
    }, [selectedNetwork]);

    const priorityFeeNum = useMemo(() => {
        return getFloatNumber(priorityFee);
    }, [priorityFee]);

    const gasPriceNum = useMemo(() => {
        return getFloatNumber(gasPrice);
    }, [gasPrice]);

    const baseFeeNum = useMemo(() => {
        return getFloatNumber(baseFee);
    }, [baseFee]);

    const currentBaseFeeBigInt = useMemo(() => {
        if (!gasOptionsData?.currentBaseFee) {
            return 0n;
        }
        return typeof gasOptionsData.currentBaseFee === 'bigint'
            ? gasOptionsData.currentBaseFee
            : BigInt(gasOptionsData.currentBaseFee);
    }, [gasOptionsData?.currentBaseFee]);

    const currentBaseFeeDisplay = useMemo(() => {
        if (!currentBaseFeeBigInt) {
            return false;
        }

        return formatNumber(Number(formatUnits(currentBaseFeeBigInt, 'gwei')));
    }, [currentBaseFeeBigInt]);

    const showBaseFeeWarning = useMemo(() => {
        if (!currentBaseFeeBigInt || !baseFee) {
            return false;
        }

        const maxBaseFeeBigInt = safeParseUnits(baseFee, 9);
        return maxBaseFeeBigInt < currentBaseFeeBigInt;
    }, [currentBaseFeeBigInt, baseFee]);

    const onTotalFeePress = useCallback(() => {
        setTotalFeeMode(totalFeeMode === 'usd' ? 'coin' : 'usd');
    }, [totalFeeMode]);

    const estimatedGasFee = useMemo(() => {
        if (!currentGasLimit) {
            return 0;
        }

        const _baseFee = Number(formatUnits(currentBaseFeeBigInt, 'gwei'));
        const _gasPrice =
            selectedNetwork?.gasPriceType === GasPriceType.BaseAndPriority
                ? _baseFee + priorityFeeNum
                : gasPriceNum;
        return _gasPrice * currentGasLimit * 0.000000001;
    }, [
        currentGasLimit,
        currentBaseFeeBigInt,
        selectedNetwork?.gasPriceType,
        priorityFeeNum,
        gasPriceNum,
    ]);

    const maxGasFee = useMemo(() => {
        if (!currentGasLimit) {
            return 0;
        }
        const _gasPrice =
            selectedNetwork?.gasPriceType === GasPriceType.BaseAndPriority
                ? baseFeeNum + priorityFeeNum
                : gasPriceNum;
        return _gasPrice * currentGasLimit * 0.000000001;
    }, [currentGasLimit, baseFeeNum, priorityFeeNum, gasPriceNum, selectedNetwork]);

    const onGasTypePress = useCallback(
        (type: GasType) => {
            gasPriceRef.current = '';
            priorityFeeRef.current = '';
            baseFeeRef.current = '';
            setCurrentGasType(type);

            dispatch(setGasType(type, selectedNetwork));

            eventManager.emit(EventType.CHANGE_GAS_TYPE, type);

            if (type === GasType.Custom) {
                if (!expanded) {
                    setExpanded(true);
                }

                setTimeout(() => {
                    window.scrollTo({
                        top: document.body.scrollHeight,
                        behavior: 'smooth',
                    });
                }, ANIM_DURATION);
            }
        },
        [dispatch, selectedNetwork, expanded],
    );

    const updateCustomGas = useCallback(
        (newCustomGas: GasInfo) => {
            if (currentGasType !== GasType.Custom) {
                setCurrentGasType(GasType.Custom);

                dispatch(setGasType(GasType.Custom, selectedNetwork));
                dispatch(setCustomGas(newCustomGas, selectedNetwork));

                eventManager.emit(EventType.CHANGE_GAS_TYPE, GasType.Custom);
            } else if (
                !customGas ||
                JSON.stringify(serializeBigInt(newCustomGas)) !==
                    JSON.stringify(serializeBigInt(customGas))
            ) {
                dispatch(setCustomGas(newCustomGas, selectedNetwork));
            }
        },
        [currentGasType, customGas, dispatch, selectedNetwork],
    );

    const handleGasPriceChangeText = useCallback(
        (text: string) => {
            const handledText = text.replace(',', '.');
            const newCustomGas: GasInfo = {
                gasPrice: safeParseUnits(handledText, 9),
            };

            gasPriceRef.current = handledText;
            priorityFeeRef.current = '';
            baseFeeRef.current = '';
            updateCustomGas(newCustomGas);
        },
        [updateCustomGas],
    );

    const handlePriorityFeeChangeText = useCallback(
        (text: string) => {
            const handledText = text.replace(',', '.');
            const _baseFeeStr = baseFeeNum
                ? baseFeeNum.toString()
                : gasOptionsData?.medium.baseFee
                ? gasOptionsData.medium.baseFee.toString()
                : '0';
            const _priorityFee = safeParseUnits(handledText, 9);
            const _baseFee = safeParseUnits(_baseFeeStr, 9);
            const _maxFeePerGas = _baseFee + _priorityFee;
            const newCustomGas: GasInfo = {
                priorityFee: _priorityFee,
                baseFee: _baseFee,
                maxFeePerGas: _maxFeePerGas,
            };

            gasPriceRef.current = '';
            priorityFeeRef.current = handledText;
            baseFeeRef.current = '';
            updateCustomGas(newCustomGas);
        },
        [updateCustomGas, baseFeeNum, gasOptionsData],
    );

    const handleBaseFeeChangeText = useCallback(
        (text: string) => {
            const handledText = text.replace(',', '.');
            const _priorityFeeStr = priorityFeeNum ? priorityFeeNum.toString() : '0';
            const _priorityFee = safeParseUnits(_priorityFeeStr, 9);
            const _baseFee = safeParseUnits(handledText, 9);
            const _maxFeePerGas = _priorityFee + _baseFee;
            const newCustomGas: GasInfo = {
                priorityFee: _priorityFee,
                baseFee: _baseFee,
                maxFeePerGas: _maxFeePerGas,
            };

            gasPriceRef.current = '';
            priorityFeeRef.current = '';
            baseFeeRef.current = handledText;
            updateCustomGas(newCustomGas);
        },
        [updateCustomGas, priorityFeeNum],
    );

    useEffect(() => {
        if (network) {
            const _gasType = getReduxStore()?.getState().globalState.gasType[network.chain_id];

            if (_gasType) {
                setCurrentGasType(_gasType);
            }
        }
    }, [network]);

    useEffect(() => {
        if (selectedNetwork) {
            if (selectedNetwork.gasPriceType === GasPriceType.BaseAndPriority) {
                let _priorityFee = 0n;
                let _baseFee = 0n;

                if (
                    currentGasType === GasType.Suggest &&
                    suggestionGas?.baseFee &&
                    suggestionGas?.maxFeePerGas
                ) {
                    _priorityFee = suggestionGas.priorityFee ?? 0n;
                    _baseFee = suggestionGas.baseFee;
                } else if (
                    currentGasType === GasType.Custom &&
                    customGas?.baseFee &&
                    customGas?.maxFeePerGas
                ) {
                    _priorityFee = customGas.priorityFee ?? 0n;
                    _baseFee = customGas.baseFee;
                } else if (gasOptionsData) {
                    const option =
                        currentGasType === GasType.Low
                            ? gasOptionsData.low
                            : currentGasType === GasType.High
                            ? gasOptionsData.high
                            : gasOptionsData.medium;

                    _priorityFee = option?.priorityFee ?? 0n;
                    _baseFee = option?.baseFee ?? 0n;
                }

                const priorityFeeRefBigInt = safeParseUnits(priorityFeeRef.current, 9);
                const baseFeeRefBigInt = safeParseUnits(baseFeeRef.current, 9);

                if (!priorityFeeRef.current || priorityFeeRefBigInt !== _priorityFee) {
                    setPriorityFee(formatUnits(_priorityFee, 'gwei'));
                }

                if (!baseFeeRef.current || baseFeeRefBigInt !== _baseFee) {
                    setBaseFee(formatUnits(_baseFee, 'gwei'));
                }
            } else {
                let _gasPrice = 0n;

                if (currentGasType === GasType.Suggest && suggestionGas?.gasPrice) {
                    _gasPrice = suggestionGas.gasPrice;
                } else if (currentGasType === GasType.Custom && customGas?.gasPrice) {
                    _gasPrice = customGas.gasPrice;
                } else if (gasOptionsData) {
                    const option =
                        currentGasType === GasType.Low
                            ? gasOptionsData.low
                            : currentGasType === GasType.High
                            ? gasOptionsData.high
                            : gasOptionsData.medium;

                    _gasPrice = option?.gasPrice ?? 0n;
                }

                const gasPriceRefBigInt = safeParseUnits(gasPriceRef.current, 9);

                if (!gasPriceRef.current || gasPriceRefBigInt !== _gasPrice) {
                    setGasPrice(formatUnits(_gasPrice, 'gwei'));
                }
            }
        }
    }, [gasOptionsData, currentGasType, dispatch, customGas, selectedNetwork, suggestionGas]);

    useEffect(() => {
        CoinsUtils.fetchNativeCoinPrice(selectedNetwork);
    }, [selectedNetwork]);

    useEffect(() => {
        setPriorityFeeCoin(formatNumber(priorityFeeNum * 0.000000001) + ` ${symbol}`);
    }, [priorityFeeNum, symbol]);

    useEffect(() => {
        setGasPriceCoin(formatNumber(gasPriceNum * 0.000000001) + ` ${symbol}`);
    }, [gasPriceNum, symbol]);

    useEffect(() => {
        setBaseFeeCoin(formatNumber(baseFeeNum * 0.000000001) + ` ${symbol}`);
    }, [baseFeeNum, symbol]);

    return (
        <div>
            <div className="px-5 py-3 flex flex-1 flex-col gap-2">
                <div className="text-sm">
                    Choose how much network fee you want to pay for your transaction.
                </div>

                {gasLimit ? (
                    maxGasFee === 0 ? (
                        <>
                            <div className="bg-placeholder animate-pulse h-6 w-36 rounded-md mx-auto" />
                        </>
                    ) : !selectedNetwork?.testnet && nativeCoinPrice > 0 ? (
                        <>
                            <button
                                onClick={onTotalFeePress}
                                className="inline-flex flex-row items-center justify-center gap-1 text-xl font-bold hover:opacity-80 transition-opacity text-center">
                                {totalFeeMode === 'usd'
                                    ? formatMoney(nativeCoinPrice * estimatedGasFee)
                                    : `${formatNumber(estimatedGasFee)} ${symbol}`}
                                <MdOutlineSwapVert className="text-primary text-[18px]" />
                            </button>
                            <div className="text-center text-xs text-gray-500">
                                {`Max Fee: ${formatNumber(maxGasFee)} ${symbol} (${formatMoney(
                                    nativeCoinPrice * maxGasFee,
                                )})`}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-xl font-bold text-center">
                                {`${formatNumber(estimatedGasFee)} ${symbol}`}
                            </div>
                            <div className="text-center text-xs text-gray-500">
                                {`Max Fee: ${formatNumber(maxGasFee)} ${symbol}`}
                            </div>
                        </>
                    )
                ) : null}

                <div
                    className={`mt-2 grid gap-1 md:gap-2 ${
                        suggestionGas ? 'grid-cols-5' : 'grid-cols-4'
                    }`}>
                    {getGasTypes(!!suggestionGas).map(_gasType => (
                        <div
                            key={_gasType.type}
                            className={
                                'w-full flex flex-col items-center justify-center text-center py-2 cursor-pointer rounded-md border ' +
                                (currentGasType === _gasType.type
                                    ? 'bg-primary text-white border-primary'
                                    : '')
                            }
                            onClick={() => onGasTypePress(_gasType.type)}>
                            <span className="text-sm">{_gasType.info.icon}</span>
                            <span className="text-xs md:text-sm">{_gasType.info.name}</span>
                        </div>
                    ))}
                </div>

                {/* <div className='text-sm text-center'>
                    When the limit order triggers, the transaction will send with appropriate gas.
                </div> */}

                {/* <hr /> */}

                <div className="flex flex-row items-center justify-center mt-1 mb-2">
                    <button
                        onClick={() => {
                            setExpanded(!expanded);
                        }}
                        className="text-primary dark:text-white hover:underline flex flex-row items-center justify-center text-sm gap-2">
                        Advanced Options {expanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                </div>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: ANIM_DURATION }}
                            className="overflow-hidden">
                            <div className="flex flex-col gap-1">
                                {selectedNetwork?.gasPriceType === GasPriceType.GasPrice ? (
                                    <>
                                        <div className="flex flex-row items-center justify-between">
                                            <div className="flex flex-row items-center gap-2">
                                                <div className="text-sm">Gas Price</div>
                                                <button
                                                    data-tooltip-id="chilly-tooltip"
                                                    data-tooltip-variant={tooltipVariant}
                                                    data-tooltip-html={`Max priority fee (aka “miner tip”) goes directly to miners and incentivizes them to prioritize your transaction. You’ll most often pay your max setting.`}>
                                                    <FaInfoCircle className="text-black dark:text-white" />
                                                </button>
                                            </div>
                                        </div>

                                        <AdvancedNumberInput
                                            className="mb-2"
                                            value={gasPrice}
                                            subtitle={gasPriceCoin}
                                            onChange={e => setGasPrice(e.target.value)}
                                            placeholder={'0'}
                                            changeAmount={0.5}
                                            minValue={0.5}
                                            validations={[
                                                ['required', 'Gas Price is required'],
                                                ['isFloat', 'Gas Price is invalid'],
                                                [
                                                    `greaterThan:0`,
                                                    `Gas Price must be greater than 0 GWEI`,
                                                ],
                                            ]}
                                            realtime
                                            onValidChangeText={handleGasPriceChangeText}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <div className="flex flex-row items-center justify-between">
                                            <div className="flex flex-row items-center gap-2">
                                                <div className="text-sm">Max Priority Fee</div>
                                                <button
                                                    data-tooltip-id="chilly-tooltip"
                                                    data-tooltip-variant={tooltipVariant}
                                                    data-tooltip-html={`Max priority fee (aka “miner tip”) goes directly to miners and incentivizes them to prioritize your transaction. You’ll most often pay your max setting.`}>
                                                    <FaInfoCircle className="text-black dark:text-white" />
                                                </button>
                                            </div>
                                            <div className="text-xs">(GWEI)</div>
                                        </div>

                                        <AdvancedNumberInput
                                            className="mb-2"
                                            value={priorityFee}
                                            subtitle={priorityFeeCoin}
                                            onChange={e => setPriorityFee(e.target.value)}
                                            placeholder={'0'}
                                            changeAmount={0.5}
                                            minValue={0.5}
                                            validations={[
                                                ['required', 'Max Priority Fee is required'],
                                                ['isFloat', 'Max Priority Fee is invalid'],
                                                [
                                                    `minFloat:0`,
                                                    `Max Priority Fee must be at least 0 GWEI`,
                                                ],
                                            ]}
                                            realtime
                                            onValidChangeText={handlePriorityFeeChangeText}
                                        />

                                        <div className="flex flex-row items-center justify-between">
                                            <div className="flex flex-row items-center gap-2">
                                                <div className="text-sm">Max Base Fee</div>
                                                <button
                                                    data-tooltip-id="chilly-tooltip"
                                                    data-tooltip-variant={tooltipVariant}
                                                    data-tooltip-html={`This is the maximum base fee you're willing to pay for this transaction. Setting a higher max base fee prevents your transaction from getting stuck if fees rise.`}>
                                                    <FaInfoCircle className="text-black dark:text-white" />
                                                </button>
                                            </div>
                                            <div className="text-xs">(GWEI)</div>
                                        </div>

                                        <AdvancedNumberInput
                                            value={baseFee}
                                            subtitle={baseFeeCoin}
                                            onChange={e => setBaseFee(e.target.value)}
                                            placeholder={'0'}
                                            changeAmount={0.5}
                                            validations={[
                                                ['required', 'Base Fee is required'],
                                                ['isFloat', 'Base Fee is invalid'],
                                                [
                                                    `greaterThan:0`,
                                                    `Base Fee must be greater than 0 GWEI`,
                                                ],
                                            ]}
                                            realtime
                                            onValidChangeText={handleBaseFeeChangeText}
                                        />

                                        {currentBaseFeeDisplay && (
                                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                                Current Base Fee: {currentBaseFeeDisplay} GWEI
                                            </div>
                                        )}

                                        {showBaseFeeWarning && (
                                            <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-2 rounded">
                                                Max Base Fee is lower than the current base fee.
                                                Your transaction may get stuck.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});
