import moment from 'moment';
import React, { useEffect, useMemo, useState } from 'react';
import CoinsUtils from '../../lib/CoinsUtils';
import { PENDING_TX_EXPIRED_TIME } from '../../shared/constants/common';
import EventType from '../../shared/types/EventType';
import { PendingTransaction, Transaction } from '../../shared/types/Wallet';
import eventManager from '../../shared/utils/eventManager';
import { removePendingTransactions } from '../../store/actions/uiActions';
import {
    usePendingTransactions,
    usePortfolioTransactions,
    useSelectedNetwork,
} from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import PendingTransactionCard from './PendingTransactionCard';
import { SpeedUpAndCancelTxData } from './SpeedUpAndCancelModal';
import TransactionCard, { Placeholder } from './TransactionCard';

type Props = {
    onPendingTransactionPress: (item: PendingTransaction) => void;
    onTransactionPress: (item: Transaction) => void;
    hasMore: boolean;
    onLoadMore: () => void;
    walletAddress: string;
    containerClass: string;
    setCancelSpeedUpTxData: (data: SpeedUpAndCancelTxData) => void;
};

export default React.memo<Props>((props: Props) => {
    const {
        hasMore,
        onLoadMore,
        onTransactionPress,
        onPendingTransactionPress,
        walletAddress,
        setCancelSpeedUpTxData,
    } = props;

    const dispatch = useAppDispatch();
    const transactions = usePortfolioTransactions(walletAddress);
    const pendingTxs = usePendingTransactions(walletAddress);
    const selectedNetwork = useSelectedNetwork();

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const func = (status: boolean) => {
            setIsLoading(status);
        };
        eventManager.on(EventType.TRANSACTION_LOADING_STATUS, func);

        return () => {
            eventManager.off(EventType.TRANSACTION_LOADING_STATUS, func);
        };
    }, []);

    useEffect(() => {
        const expiredPendingTxs = pendingTxs.filter(tx => {
            const isPending = !tx.status || tx.status === 'sending';

            if (tx.createdAt && isPending) {
                const createdDate = moment(tx.createdAt);
                const now = moment();

                return now.diff(createdDate, 'day') >= PENDING_TX_EXPIRED_TIME;
            }

            return false;
        });

        if (expiredPendingTxs.length) {
            const ids = expiredPendingTxs.map(tx => tx.id);
            dispatch(
                removePendingTransactions(
                    expiredPendingTxs[0].sender,
                    selectedNetwork.platform_id,
                    ids,
                ),
            );
        }
    }, [dispatch, pendingTxs, selectedNetwork.platform_id]);

    const transactionsWithCoins: Transaction[] = useMemo(() => {
        return transactions.map(_transaction => {
            _transaction.tokens = CoinsUtils.handleTokens(_transaction.tokens);

            return _transaction;
        });
    }, [transactions]);

    const unfinishedTransactions = useMemo(() => {
        let finishedTransactions: PendingTransaction[] = [];
        let unfinishedTransactions: PendingTransaction[] = [];

        pendingTxs.forEach(_pending => {
            let found = false;
            transactions.forEach(_transaction => {
                if (_pending.txHash === _transaction.additional_properties.transaction_hash) {
                    found = true;
                }
            });

            if (!found) {
                unfinishedTransactions.push(_pending);
            } else {
                finishedTransactions.push(_pending);
            }
        });

        if (finishedTransactions.length) {
            const ids = finishedTransactions.map(tx => tx.id);
            dispatch(
                removePendingTransactions(
                    finishedTransactions[0].sender,
                    selectedNetwork.platform_id,
                    ids,
                ),
            );
            // Refresh wallet
            eventManager.emit(EventType.REFRESH_WALLET);
        }

        return unfinishedTransactions;
    }, [dispatch, pendingTxs, selectedNetwork.platform_id, transactions]);

    useEffect(() => {
        const cb = (ids: string) => {
            const idArr = ids.split(',');
            const trx = transactions.find(item => idArr.indexOf(item._id));
            if (trx) {
                onTransactionPress(trx);
            }
        };
        eventManager.on(EventType.OPEN_TRANSACTION_MODAL, cb);

        return () => {
            eventManager.off(EventType.OPEN_TRANSACTION_MODAL, cb);
        };
    }, [onTransactionPress, transactions]);

    return (
        <div className="divide-y dark:divide-darker">
            {unfinishedTransactions.map((_history, index) => (
                <PendingTransactionCard
                    key={index}
                    data={_history}
                    onPress={onPendingTransactionPress}
                    setCancelSpeedUpTxData={setCancelSpeedUpTxData}
                />
            ))}

            {transactionsWithCoins.map((_history, index) => (
                <TransactionCard key={index} data={_history} onPress={onTransactionPress} />
            ))}

            {!isLoading && unfinishedTransactions.length + transactionsWithCoins.length === 0 && (
                <p className="text-sm text-gray-400 text-center pt-3">There are no transactions</p>
            )}

            {hasMore && !isLoading && (
                <button
                    className="w-full p-3 text-center text-sm text-gray-400 hover:bg-gray-100 dark:hover:bg-darker"
                    onClick={onLoadMore}>
                    Load more
                </button>
            )}

            {isLoading && [...Array(2)].map((_, index) => <Placeholder key={index} />)}
        </div>
    );
});
