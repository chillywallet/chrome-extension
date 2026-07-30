import React, { useCallback, useMemo, useState } from 'react';
import { FaExclamationTriangle, FaExternalLinkAlt } from 'react-icons/fa';
import { MdContentCopy } from 'react-icons/md';
import { useHistory } from 'react-router-dom';
import { TX_CONFIRMATION_TOKEN_ALLOWANCE_CONFIRMATION_ROUTE } from '../../../shared/constants/routes';
import { getFloatNumber } from '../../../shared/utils/string';
import {
    useActualTheme,
    useCoinByTokenAddress,
    useSelectedNetwork,
} from '../../../store/selectors';
import AccountView from '../../components/AccountView';
import SafeImage from '../../components/SafeImage';
import ThirdPartyModal from '../../components/ThirdPartyModal';
import Toast from '../../components/Toast';
import TokenAllowanceData from '../../components/TokenAllowanceData';
import { useDappInteractionData } from './DappInteractionProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const {
        subjectMetadata,
        origin,
        tokenAddress,
        assetDetails,
        currentRequest: unapproveTx,
        approvalAmount,
        setApprovalAmount,
        onRejectPress,
        isSmartWallet,
        walletAddress,
        currentAccount,
    } = useDappInteractionData();

    const actualTheme = useActualTheme();

    const tooltipVariant = useMemo(() => {
        return actualTheme === 'dark' ? 'light' : 'dark';
    }, [actualTheme]);

    const history = useHistory();
    const selectedNetwork = useSelectedNetwork();
    const coin = useCoinByTokenAddress(tokenAddress, walletAddress);

    const [isShowThirdParty, setIsShowThirdParty] = useState<boolean>(false);

    const spenderAddress = useMemo(() => {
        return assetDetails?.toAddress ?? '';
    }, [assetDetails]);

    const showCaution = useMemo(() => {
        if (coin?.coin_balance && getFloatNumber(approvalAmount) > coin.coin_balance) {
            return true;
        }

        return false;
    }, [coin, approvalAmount]);

    const showUseSiteSuggestion = useMemo(() => {
        if (
            assetDetails?.tokenAmount &&
            approvalAmount !== assetDetails?.tokenAmount.toString(10)
        ) {
            return true;
        }

        return false;
    }, [assetDetails?.tokenAmount, approvalAmount]);

    const setMax = useCallback(() => {
        if (coin?.coin_balance) {
            setApprovalAmount(coin.coin_balance + '');
        }
    }, [coin?.coin_balance, setApprovalAmount]);

    const setSiteAmount = useCallback(() => {
        if (assetDetails?.tokenAmount) {
            setApprovalAmount(assetDetails.tokenAmount.toString(10));
        }
    }, [assetDetails?.tokenAmount, setApprovalAmount]);

    return (
        <>
            <div
                className="flex flex-col px-5 py-3 h-[calc(100vh-124px)] sm:h-[calc(100vh-40px-124px)] overflow-auto"
                id="scrollable">
                <AccountView
                    account={currentAccount}
                    isSmartWallet={isSmartWallet}
                    className="mb-2"
                />

                <div className="flex flex-col flex-1 items-center">
                    <div className="flex flex-row items-center border rounded-full px-3 py-1 mb-2 overflow-hidden">
                        <SafeImage
                            src={subjectMetadata?.iconUrl ?? null}
                            alt={'Subject logo'}
                            className="w-6 h-6 object-contain rounded-md mr-2"
                        />

                        <div className="text-sm text-center">{origin}</div>
                    </div>

                    <div className="text-md text-center mb-2">Spending cap request for your</div>

                    <div className="text-xl flex flex-row items-center mb-2">
                        <SafeImage
                            src={coin?.logo ?? null}
                            alt={'Subject logo'}
                            className="w-6 h-6 object-contain rounded-md mr-2"
                        />
                        <div className="font-bold mr-3">{coin?.symbol ?? 'Unknown'}</div>

                        <div
                            className="cursor-pointer text-primary mr-2"
                            data-tooltip-id="chilly-tooltip"
                            data-tooltip-variant={tooltipVariant}
                            data-tooltip-content="Copy to clipboard"
                            data-tooltip-place="top"
                            onClick={() => {
                                if (tokenAddress) {
                                    Toast.showSuccess('Copied to clipboard');
                                    navigator.clipboard.writeText(tokenAddress);
                                }
                            }}>
                            <MdContentCopy />
                        </div>

                        <div
                            className="cursor-pointer text-primary"
                            data-tooltip-id="chilly-tooltip"
                            data-tooltip-variant={tooltipVariant}
                            data-tooltip-content="Open in block explorer"
                            data-tooltip-place="top"
                            onClick={() => {
                                global.platform.openLink(
                                    selectedNetwork.explorer_url + '/address/' + tokenAddress,
                                    '_blank',
                                );
                            }}>
                            <FaExternalLinkAlt />
                        </div>
                    </div>

                    <div
                        className="text-sm text-center text-primary hover:underline cursor-pointer mb-3"
                        onClick={() => {
                            setIsShowThirdParty(true);
                        }}>
                        Verify third-party details
                    </div>

                    <div className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-darkline/60 rounded-xl text-sm mb-3">
                        <div className="mb-3 flex flex-row items-center">
                            Custom spending cap
                            {showCaution && (
                                <button
                                    className="ml-2"
                                    data-tooltip-id="chilly-tooltip"
                                    data-tooltip-variant={tooltipVariant}
                                    data-tooltip-html={
                                        '<div>Be cautious, as the third party may deplete your entire</div>' +
                                        '<div>token balance without any additional warning or approval. </div>' +
                                        '<div>Safeguard yourself by setting a lower spending limit.'
                                    }
                                    data-tooltip-place="top">
                                    <FaExclamationTriangle className="text-red-500" />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-row items-center border dark:border-neutral-500 rounded-md bg-white dark:bg-dark px-3 py-1 mb-2">
                            <input
                                type="text"
                                className="flex-1 w-[100px] truncate border-none focus:outline-none bg-transparent"
                                value={approvalAmount}
                                onChange={e => {
                                    setApprovalAmount(e.target.value);
                                }}
                            />

                            <button className="text-primary ml-3" onClick={setMax}>
                                Max
                            </button>
                        </div>

                        {showUseSiteSuggestion && (
                            <button
                                className="mb-2 text-primary text-sm font-medium"
                                onClick={setSiteAmount}>
                                Use site suggestion
                            </button>
                        )}

                        <div className="text-xs mb-3">
                            This permits the third party to use {coin?.symbol ?? 'Unknown'} from
                            your existing balance.
                        </div>
                    </div>

                    <TokenAllowanceData data={unapproveTx?.txParams?.data ?? ''} />
                </div>
            </div>

            <div className="px-5 pb-5">
                <button
                    className="btn btn-primary w-full mb-3"
                    onClick={e => {
                        e.preventDefault();
                        history.push(TX_CONFIRMATION_TOKEN_ALLOWANCE_CONFIRMATION_ROUTE);
                    }}>
                    Next
                </button>
                <button
                    className="btn w-full"
                    onClick={e => {
                        e.preventDefault();
                        onRejectPress();
                    }}>
                    Reject
                </button>
            </div>

            <ThirdPartyModal
                visible={isShowThirdParty}
                onClose={() => {
                    setIsShowThirdParty(false);
                }}
                tokenAddress={tokenAddress}
                tokenLogo={coin?.logo}
                tokenSymbol={coin?.symbol ?? 'Unknown'}
                spenderAddress={spenderAddress}
            />
        </>
    );
});
