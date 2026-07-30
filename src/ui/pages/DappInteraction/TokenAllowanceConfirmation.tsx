import React, { useMemo, useState } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { MdContentCopy } from 'react-icons/md';
import { useHistory } from 'react-router-dom';
import {
    useActualTheme,
    useCoinByTokenAddress,
    useSelectedNetwork,
} from '../../../store/selectors';
import AccountView from '../../components/AccountView';
import GasFee from '../../components/GasFee';
import SafeImage from '../../components/SafeImage';
import ThirdPartyModal from '../../components/ThirdPartyModal';
import Toast from '../../components/Toast';
import TokenAllowanceData from '../../components/TokenAllowanceData';
import { useHardwareWalletSignModal } from '../../hooks/useHardwareWalletSignModal';
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
        onConfirmPress,
        onRejectPress,
        gasLimit,
        loadingGasLimit,
        isSmartWallet,
        walletAddress,
        initGasInfo,
        onGasChange,
        confirmButtonDisabled,
        error,
        currentAccount,
        confirmCalls,
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

    const { wrapSubmit, hardwareModal } = useHardwareWalletSignModal(
        currentAccount?.metadata.keyring.type,
    );

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
                                if (selectedNetwork.explorer_url) {
                                    global.platform.openLink(
                                        selectedNetwork.explorer_url + '/address/' + tokenAddress,
                                        '_blank',
                                    );
                                }
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
                            Site requested spending cap
                            <button
                                className="text-primary ml-3"
                                onClick={() => {
                                    history.goBack();
                                }}>
                                Edit
                            </button>
                        </div>

                        <div className="mb-3 break-all">{approvalAmount}</div>
                    </div>

                    <GasFee
                        className="mb-3"
                        isLoading={loadingGasLimit}
                        suggestionGas={initGasInfo}
                        gasLimit={gasLimit}
                        onGasChange={onGasChange}
                        calls={confirmCalls}
                    />

                    {error ? (
                        <p className="text-sm text-red-500 mb-3 break-words text-center">{error}</p>
                    ) : null}

                    <TokenAllowanceData data={unapproveTx?.txParams?.data ?? ''} />
                </div>
            </div>

            <div className="px-5 pb-5">
                <button
                    disabled={confirmButtonDisabled}
                    className="btn btn-primary w-full mb-3"
                    onClick={e => {
                        e.preventDefault();
                        void wrapSubmit(() => onConfirmPress(true));
                    }}>
                    Approve
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
            {hardwareModal}
        </>
    );
});
