import { formatMoney, formatNumber } from '../../../shared/utils/format';
import { formatUnits } from 'ethers';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { getDataForNftTransfer, getDataForTokenTransfer } from '../../../lib/web3';
import { DEFAULT_ROUTE } from '../../../shared/constants/routes';
import ErrorMessages from '../../../shared/messages/ErrorMessages';
import EventType from '../../../shared/types/EventType';
import {
    Asset,
    AssetType,
    GasInfo,
    HandledGasData,
    PendingTransaction,
    Receiver,
    SendAssetData,
    TxtToken,
} from '../../../shared/types/Wallet';
import eventManager from '../../../shared/utils/eventManager';
import logger from '../../../shared/utils/logger';
import {
    addPendingTransaction,
    estimateGasLimit,
    getNativeTokenBalance,
    sendTransaction,
} from '../../../store/actions/uiActions';
import {
    useCurrentAccount,
    useCurrentAddress,
    useIsTestnet,
    useNativeCoinBalance,
    useSelectedNetwork,
} from '../../../store/selectors';
import { useAppDispatch } from '../../../store/store';
import AssetLogo from '../../components/AssetLogo';
import ConfirmationHeader from '../../components/ConfirmationHeader';
import GasFee from '../../components/GasFee';
import Header from '../../components/Header';
import Toast from '../../components/Toast';
import WalletTag from '../../components/WalletTag';
import { useHardwareWalletSignModal } from '../../hooks/useHardwareWalletSignModal';

type Props = {
    assetData: SendAssetData;
    receiver: Receiver | null;
    value: bigint;
    usdValue?: number;
    balance: bigint;
    decimals: number;
    onTxSuccess: () => void;
};

