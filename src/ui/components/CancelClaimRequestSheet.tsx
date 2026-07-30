import { formatNumber } from '../../shared/utils/format';
import { ethers, TransactionResponse } from 'ethers';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { getErrorMessage } from '../../api/graphQL/BaseRequest';
import { AccountCallInput } from '../../api/graphQL/Types';
import { LiquidStakingData, MergedLiquidStakingRequest } from '../../lib/liquid-staking/Types';
import ErrorMessages from '../../shared/messages/ErrorMessages';
import { EARN_PARTNERS, EarnItem } from '../../shared/types/Earn';
import { HandledGasData, PendingTransaction, TxtToken } from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import {
    addPendingTransaction,
    cancelUnstakeRequest,
    estimateCancelUnstakeRequest,
    getCancelUnstakeRequestCall,
    getTokenBalance,
    setLiquidStakingProvider,
} from '../../store/actions/uiActions';
import { useCurrentAccount, useCurrentWallet, useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import AccountView from './AccountView';
import GasFee from './GasFee';
import Modal from './Modal';

type Props = {
    visible: boolean;
    onCloseRequest: () => void;
    onCancelSuccess: (tx: PendingTransaction) => void;
    data: MergedLiquidStakingRequest | null;
    earnItem?: EarnItem;
};

const CancelClaimRequestSheet = React.memo<Props>((props: Props) => {
    const {
        data,
        earnItem,
        earnItem: { fromCoin, toCoin } = {},
        visible,
        onCloseRequest,
        onCancelSuccess,
    } = props;

    const dispatch = useAppDispatch();

    const selectedNetwork = useSelectedNetwork();
    const currentAccount = useCurrentAccount();
    const currentWallet = useCurrentWallet();

    const [{ balance }, setBalanceData] = useState<{
        balance: bigint;
        decimals: number;
        error: boolean;
    }>({ balance: BigInt(0), decimals: 18, error: false });
    const [stakingProvider, setStakingProvider] = useState<LiquidStakingData | undefined>();
    const [loadingGasLimit, setLoadingGasLimit] = useState(false);
    const [gasLimit, setGasLimit] = useState<number>(0);
    const [{ gasInfo, gasPrice: currentGasPrice }, setHandledGasData] = useState<HandledGasData>({
        gasInfo: {},
        gasPrice: 0n,
    });
    const [error, setError] = useState('');
    const [confirmCalls, setConfirmCalls] = useState<AccountCallInput[]>([]);

    const gasFee = useMemo(() => {
        return currentGasPrice * BigInt(gasLimit);
    }, [currentGasPrice, gasLimit]);

    const sharesValue = useMemo(() => {
        if (data) {
            const numStr = ethers.formatUnits(data.shares, earnItem?.toCoin.decimals);
            return parseFloat(numStr);
        }

        return 0;
    }, [data, earnItem]);

    const value = useMemo(() => {
        if (sharesValue) {
            return formatNumber(sharesValue);
        }

        return '';
    }, [sharesValue]);

    const walletAddress = useMemo(() => currentAccount?.address, [currentAccount]);

    const onCancelPress = useCallback(async () => {
        if (!walletAddress || !gasInfo || !currentWallet || !currentAccount || !data) {
            return;
        }

        const onTransactionSent = async (txt: TransactionResponse | null) => {
            if (txt && fromCoin && toCoin) {
                const txtTokens: TxtToken[] = [
                    {
                        token_id: toCoin.tokenAddress,
                        symbol: toCoin.symbol,
                        icon: toCoin.imageUrl,
                        is_nft: false,
                        name: toCoin.name,
                    },
                    {
                        token_id: fromCoin.tokenAddress,
                        symbol: fromCoin.symbol,
                        icon: fromCoin.imageUrl,
                        is_nft: false,
                        name: fromCoin.name,
                    },
                ];

                const pendingTx: PendingTransaction = {
                    id: uuid(),
                    type: 'cancel-claim-request',
                    sender: walletAddress,
                    receiver: stakingProvider!.contractAddress,
                    txHash: txt.hash,
                    gasInfo,
                    amount: sharesValue,
                    network: selectedNetwork,
                    tokens: txtTokens,
                    trackData: {
                        amount: sharesValue,
                        symbol: toCoin.symbol,
                    },
                    cancelling: true,
                };

                dispatch(addPendingTransaction(selectedNetwork.platform_id, pendingTx));

                onCancelSuccess(pendingTx);
                onCloseRequest();
            }
        };

        dispatch(cancelUnstakeRequest(data.id, walletAddress, gasInfo, gasLimit)).then(
            onTransactionSent,
        );
    }, [
        walletAddress,
        gasInfo,
        currentWallet,
        currentAccount,
        data,
        gasLimit,
        fromCoin,
        toCoin,
        selectedNetwork,
        dispatch,
        onCancelSuccess,
        onCloseRequest,
        stakingProvider,
        sharesValue,
    ]);

    useEffect(() => {
        if (!data?.id || !walletAddress) {
            setConfirmCalls([]);
            return;
        }

        const loadConfirmCalls = async () => {
            try {
                const cancelUnstakeRequestCall = await getCancelUnstakeRequestCall(
                    data.id,
                    walletAddress,
                );
                setConfirmCalls([cancelUnstakeRequestCall]);
                logger.log('🏄🏽‍♂️ Confirm calls', [cancelUnstakeRequestCall]);
            } catch (err) {
                logger.error('Error creating calls for cancel claim', err);
                setConfirmCalls([]);
            }
        };

        loadConfirmCalls();
    }, [data, walletAddress]);

    useEffect(() => {
        if (earnItem) {
            setLiquidStakingProvider(earnItem.type).then(provider => {
                setStakingProvider(provider);
            });
        }
    }, [earnItem]);

    useEffect(() => {
        if (visible && gasFee) {
            if (gasFee > balance) {
                setError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_GAS);
            } else {
                setError('');
            }
        }
    }, [balance, gasFee, visible]);

    useEffect(() => {
        if (visible && walletAddress && fromCoin) {
            getTokenBalance(walletAddress, fromCoin.tokenAddress, true).then(_balance => {
                setBalanceData(_balance);
            });
        }
    }, [visible, walletAddress, fromCoin]);

    useEffect(() => {
        if (!visible) {
            setGasLimit(0);
            setLoadingGasLimit(true);
            setError('');
        }
    }, [visible]);

    useEffect(() => {
        if (visible && data?.id && walletAddress) {
            setLoadingGasLimit(true);
            estimateCancelUnstakeRequest(data.id, walletAddress)
                .then(_gasLimit => {
                    if (_gasLimit) {
                        setGasLimit(Number(_gasLimit));
                        setError('');
                    }
                })
                .catch(e => {
                    const message = getErrorMessage(e);
                    setError(message);
                    logger.error('Estimate Gas', e);
                })
                .finally(() => {
                    setLoadingGasLimit(false);
                });
        }
    }, [visible, walletAddress, data]);

    const partner = useMemo(() => {
        return EARN_PARTNERS.find(p => p.name === earnItem?.partner_name);
    }, [earnItem?.partner_name]);

    return (
        <Modal visible={visible} onClose={onCloseRequest}>
            {data && (
                <div className="flex flex-col gap-4 p-5">
                    <div className="flex flex-col items-center gap-2">
                        {partner?.imageUrl ? (
                            <img src={partner?.imageUrl} className="w-8 h-8" alt="Icon" />
                        ) : null}

                        <div className="text-lg">{`Cancel ${value} ${earnItem?.toCoin.symbol} Claim Request`}</div>
                    </div>

                    {currentAccount && (
                        <AccountView account={currentAccount} isSmartWallet={false} />
                    )}

                    <GasFee
                        isLoading={loadingGasLimit}
                        gasLimit={gasLimit}
                        onGasChange={setHandledGasData}
                        calls={confirmCalls}
                    />

                    {error ? <div className="text-sm text-red-600">{error}</div> : null}

                    <div className="grid grid-cols-2 gap-4">
                        <button className="btn" onClick={onCloseRequest}>
                            CLOSE
                        </button>

                        <button
                            disabled={!!error || gasFee === 0n}
                            className="btn btn-danger"
                            onClick={onCancelPress}>
                            CANCEL REQUEST
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
});

export default CancelClaimRequestSheet;
