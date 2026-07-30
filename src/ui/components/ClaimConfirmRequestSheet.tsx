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
    estimateUnstake,
    getTokenBalance,
    getUnstakeCall,
    setLiquidStakingProvider,
    unstake,
} from '../../store/actions/uiActions';
import { useCurrentAccount, useCurrentWallet, useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import AccountView from './AccountView';
import GasFee from './GasFee';
import Modal from './Modal';

type Props = {
    visible: boolean;
    onCloseRequest: () => void;
    onClaimSuccess: (tx: PendingTransaction) => void;
    data: MergedLiquidStakingRequest | null;
    earnItem?: EarnItem;
};

const ClaimConfirmRequestSheet = React.memo<Props>((props: Props) => {
    const {
        data,
        earnItem,
        earnItem: { fromCoin, toCoin } = {},
        visible,
        onCloseRequest,
        onClaimSuccess,
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
            if (earnItem?.requestsMerged) {
                return data.totalShares ?? 0;
            } else {
                const valStr = ethers.formatUnits(data.shares, earnItem?.toCoin.decimals);
                return parseFloat(valStr);
            }
        }

        return 0;
    }, [data, earnItem]);

    const value = useMemo(() => {
        return formatNumber(sharesValue);
    }, [sharesValue]);

    const ids = useMemo(() => {
        return earnItem?.requestsMerged ? data?.requestIds : data?.id;
    }, [data, earnItem]);

    const walletAddress = useMemo(() => currentAccount?.address, [currentAccount]);

    const onClaimPress = useCallback(async () => {
        if (!walletAddress || !gasInfo || !currentWallet || !currentAccount || !ids) {
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
                    type: 'unstake',
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
                };

                dispatch(addPendingTransaction(selectedNetwork.platform_id, pendingTx));

                onClaimSuccess(pendingTx);
                onCloseRequest();
            }
        };

        dispatch(unstake(walletAddress, ids, undefined, gasInfo, gasLimit)).then(onTransactionSent);
    }, [
        walletAddress,
        gasInfo,
        currentWallet,
        currentAccount,
        ids,
        gasLimit,
        fromCoin,
        toCoin,
        selectedNetwork,
        dispatch,
        onClaimSuccess,
        onCloseRequest,
        stakingProvider,
        sharesValue,
    ]);

    useEffect(() => {
        if (!data || !walletAddress || !ids) {
            setConfirmCalls([]);
            return;
        }

        const loadConfirmCalls = async () => {
            try {
                const unstakeCall = await getUnstakeCall(0n, walletAddress, ids);
                setConfirmCalls([unstakeCall]);
                logger.log('🏄🏽‍♂️ Confirm calls', [unstakeCall]);
            } catch (err) {
                logger.error('Error creating calls for claim', err);
                setConfirmCalls([]);
            }
        };

        loadConfirmCalls();
    }, [data, walletAddress, ids]);

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
        if (visible && data && earnItem && walletAddress) {
            const ids = earnItem.requestsMerged ? data?.requestIds : data.id;

            if (ids) {
                setLoadingGasLimit(true);
                estimateUnstake(walletAddress, ids)
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
        }
    }, [visible, walletAddress, data, earnItem]);

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

                        <div className="text-lg">{`Claim ${value} ${earnItem?.toCoin.symbol}`}</div>
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
                            CANCEL
                        </button>

                        <button
                            disabled={!!error || gasFee === 0n}
                            className="btn btn-primary"
                            onClick={onClaimPress}>
                            CLAIM
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
});

export default ClaimConfirmRequestSheet;
