import _ from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { resolveApiKey, resolveChainConfig } from '../../config';
import { getCurrentChains } from '../../lib/ChainsUtils';
import { ChainData } from '../../shared/types/Chain';
import { setSelectedNetwork, setUseDefaultNetwork } from '../../store/actions/uiActions';
import { usePreferences, useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import CustomNetworkModal from './CustomNetworkModal';
import Header from './Header';
import Modal from './Modal';
import NetworkCard from './NetworkCard';
import Toast from './Toast';

type Props = {
    visible: boolean;
    onClosePress: () => void;
    onNetworkChange?: (network: ChainData) => void;
    excludeNetworks?: ChainData[];
    customNetwork?: boolean;
};

export default React.memo<Props>((props: Props) => {
    const {
        visible,
        excludeNetworks,
        onClosePress,
        onNetworkChange,
        customNetwork = false,
    } = props;
    const dispatch = useAppDispatch();
    const selectedNetwork = useSelectedNetwork();
    const { defaultChainId, apiKeys, customNetworks } = usePreferences();

    const [mainnets, setMainnets] = useState<ChainData[]>([]);
    const [testnets, setTestnets] = useState<ChainData[]>([]);
    const [excluded] = useState<ChainData[]>(excludeNetworks ?? []);
    const [customNetworkModal, setCustomNetworkModal] = useState<{
        visible: boolean;
        network: ChainData | null;
    }>({ visible: false, network: null });

    const isTestnet = useMemo(() => {
        return selectedNetwork.testnet ?? false;
    }, [selectedNetwork]);

    const isNetworkSelected = useMemo(() => {
        return (network: ChainData) => {
            return selectedNetwork.chain_id === network.chain_id;
        };
    }, [selectedNetwork]);

    const networks = useMemo(() => {
        const _networks = _.cloneDeep(getCurrentChains());

        return _networks;
    }, []);

    /**
     * A chain is gated when its (possibly user-overridden) data provider declares an
     * apiKeyRef and no key resolves for it. Chains on keyless providers — Blockscout,
     * Routescan — are never gated.
     */
    const missingApiKeyLabelFor = useCallback(
        (network: ChainData): string | undefined => {
            const config = resolveChainConfig(network.chain_id, customNetworks);
            const apiKeyRef = config?.dataProvider?.apiKeyRef;

            if (!apiKeyRef || resolveApiKey(apiKeyRef, apiKeys)) {
                return undefined;
            }

            return `${network.short_name} is supported once you add a free ${apiKeyRef} API key in Developer Settings.`;
        },
        [apiKeys, customNetworks],
    );

    const onNetworkPress = useCallback(
        async (network: ChainData) => {
            if (isNetworkSelected(network)) {
                onClosePress();
                return;
            }

            try {
                if (!customNetwork) {
                    await dispatch(setSelectedNetwork(network.chain_id));
                    await dispatch(setUseDefaultNetwork(false));
                }

                onNetworkChange && onNetworkChange(network);
                onClosePress();
            } catch (error: any) {
                const message = error?.message;

                if (message) {
                    Toast.showError(message);
                }
            }
        },
        [dispatch, onClosePress, onNetworkChange, customNetwork, isNetworkSelected],
    );

    const onCustomizeNetwork = useCallback((network: ChainData, e: React.MouseEvent) => {
        setCustomNetworkModal({ visible: true, network });
    }, []);

    const onCloseCustomNetworkModal = useCallback(() => {
        setCustomNetworkModal({ visible: false, network: null });
    }, []);

    useEffect(() => {
        let _mainnets: ChainData[] = [];
        let _testnets: ChainData[] = [];

        networks.forEach(network => {
            if (
                excluded.length !== 0 &&
                excluded.find(
                    exclude =>
                        exclude.chain_id === network.chain_id && exclude.name === network.name,
                )
            ) {
                return;
            }

            if (network.testnet) {
                _testnets.push(network);
            } else {
                _mainnets.push(network);
            }
        });

        // Sort networks so default chain appears first
        const sortNetworks = (networks: ChainData[]) => {
            return networks.sort((a, b) => {
                const aIsDefault = a.chain_id === defaultChainId;
                const bIsDefault = b.chain_id === defaultChainId;
                if (aIsDefault && !bIsDefault) return -1;
                if (!aIsDefault && bIsDefault) return 1;
                return 0;
            });
        };

        setMainnets(sortNetworks(_mainnets));
        setTestnets(sortNetworks(_testnets));
    }, [networks, excluded, defaultChainId]);

    return (
        <>
            <Modal
                visible={visible}
                onClose={() => {
                    onClosePress();
                }}>
                <Header title="Select a Network" hasBackButton={false} onClosePress={onClosePress} />

                <Tabs
                    defaultIndex={isTestnet ? 1 : 0}
                    selectedTabClassName="tab-selected-tab-class-name"
                    selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                    className="tab-class-name min-h-[300px]">
                    <TabList className="tab-tablist">
                        <Tab className="tab-tablist-tab">Mainnet</Tab>
                        <Tab className="tab-tablist-tab">Testnet</Tab>
                    </TabList>

                    <TabPanel>
                        {mainnets.map(network => {
                            return (
                                <NetworkCard
                                    key={network.chain_id + network.name}
                                    network={network}
                                    selected={isNetworkSelected(network)}
                                    onPress={onNetworkPress}
                                    onCustomizePress={onCustomizeNetwork}
                                    missingApiKeyLabel={missingApiKeyLabelFor(network)}
                                />
                            );
                        })}
                    </TabPanel>
                    <TabPanel>
                        {testnets.map(network => {
                            return (
                                <NetworkCard
                                    key={network.chain_id + network.name}
                                    network={network}
                                    selected={isNetworkSelected(network)}
                                    onPress={onNetworkPress}
                                    onCustomizePress={onCustomizeNetwork}
                                    missingApiKeyLabel={missingApiKeyLabelFor(network)}
                                />
                            );
                        })}
                    </TabPanel>
                </Tabs>
            </Modal>

            {customNetworkModal.network && (
                <CustomNetworkModal
                    visible={customNetworkModal.visible}
                    onClosePress={onCloseCustomNetworkModal}
                    network={customNetworkModal.network}
                />
            )}
        </>
    );
});
