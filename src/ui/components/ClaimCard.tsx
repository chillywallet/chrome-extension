import { formatNumber } from '../../shared/utils/format';
import { ethers } from 'ethers';
import moment from 'moment';
import { useCallback, useMemo } from 'react';
import { MergedLiquidStakingRequest } from '../../lib/liquid-staking/Types';
import { EarnItem } from '../../shared/types/Earn';

type Props = {
    earnItem: EarnItem;
    waitTime: number;
    data: MergedLiquidStakingRequest;
    onClaimPress: (item: MergedLiquidStakingRequest) => void;
    onCancelPress: (item: MergedLiquidStakingRequest) => void;
};

const ClaimCardPlaceholder: React.FC = () => {
    return (
        <div className="bg-white text-sm dark:bg-dark p-4 rounded-lg shadow-md flex justify-between items-center">
            <div className="flex flex-col">
                <div className="w-24 h-4 bg-gray-300 animate-pulse rounded"></div>
                <div className="w-32 h-4 bg-gray-300 animate-pulse rounded mt-1"></div>
            </div>
        </div>
    );
};

const ClaimCard: React.FC<Props> = ({ data, earnItem, waitTime, onClaimPress, onCancelPress }) => {
    const value = useMemo(() => {
        if (data.is_claimable && earnItem.requestsMerged) {
            return formatNumber(data.totalShares ?? 0);
        }

        const valStr = ethers.formatUnits(data.shares, earnItem.toCoin.decimals);
        return formatNumber(parseFloat(valStr));
    }, [data, earnItem]);

    const waitTimeStr = useMemo(() => {
        if (!data.is_claimable) {
            const requestedAt = moment(Number(data.requested_at + '000'));
            requestedAt.add(waitTime, 'second');
            const diff = requestedAt.diff(moment(), 'second');
            return `Available in ~${moment.duration(diff, 'second').humanize()}`;
        }
        return '';
    }, [data, waitTime]);

    const onHandleClaimPress = useCallback(() => {
        if (data) {
            onClaimPress(data);
        }
    }, [data, onClaimPress]);

    const onCancelClaimPress = useCallback(() => {
        if (data) {
            onCancelPress(data);
        }
    }, [data, onCancelPress]);

    return (
        <div className="bg-white text-sm dark:bg-dark p-4 rounded-lg shadow-md flex justify-between items-center">
            <div className="flex flex-col">
                <span className="font-semibold">{`${value} ${earnItem.toCoin.symbol}`}</span>
                {(!data.is_claimable || earnItem.requestsMerged) && (
                    <span className=" text-gray-500">
                        {data.is_claimable
                            ? `${data.count ?? 0} Request${(data.count ?? 0) > 1 ? 's' : ''}`
                            : waitTimeStr}
                    </span>
                )}
            </div>
            {data.is_claimable ? (
                <button
                    onClick={onHandleClaimPress}
                    className="border rounded-full border-primary h-8 w-20 enabled:hover:bg-slate-100 dark:enabled:hover:bg-neutral-600 text-primary">
                    Claim
                </button>
            ) : data.cancellable ? (
                <button
                    onClick={onCancelClaimPress}
                    className="border rounded-full border-[#EB5E6C] h-8 w-20 enabled:hover:bg-slate-100 dark:enabled:hover:bg-neutral-600 text-[#EB5E6C]">
                    Cancel
                </button>
            ) : (
                <div className="text-right">
                    <div className="text-primary font-semibold">Pending</div>
                </div>
            )}
        </div>
    );
};

export { ClaimCard, ClaimCardPlaceholder };