const SendConfirmation = React.memo<Props>((props: Props) => {
    const {
        assetData: { coinToSend: coin, nftToSend: nft, isAAWallet },
        receiver,
        value: coinValue,
        usdValue: coinUSDValue,
        balance: coinBalance,
        decimals,
        onTxSuccess,
    } = props;
    const dispatch = useAppDispatch();
    const history = useHistory();
    const currentAccount = useCurrentAccount();
    const selectedNetwork = useSelectedNetwork();
    const isTestnet = useIsTestnet();
    const currentAddress = useCurrentAddress(isAAWallet);
    const nativeCoinBalance = useNativeCoinBalance(currentAddress);


    const [remoteError, setRemoteError] = useState('');
    const [localError, setLocalError] = useState('');
    const [gasFee, setGasFee] = useState(0n);
    const [gasInfo, setGasInfo] = useState<GasInfo | undefined>(undefined);
    const [asset, setAsset] = useState<Asset | null>(null);
    const [gasLimit, setGasLimit] = useState<number>(0);
    const [loadingGasLimit, setLoadingGasLimit] = useState(false);

    // Fee-related problems reported by the GasFee component.
    const [feeError, setFeeError] = useState('');

    const error = useMemo(() => {
        return localError ? localError : remoteError ? remoteError : feeError;
    }, [localError, remoteError, feeError]);

    const isLoadingGas = useMemo(() => {
        return !gasFee || loadingGasLimit;
    }, [gasFee, loadingGasLimit]);

    const formattedCoinValue = useMemo(() => {
        if (coinValue === 0n) {
            return 0;
        }

        return parseFloat(formatUnits(coinValue, decimals));
    }, [coinValue, decimals]);

    const isNativeCoin = useMemo(() => {
        return coin
            ? selectedNetwork.native_coin_address.toLowerCase() === coin.token_address.toLowerCase()
            : false;
    }, [coin, selectedNetwork]);

    const buttonDisabled = useMemo(() => {
        if (error) {
            return true;
        }

        return gasFee === 0n || loadingGasLimit;
    }, [error, gasFee, loadingGasLimit]);

    const emoji = useMemo(() => {
        return isAAWallet ? currentAccount?.metadata.avatar : currentAccount?.metadata.smartAvatar;
    }, [currentAccount, isAAWallet]);

    const confirmCalls = useMemo(() => {
        if (!asset || !receiver || !currentAddress) return undefined;

        const receiverAddress = receiver.walletAddress;

        const value = asset.type === AssetType.native ? coinValue.toString() : '0';
        const to = asset.type === AssetType.native ? receiverAddress : asset.address;
        const data =
            asset.type === AssetType.token
                ? getDataForTokenTransfer(coinValue.toString(), receiverAddress)
                : asset.type === AssetType.nft
                  ? getDataForNftTransfer(currentAddress, receiverAddress, asset)
                  : '0x';

        return [
            {
                to,
                value,
                data,
            },
        ];
    }, [receiver, asset, coinValue, currentAddress]);

    const { wrapSubmit, hardwareModal } = useHardwareWalletSignModal(
        isAAWallet ? null : currentAccount?.metadata.keyring.type,
    );

    const onGasChange = useCallback((gasData: HandledGasData, gasFee: bigint) => {
        setGasFee(gasFee);
        setGasInfo(gasData.gasInfo);
    }, []);

    const estimateGas = useCallback(async () => {
        if (!asset || !currentAddress || !receiver?.walletAddress) {
            throw new Error('Invalid asset or address');
        }

        const padding = selectedNetwork.gasPadding ? selectedNetwork.gasPadding / 100 : 1.1;
        logger.log('🔄 Padding', padding);

        try {
            const result = await estimateGasLimit(
                asset,
                currentAddress,
                receiver.walletAddress,
                coinValue,
                padding,
            );

            if (result) {
                return parseInt(result, 10);
            } else {
                throw new Error(ErrorMessages.ASSET_ERROR);
            }
        } catch (e: any) {
            const reason = e?.data?.originalError?.body
                ? JSON.parse(e?.data?.originalError?.body)?.error?.message
                : undefined;

            if (reason) {
                throw new Error(`Error: ${reason}<br/><br/>${ErrorMessages.ASSET_ERROR}`);
            } else {
                throw new Error(ErrorMessages.ASSET_ERROR);
            }
        }
    }, [asset, currentAddress, receiver?.walletAddress, coinValue, selectedNetwork]);

    const onConfirmPress = useCallback(async () => {
        if (asset && gasInfo && currentAddress && currentAccount) {
            const onError = (_error: any) => {
                const message = _error.reason
                    ? _error.reason
                    : (_error.message ?? 'Transaction failed.');

                if (
                    isAAWallet &&
                    (message.includes(
                        'did not have enough native tokens to cover the gas costs associated with the user operation.',
                    ) ||
                        message.includes(' to pay for this operation'))
                ) {
                    Toast.showError(
                        'Insufficient funds in your smart account to cover the required prefund.',
                    );
                } else {
                    Toast.showError(message);
                }
            };

            const onSuccessTxt = async (txHash: string) => {
                logger.log('Tx Hash', txHash);

                const txtTokens: TxtToken[] = [
                    {
                        token_id: selectedNetwork.native_coin_address,
                        symbol: coin?.symbol,
                        icon: coin?.icon ?? coin?.logo ?? '',
                        is_nft: false,
                        name: selectedNetwork.name,
                    },
                ];

                const pendingTx: PendingTransaction = {
                    id: uuid(),
                    type: 'transfer',
                    sender: currentAddress,
                    receiver: receiver?.walletAddress ?? '',
                    txHash: txHash,
                    gasInfo,
                    amount: formattedCoinValue,
                    network: selectedNetwork,
                    tokens: txtTokens,
                    asset,
                    trackData: {
                        amountUSD: coinUSDValue,
                        amount: formattedCoinValue,
                        symbol: coin?.symbol,
                        type: coin ? 'coin' : 'nft',
                        detail: coin ? coin : nft,
                    },
                };

                await dispatch(addPendingTransaction(selectedNetwork.platform_id, pendingTx));

                // Open Home screen with Transactions Tab is selected by default.
                onTxSuccess();
                Toast.showSuccess('Send Transaction succeeded.');
                history.replace(DEFAULT_ROUTE);

                setTimeout(() => {
                    eventManager.emit(EventType.REFRESH_WALLET);
                }, 3000);
            };

            let _gasLimit = gasLimit;

            {
                try {
                    const tx = await dispatch(
                        sendTransaction(
                            currentAccount?.address,
                            receiver?.walletAddress ?? '',
                            gasInfo,
                            _gasLimit,
                            coinValue,
                            asset,
                            isAAWallet,
                        ),
                    );

                    if (tx) {
                        onSuccessTxt(tx.hash);
                    }
                } catch (error) {
                    onError(error);
                }
            }
        }
    }, [
        currentAccount,
        asset,
        coin,
        coinValue,
        coinUSDValue,
        currentAddress,
        dispatch,
        gasInfo,
        gasLimit,
        history,
        nft,
        receiver?.walletAddress,
        selectedNetwork,
        onTxSuccess,
        isAAWallet,
        estimateGas,
        formattedCoinValue,
    ]);

    useEffect(() => {
        if ((nft || !isNativeCoin) && currentAddress) {
            dispatch(getNativeTokenBalance(currentAddress));
        }
    }, [currentAddress, dispatch, isNativeCoin, nft]);

    useEffect(() => {
        if (
            currentAddress &&
            asset &&
            !gasLimit
        ) {
            // Hardcode the gas limit for Monad Testnet.
            if (selectedNetwork.chain_key === 'monad_testnet' && isAAWallet) {
                setGasLimit(300000);
                setRemoteError('');
                return;
            }

            setLoadingGasLimit(true);
            estimateGas()
                .then(result => {
                    setGasLimit(result);
                    setRemoteError('');
                })
                .catch(e => {
                    setRemoteError(e.message);
                })
                .finally(() => {
                    setLoadingGasLimit(false);
                });
        }
    }, [
        asset,
        coinValue,
        currentAddress,
        receiver?.walletAddress,
        selectedNetwork,
        isAAWallet,
        gasLimit,
        estimateGas,
    ]);

    useEffect(() => {
        if (gasFee) {
            if (nft) {
                if (gasFee > nativeCoinBalance) {
                    setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_GAS);
                } else {
                    setLocalError('');
                }
            } else {
                if (isNativeCoin) {
                    if (coinValue + gasFee > coinBalance) {
                        setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS);
                    } else {
                        setLocalError('');
                    }
                } else {
                    if (gasFee > nativeCoinBalance) {
                        setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_GAS);
                    } else {
                        setLocalError('');
                    }
                }
            }
        }
    }, [coinBalance, coinValue, gasFee, nft, nativeCoinBalance, isNativeCoin]);

    useEffect(() => {
        const _asset = nft
            ? {
                  type: AssetType.nft,
                  id: nft.token_id,
                  address: nft.contract_address,
                  name: nft.name,
                  nftType: nft.contract.type,
              }
            : coin
              ? {
                    type: isNativeCoin ? AssetType.native : AssetType.token,
                    id: coin.symbol?.toLowerCase() ?? '',
                    address: coin.token_address,
                    symbol: coin.symbol,
                    name: coin.coin_name,
                    decimals: coin.decimals,
                }
              : null;

        if (_asset) {
            setAsset(_asset);
        }
    }, [nft, coin, isNativeCoin]);

    return (
        <div className="flex flex-col h-full">
            <Header title="Sending Confirmation" action={<WalletTag isAAWallet={isAAWallet} />} />

            <div className="flex flex-col flex-1 p-5  min-h-[400px]">
                <div className="flex-1">
                    <ConfirmationHeader
                        mode="padding"
                        className="mb-3"
                        from={{
                            name: currentAccount?.metadata.name ?? 'Unknown',
                            address: currentAddress ?? '',
                            emoji,
                        }}
                        to={{
                            name: receiver?.name ?? 'Unknown',
                            address: receiver?.walletAddress,
                            emoji: receiver?.avatar,
                        }}
                    />

                    <div className="w-full text-sm py-3 border border-slate-200 dark:border-darkline rounded-md mb-3">
                        <div className="mb-1 px-3">Sending Asset</div>
                        {coin ? (
                            <div className="flex flex-row items-center w-full px-3">
                                <AssetLogo
                                    src={(coin.icon ? coin.icon : coin.logo) ?? undefined}
                                    platform_id={coin.platform_id}
                                    width={24}
                                />
                                <div className="ml-3 flex flex-col">
                                    <div>
                                        {formatNumber(formattedCoinValue)} {coin.symbol}
                                    </div>
                                    {!isTestnet && coinUSDValue && coinUSDValue > 0 && (
                                        <div className="text-sm text-gray-400">
                                            {formatMoney(coinUSDValue)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : nft ? (
                            <div className="flex flex-row items-center w-full px-3">
                                <div className="flex bg-gray-300 w-9 h-9 rounded-md overflow-hidden">
                                    {nft.image_url ? (
                                        <img
                                            src={nft.image_url}
                                            className="w-full h-full"
                                            alt="NFT"
                                        />
                                    ) : null}
                                </div>
                                <div className="ml-3 flex flex-col">
                                    <div>{nft.nft_collection.name}</div>
                                    <div className="text-sm text-gray-400">{nft.name}</div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <GasFee
                        isLoading={isLoadingGas}
                        gasLimit={gasLimit}
                        onGasChange={onGasChange}
                        calls={confirmCalls}
                        isAAWallet={isAAWallet}
                        onError={setFeeError}
                        hardCodeGasLimit={
                            asset?.type === AssetType.nft
                                ? 200000
                                : asset?.type === AssetType.native
                                  ? 23000
                                  : 100000
                        }
                    />
                </div>

                {!!error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                        <div
                            className="text-red-600 dark:text-red-400 text-sm"
                            dangerouslySetInnerHTML={{ __html: error }}
                        />
                    </div>
                )}

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
                            onClick={e => {
                                e.preventDefault();
                                void wrapSubmit(() => onConfirmPress());
                            }}>
                            Send
                        </button>
                    </div>
                </div>
            </div>
            {hardwareModal}
        </div>
    );
});

export default SendConfirmation;
