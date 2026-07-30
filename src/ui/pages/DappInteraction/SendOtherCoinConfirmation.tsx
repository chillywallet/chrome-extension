import { formatMoney, formatNumber } from '../../../shared/utils/format';
import React, { useMemo } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { smartTrim } from '../../../shared/utils/string';
import { useCoinByTokenAddress, useSelectedNetwork } from '../../../store/selectors';
import ConfirmationHeader from '../../components/ConfirmationHeader';
import GasFee from '../../components/GasFee';
import SafeImage from '../../components/SafeImage';
import TransactionAmountData from '../../components/TransactionAmountData';
import TransactionHexData from '../../components/TransactionHexData';
import { useHardwareWalletSignModal } from '../../hooks/useHardwareWalletSignModal';
import { useDappInteractionData } from './DappInteractionProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const {
        tokenAddress,
        subjectMetadata,
        assetDetails,
        currentRequest: unapproveTx,
        onRejectPress,
        gasLimit,
        loadingGasLimit,
        onConfirmPress,
        walletAddress,
        initGasInfo,
        error,
        emoji,
        confirmButtonDisabled,
        accountName,
        onGasChange,
        confirmCalls,
        currentAccount,
    } = useDappInteractionData();
    const selectedNetwork = useSelectedNetwork();
    const coin = useCoinByTokenAddress(tokenAddress, walletAddress);

    const toAddress = useMemo(() => {
        return assetDetails?.toAddress ?? '';
    }, [assetDetails]);

    const tokenAmount = useMemo(() => {
        return assetDetails?.tokenAmount?.toNumber() ?? 0;
    }, [assetDetails]);

    const { wrapSubmit, hardwareModal } = useHardwareWalletSignModal(
        currentAccount?.metadata.keyring.type,
    );

    return (
        <>
            <div
                className="flex flex-col pb-3 h-[calc(100vh-124px)] sm:h-[calc(100vh-40px-124px)] overflow-x-hidden overflow-y-auto"
                id="scrollable">
                <ConfirmationHeader
                    className="mb-3"
                    from={{
                        name: accountName,
                        address: walletAddress,
                        emoji,
                    }}
                    to={{
                        name: null,
                        address: toAddress,
                        emoji: null,
                    }}
                />

                <div className="px-5">
                    <div className="flex flex-col">
                        <div className="text-sm mb-2">{subjectMetadata?.origin}</div>

                        <div className="flex flex-row items-center mb-3">
                            <div className="text-xs border rounded-md px-2 py-1 mr-3">
                                <span className="text-primary mr-1">
                                    {smartTrim(toAddress, 10)} :
                                </span>
                                Transfer
                            </div>
                        </div>

                        {coin && coin.coin_balance ? (
                            <div className="flex flex-col">
                                <div className="text-xl flex flex-row items-center mb-1">
                                    <SafeImage
                                        src={coin.logo ?? null}
                                        alt={'Subject logo'}
                                        className="w-6 h-6 object-contain rounded-md mr-2"
                                    />
                                    <div className="font-bold mr-3">
                                        {formatNumber(coin.coin_balance)} {coin.symbol}
                                    </div>
                                </div>

                                {coin.coin_balance && !selectedNetwork.testnet ? (
                                    <div className="text-sm flex flex-row items-center mb-3">
                                        {formatMoney(coin.coin_balance)}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>

                <Tabs
                    selectedTabClassName="tab-selected-tab-class-name-compact"
                    selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                    className="tab-class-name">
                    <TabList className="tab-tablist !bg-transparent">
                        <Tab className="tab-tablist-tab-compact ml-5">DETAILS</Tab>
                        <Tab className="tab-tablist-tab-compact">HEX</Tab>
                    </TabList>

                    <TabPanel>
                        <div className="px-5 py-4">
                            <TransactionAmountData
                                className="mb-3"
                                send={{
                                    label: 'You Send',
                                    amount: tokenAmount,
                                    coin_symbol: coin?.symbol,
                                    coin_logo: coin?.logo,
                                    amount_usd: (coin?.coin_price ?? 0) * tokenAmount,
                                }}
                                isMainnet={!selectedNetwork.testnet}
                            />

                            <GasFee
                                isLoading={loadingGasLimit}
                                suggestionGas={initGasInfo}
                                gasLimit={gasLimit}
                                onGasChange={onGasChange}
                                calls={confirmCalls}
                            />
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div className="text-xs px-5 py-4">
                            <TransactionHexData title="Data" data={unapproveTx?.txParams.data} />
                        </div>
                    </TabPanel>
                    {error ? (
                        <p className="text-sm text-red-500 px-5 break-words">{error}</p>
                    ) : null}
                </Tabs>
            </div>

            <div className="px-5 pb-4">
                <button
                    disabled={confirmButtonDisabled}
                    className="btn btn-primary w-full mb-3"
                    onClick={e => {
                        e.preventDefault();
                        void wrapSubmit(() => onConfirmPress());
                    }}>
                    Confirm
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
            {hardwareModal}
        </>
    );
});
