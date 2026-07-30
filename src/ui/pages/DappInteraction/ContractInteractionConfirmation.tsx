import React from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { smartTrim } from '../../../shared/utils/string';
import ConfirmationHeader from '../../components/ConfirmationHeader';
import GasFee from '../../components/GasFee';
import TransactionHexData from '../../components/TransactionHexData';
import { useHardwareWalletSignModal } from '../../hooks/useHardwareWalletSignModal';
import { useDappInteractionData } from './DappInteractionProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const {
        subjectMetadata,
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
        onGasChange,
        accountName,
        toAddress,
        confirmCalls,
        currentAccount,
    } = useDappInteractionData();

    const { wrapSubmit, hardwareModal } = useHardwareWalletSignModal(
        currentAccount?.metadata.keyring.type,
    );

    return (
        <>
            <div
                id="scrollable"
                className="flex flex-col h-[calc(100vh-124px)] sm:h-[calc(100vh-40px-124px)] overflow-x-hidden overflow-y-auto">
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

                        <div className="flex flex-row items-center justify-between mb-3">
                            <div className="text-xs border rounded-md px-2 py-1 mr-3">
                                <span className="text-primary mr-1">
                                    {smartTrim(toAddress, 10)} :
                                </span>
                                Contract Interaction
                            </div>
                        </div>
                    </div>
                </div>

                <Tabs
                    selectedTabClassName="tab-selected-tab-class-name-compact"
                    selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                    className="tab-class-name">
                    <TabList className="tab-tablist !bg-transparent">
                        <Tab className="tab-tablist-tab-compact ml-5">HEX</Tab>
                    </TabList>

                    <TabPanel>
                        <div className="text-xs px-5 pt-4">
                            <TransactionHexData title="Data" data={unapproveTx?.txParams.data} />
                        </div>
                    </TabPanel>
                </Tabs>

                <div className="px-5 py-4">
                    <GasFee
                        isLoading={loadingGasLimit}
                        suggestionGas={initGasInfo}
                        gasLimit={gasLimit}
                        onGasChange={onGasChange}
                        calls={confirmCalls}
                    />
                </div>

                {error ? (
                    <p className="text-sm text-red-500 px-5 pb-5 break-words text-center">
                        {error}
                    </p>
                ) : null}
            </div>

            <div className="px-5 pb-8">
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
