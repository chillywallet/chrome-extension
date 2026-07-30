import _ from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { getCurrentChains } from '../../lib/ChainsUtils';
import { ChainData } from '../../shared/types/Chain';
import logger from '../../shared/utils/logger';
import { getReduxStore } from '../../store/store';
import { useSelectedNetwork } from '../../store/selectors';
import Header from '../components/Header';
import Modal from '../components/Modal';
import RadioButton from '../components/RadioButton';
import TextTruncate from '../components/TextTruncate';

export interface Props {
    visible: boolean;
    onClose: () => void;
}

export const Placeholder = () => {
    return (
        <div className="flex flex-row mt-3 mb-6 px-5 items-center">
            <div className="animate-pulse bg-placeholder h-5 flex flex-1 rounded-md"></div>
            <div className="bg-placeholder h-5 w-5 animate-pulse rounded-full ml-5"></div>
        </div>
    );
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClose } = props;

    const [mainnets, setMainnets] = useState<ChainData[]>([]);
    const [testnets, setTestnets] = useState<ChainData[]>([]);
    const [excluded] = useState<ChainData[]>([]);
    const selectedNetwork = useSelectedNetwork();
    const [localSelectedNetwork, setLocalSelectedNetwork] = useState<ChainData>(selectedNetwork);
    const [selectedAddress, setSelectedAddress] = useState<string | null>();
    const [importedWallets, setImportedWallets] = useState<string[]>([]);
    const [isLoadingImportWallet, setIsLoadingImportWallet] = useState(false);

    const networks = useMemo(() => {
        const _networks = _.cloneDeep(getCurrentChains().filter(_chain => !!_chain.explorer_url));
        return _networks;
    }, []);

    const loadImportedWallets = useCallback(() => {
        // Wallet addresses come from the local accounts store now.
        setIsLoadingImportWallet(true);
        try {
            const accounts = Object.values(
                getReduxStore()?.getState().globalState.internalAccounts.accounts ?? {},
            ) as any[];
            const wallets = accounts
                .filter(account => !account.metadata?.deleted)
                .map(account => account.address);
            setImportedWallets(wallets.filter((value, index) => wallets.indexOf(value) === index));
        } catch (e) {
            logger.log('loadImportedWallets', e);
        } finally {
            setIsLoadingImportWallet(false);
        }
    }, []);

    useEffect(() => {
        loadImportedWallets();
    }, [loadImportedWallets]);

    useEffect(() => {
        let _mainnets: ChainData[] = [];
        let _testnets: ChainData[] = [];
        networks.forEach(network => {
            if (
                excluded.length !== 0 &&
                excluded.find(exclude => exclude.chain_id === network.chain_id)
            ) {
                return;
            }

            if (network.testnet) {
                _testnets.push(network);
            } else {
                _mainnets.push(network);
            }
        });
        setMainnets(_mainnets);
        setTestnets(_testnets);
    }, [networks, excluded]);

    return (
        <Modal visible={visible} onClose={onClose}>
            <Header title="Chain" hasBackButton={false} onClosePress={onClose} />

            <div className="">
                <Tabs
                    defaultIndex={0}
                    selectedTabClassName="tab-selected-tab-class-name"
                    selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                    className="tab-class-name">
                    <TabList className="tab-tablist">
                        <Tab className="tab-tablist-tab">Mainnet</Tab>
                        <Tab className="tab-tablist-tab">Testnet</Tab>
                    </TabList>

                    <TabPanel>
                        <div className="overflow-y-auto h-[180px]">
                            {mainnets.map(network => {
                                let selected = localSelectedNetwork.chain_id === network.chain_id;
                                return (
                                    <div
                                        key={network.chain_id}
                                        className="flex flex-row items-center w-full text-sm py-3 px-5">
                                        <img
                                            src={network.icon}
                                            className="w-5 h-5 rounded-full mr-2 overflow-hidden"
                                            alt="icon"
                                        />
                                        <div className="ml-2 flex-1">{network.name}</div>
                                        <RadioButton
                                            checked={selected}
                                            onChange={checked => {
                                                setLocalSelectedNetwork(network);
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div className="overflow-y-auto h-[180px]">
                            {testnets.map(network => {
                                let selected = localSelectedNetwork.chain_id === network.chain_id;
                                return (
                                    <div
                                        key={network.chain_id}
                                        className="flex flex-row items-center w-full text-sm py-3 px-5">
                                        <img
                                            src={network.icon}
                                            className="w-5 h-5 rounded-full mr-2 overflow-hidden"
                                            alt="icon"
                                        />
                                        <div className="ml-2 flex-1">{network.name}</div>
                                        <RadioButton
                                            checked={selected}
                                            onChange={checked => {
                                                setLocalSelectedNetwork(network);
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </TabPanel>
                </Tabs>
                <div className="px-5 text-md my-2">Wallet</div>
                <div className="h-[180px] overflow-y-auto">
                    {isLoadingImportWallet
                        ? [...Array(8)].map((_, index) => <Placeholder key={index} />)
                        : importedWallets.map(wallet => {
                              return (
                                  <div
                                      key={wallet}
                                      className="flex flex-row items-center cursor-pointer px-5 py-3 hover:bg-gray-100 dark:hover:bg-darker">
                                      <div className="flex-1 mr-2">
                                          <TextTruncate
                                              text={wallet}
                                              className="whitespace-nowrap text-sm w-[calc(90vw-90px)] sm:w-[calc(400px-90px)]"
                                              position="middle"
                                          />
                                      </div>

                                      <RadioButton
                                          checked={selectedAddress === wallet}
                                          onChange={checked => {
                                              setSelectedAddress(checked ? wallet : null);
                                          }}
                                      />
                                  </div>
                              );
                          })}
                </div>
            </div>
            {selectedAddress && localSelectedNetwork && (
                <div className="p-3">
                    <button
                        className="btn btn-primary w-full"
                        onClick={e => {
                            e.preventDefault();
                            global.platform.openLink(
                                localSelectedNetwork.explorer_url + '/address/' + selectedAddress,
                                '_blank',
                            );
                        }}>
                        View on {localSelectedNetwork.explorer_name}
                    </button>
                </div>
            )}
        </Modal>
    );
});
