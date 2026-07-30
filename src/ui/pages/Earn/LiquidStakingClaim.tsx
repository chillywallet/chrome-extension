import { ethers } from 'ethers';
import React, { useCallback, useEffect, useState } from 'react';
import { IoMdRefresh } from 'react-icons/io';
import { useHistory } from 'react-router-dom';
import { MergedLiquidStakingRequest } from '../../../lib/liquid-staking/Types';
import { EARN_LIQUID_STAKING_ROUTE, EARN_LIST_ROUTE } from '../../../shared/constants/routes';
import { PendingTransaction } from '../../../shared/types/Wallet';
import logger from '../../../shared/utils/logger';
import { getClaimRequests } from '../../../store/actions/uiActions';
import { useCurrentAddress, useSelectedNetwork } from '../../../store/selectors';
import CancelClaimRequestSheet from '../../components/CancelClaimRequestSheet';
import { ClaimCard, ClaimCardPlaceholder } from '../../components/ClaimCard';
import ClaimConfirmRequestSheet from '../../components/ClaimConfirmRequestSheet';
import Header from '../../components/Header';
import SwapSentModal from '../../components/SwapSentModal';
import Toast from '../../components/Toast';
import { useEarnData } from './EarnProvider';

type Props = {};

export default React.memo<Props>(() => {
    const { liquidStakingClaimData } = useEarnData();
    const { data, waitTime } = liquidStakingClaimData ?? {};

    const history = useHistory();

    const selectedNetwork = useSelectedNetwork();
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [claimRequests, setClaimRequests] = useState<MergedLiquidStakingRequest[]>([]);
    const [claimRequestSheetVisible, setClaimRequestSheetVisible] = useState(false);
    const [cancelRequestSheetVisible, setCancelRequestSheetVisible] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState<MergedLiquidStakingRequest | null>(null);
    const [txData, setTxData] = useState<PendingTransaction>();
    const [txSentSheetVisible, setTxSentSheetVisible] = useState(false);
    const address = useCurrentAddress(false);

    const getRequests = useCallback(async () => {
        if (!data) {
            return;
        }

        try {
            const result = await getClaimRequests(data?.type, address ?? '');
            const requests: MergedLiquidStakingRequest[] = [];
            let claimableAsset: MergedLiquidStakingRequest | undefined;
            let totalShares = 0;
            let requestCount = 0;
            let requestIds: number[] = [];

            result
                .filter(item => !item.claimed)
                .forEach(item => {
                    if (item.is_claimable && data.requestsMerged) {
                        claimableAsset = item;
                        requestCount++;
                        totalShares += parseFloat(
                            ethers.formatUnits(item.shares, data?.toCoin.decimals),
                        );
                        requestIds.push(parseInt(item.id, 10));
                    } else {
                        requests.push(item);
                    }
                });

            if (claimableAsset && data.requestsMerged) {
                requests.unshift({
                    ...claimableAsset,
                    count: requestCount,
                    totalShares: totalShares,
                    requestIds,
                });
            }

            setClaimRequests(requests);
        } catch (e) {
            logger.error('getClaimRequests', e);
        }
    }, [address, data]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        getRequests().finally(() => setIsRefreshing(false));
    }, [getRequests]);

    const onClaimPress = useCallback((item: MergedLiquidStakingRequest) => {
        setSelectedClaim(item);
        setClaimRequestSheetVisible(true);
    }, []);

    const onCancelPress = useCallback((item: MergedLiquidStakingRequest) => {
        setSelectedClaim(item);
        setCancelRequestSheetVisible(true);
    }, []);

    const onTxSent = useCallback((tx: PendingTransaction) => {
        setTxData(tx);
        setTxSentSheetVisible(true);
    }, []);

    const onTxSentClose = useCallback(() => {
        setTxSentSheetVisible(false);
        setTxData(undefined);
        getRequests();
    }, [getRequests]);

    const onSwapSuccess = useCallback(
        (trackData: any, cancelled: boolean) => {
            const message = cancelled ? 'Claim Cancelled' : 'Claim Succeeded';
            Toast.showSuccess(message);
            getRequests();
        },
        [getRequests],
    );

    useEffect(() => {
        setLoading(true);
        getRequests().finally(() => setLoading(false));

        const interval = setInterval(onRefresh, 60000);
        return () => clearInterval(interval);
    }, [getRequests, onRefresh]);

    useEffect(() => {
        if (!data) {
            history.replace(EARN_LIST_ROUTE);
        }
    }, [data, history]);

    return (
        <div className="flex flex-col h-full min-h-[400px] relative">
            <Header
                title="Claim"
                onBackPress={() => {
                    history.replace(EARN_LIQUID_STAKING_ROUTE);
                }}
                action={
                    <button onClick={onRefresh}>
                        <IoMdRefresh
                            size={20}
                            className={
                                'text-black dark:text-white ' +
                                (isRefreshing ? 'custom-anim-fast' : '')
                            }
                        />
                    </button>
                }
            />

            <div className="flex flex-col p-5 overflow-y-auto gap-2">
                {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <ClaimCardPlaceholder key={String(index)} />
                    ))
                ) : claimRequests.length > 0 && data ? (
                    <>
                        {claimRequests.map(item => (
                            <ClaimCard
                                key={item.id}
                                data={item}
                                waitTime={waitTime ?? 0}
                                earnItem={data}
                                onClaimPress={onClaimPress}
                                onCancelPress={onCancelPress}
                            />
                        ))}
                    </>
                ) : (
                    <p className="text-sm text-gray-500 text-center">{`You have no MON to unstake. Please create a request first.`}</p>
                )}

                {claimRequestSheetVisible && data && (
                    <ClaimConfirmRequestSheet
                        visible={claimRequestSheetVisible}
                        onCloseRequest={() => setClaimRequestSheetVisible(false)}
                        earnItem={data}
                        data={selectedClaim}
                        onClaimSuccess={onTxSent}
                    />
                )}

                {cancelRequestSheetVisible && data && (
                    <CancelClaimRequestSheet
                        visible={cancelRequestSheetVisible}
                        onCloseRequest={() => setCancelRequestSheetVisible(false)}
                        earnItem={data}
                        data={selectedClaim}
                        onCancelSuccess={onTxSent}
                    />
                )}

                {txSentSheetVisible && (
                    <SwapSentModal
                        visible={txSentSheetVisible}
                        onCloseRequest={onTxSentClose}
                        txtData={txData}
                        onSwapSuccess={onSwapSuccess}
                        setTxtData={setTxData}
                        network={selectedNetwork}
                    />
                )}
            </div>
        </div>
    );
});
