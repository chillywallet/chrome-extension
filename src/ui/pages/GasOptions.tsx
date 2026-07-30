import React, { useCallback, useEffect, useState } from 'react';
import { AiFillCaretDown } from 'react-icons/ai';
import { UPDATE_GAS_INTERVAL } from '../../shared/constants/swap';
import { ChainData } from '../../shared/types/Chain';
import { GasType, GasTypeName } from '../../shared/types/Wallet';
import { loadGasOptions } from '../../store/actions/uiActions';
import { useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import GasOptionContent from '../components/GasOptionContent';
import Header from '../components/Header';
import Modal from '../components/Modal';
import NetworkMenu from '../components/NetworkMenu';

type Props = {};

export default React.memo<Props>(() => {
    const dispatch = useAppDispatch();
    const globalSelectedNetwork = useSelectedNetwork();

    const [selectedNetwork, setSelectedNetwork] = useState<ChainData>(globalSelectedNetwork);
    const [networkMenuVisible, setNetworkMenuVisible] = useState<boolean>(false);
    const [howShouldIChooseModalVisible, setHowShouldIChooseModalVisible] =
        useState<boolean>(false);

    const onNetworkChange = useCallback((_network: ChainData) => {
        setSelectedNetwork(_network);
    }, []);

    useEffect(() => {
        dispatch(loadGasOptions(selectedNetwork.chain_key));

        const interval = setInterval(() => {
            dispatch(loadGasOptions(selectedNetwork.chain_key));
        }, UPDATE_GAS_INTERVAL);

        return () => {
            clearInterval(interval);
        };
    }, [dispatch, selectedNetwork.chain_key]);

    return (
        <div className="flex flex-col h-full min-h-[400px] relative">
            <Header
                title="Network Fee Options"
                action={
                    <div
                        className={
                            'flex flex-row items-center cursor-pointer text-white px-2 py-1 rounded-md h-[25px] text-xs whitespace-nowrap ' +
                            (selectedNetwork.testnet ? 'bg-yellow-600' : 'bg-gray-700')
                        }
                        onClick={() => {
                            setNetworkMenuVisible(true);
                        }}>
                        <img
                            src={selectedNetwork.icon}
                            className="w-4 h-4 rounded-full mr-2 overflow-hidden"
                            alt="icon"
                        />
                        <div className="text-nowrap mr-2">{selectedNetwork.short_name}</div>
                        <AiFillCaretDown size={12} />
                    </div>
                }
            />

            <div className="flex flex-col flex-1">
                <GasOptionContent initExpanded={true} network={selectedNetwork} />
            </div>

            <div className="text-center mb-3">
                <button
                    onClick={() => {
                        setHowShouldIChooseModalVisible(true);
                    }}
                    className="text-primary hover:underline">
                    How Should I Choose?
                </button>
            </div>

            <NetworkMenu
                visible={networkMenuVisible}
                onNetworkChange={onNetworkChange}
                onClosePress={() => setNetworkMenuVisible(false)}
                customNetwork
            />

            <Modal
                visible={howShouldIChooseModalVisible}
                onClose={() => setHowShouldIChooseModalVisible(false)}>
                <div className="p-3 flex flex-col gap-1">
                    <div className="text-lg">How Should I Choose?</div>
                    <div className="text-sm mb-1">
                        Selecting the right gas fee depends on the type of transaction and how
                        important it is to you.
                    </div>
                    <div className="text-md">{GasTypeName[GasType.High]}</div>
                    <div className="text-sm mb-1">
                        This is best for time sensitive transactions (like Swaps) as it increases
                        the likelihood of a successful transaction. If a Swap takes too long to
                        process it may fail and result in losing some of your gas fee.
                    </div>
                    <div className="text-md">{GasTypeName[GasType.Medium]}</div>
                    <div className="text-sm mb-1">
                        A medium gas fee is good for sending, withdrawing or other non-time
                        sensitive transactions. This setting will most often result in a successful
                        transaction.
                    </div>
                    <div className="text-md">{GasTypeName[GasType.Low]}</div>
                    <div className="text-sm mb-3">
                        A lower gas fee should only be used when processing time is less important.
                        Lower fees make it hard predict when (or if) your transaction will be
                        successful.
                    </div>

                    <button
                        onClick={() => setHowShouldIChooseModalVisible(false)}
                        className="btn w-full">
                        Close
                    </button>
                </div>
            </Modal>
        </div>
    );
});
