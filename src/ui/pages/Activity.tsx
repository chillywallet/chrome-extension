import React, { useCallback, useState } from 'react';
import { PendingTransaction, Transaction } from '../../shared/types/Wallet';
import { useCurrentAccount, useSmartAddress } from '../../store/selectors';
import BottomNav from '../components/BottomNav';
import PendingTransactionModal from '../components/PendingTransactionModal';
import ScrollWithButton from '../components/ScrollWithButton';
import SpeedUpAndCancelModal, { SpeedUpAndCancelTxData } from '../components/SpeedUpAndCancelModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import TransactionPortfolio from '../components/TransactionPortfolio';
import WalletProvider, { useWalletData } from './Home/WalletProvider';

const ActivityContent = React.memo(() => {
    const currentAccount = useCurrentAccount();
    const { containerClass, hasMore, onLoadMore } = useWalletData();

    const [{ isShowTransactionDetail, transactionDetailData }, setTransactionDetail] = useState<{
        transactionDetailData?: Transaction;
        isShowTransactionDetail: boolean;
    }>({ isShowTransactionDetail: false });
    const [{ isShowPendingTxDetail, pendingTxDetailData }, setPendingTxDetail] = useState<{
        pendingTxDetailData?: PendingTransaction;
        isShowPendingTxDetail: boolean;
    }>({ isShowPendingTxDetail: false });
    const [cancelSpeedUpTxData, setCancelSpeedUpTxData] = useState<SpeedUpAndCancelTxData>({
        visible: false,
    });

    const onTransactionPress = useCallback((transaction: Transaction) => {
        setTransactionDetail({ transactionDetailData: transaction, isShowTransactionDetail: true });
    }, []);

    const onPendingTransactionPress = useCallback((transaction: PendingTransaction) => {
        setPendingTxDetail({ isShowPendingTxDetail: true, pendingTxDetailData: transaction });
    }, []);

    return (
        <div className="flex flex-col h-full min-h-0">
            <ScrollWithButton
                className={'flex flex-col flex-1 min-h-0 w-full overflow-y-auto ' + containerClass}>
                <h1 className="font-display text-[26px] leading-tight font-medium px-4 pt-5 pb-4">
                    Activity
                </h1>

                <TransactionPortfolio
                    grouped
                    hasMore={hasMore}
                    onLoadMore={onLoadMore}
                    onTransactionPress={onTransactionPress}
                    onPendingTransactionPress={onPendingTransactionPress}
                    walletAddress={currentAccount?.address ?? ''}
                    containerClass={containerClass}
                    setCancelSpeedUpTxData={setCancelSpeedUpTxData}
                />
            </ScrollWithButton>

            <BottomNav />

            <TransactionDetailModal
                visible={isShowTransactionDetail}
                data={transactionDetailData}
                onClosePress={() => setTransactionDetail({ isShowTransactionDetail: false })}
            />
            <PendingTransactionModal
                visible={isShowPendingTxDetail}
                data={pendingTxDetailData}
                onClosePress={() => setPendingTxDetail({ isShowPendingTxDetail: false })}
            />
            <SpeedUpAndCancelModal
                {...cancelSpeedUpTxData}
                onCloseRequest={() => setCancelSpeedUpTxData({ visible: false })}
            />
        </div>
    );
});

/**
 * Activity is its own bottom-nav destination. It was previously the third sub-tab
 * inside the wallet view; the history data and paging still come from
 * WalletProvider, which is what loads and pages transactions.
 */
export default React.memo(() => {
    const currentAccount = useCurrentAccount();
    const smartAddress = useSmartAddress();

    return (
        <WalletProvider
            isSmartWallet={false}
            walletAddress={currentAccount?.address}
            otherAddress={smartAddress}>
            <ActivityContent />
        </WalletProvider>
    );
});
