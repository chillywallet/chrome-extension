import React from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
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
        onGasChange,
        confirmButtonDisabled,
        accountName,
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
            className="h-[100vh] sm:h-[calc(100vh-40px)] overflow-x-hidden overflow-y-auto">
            <div className="flex flex-col">
                <div className="flex flex-col pb-3">
                    <ConfirmationHeader
                        className="mb-3"
                        from={{
                            name: accountName,
                            address: walletAddress,
                            emoji,
                        }}
                        to={{
                            name: 'New contract',
                            emoji: null,
                        }}
                    />

                    <div className="px-5">
                        <div className="flex flex-col">
                            <div className="text-sm mb-2">{subjectMetadata?.origin}</div>

                            <div className="flex flex-row items-center justify-between mb-3">
                                <div className="text-xs border rounded-md px-2 py-1 mr-3">
                                    Contract Deployment
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
                                <TransactionHexData
                                    title="Data"
                                    data={unapproveTx?.txParams.data}
                                />
                            </div>
                        </TabPanel>
                    </Tabs>
                </div>

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
            </div>
        </div>
        {hardwareModal}
        </>
    );
});
