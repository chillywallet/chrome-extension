import { RestrictedControllerMessenger } from '@metamask/base-controller';
import { ObservableStore } from '@metamask/obs-store';
import { JsonRpcProvider } from 'ethers';
import { createRpcProvider } from '../lib/rpcProvider';
import {
    DEFAULT_CHAIN,
    getCurrentChainByChainId,
    getCurrentChainByPlatformId,
} from '../lib/ChainsUtils';
import { ChainData } from '../shared/types/Chain';
import { getRpcUrlByNetwork } from '../shared/utils/rpc';

const controllerName = 'NetworkController';

export type NetworkControllerState = {
    selectedNetwork: ChainData;
};

const defaultState: NetworkControllerState = {
    selectedNetwork: DEFAULT_CHAIN,
};

export type NetworkControllerNetworkChangeEvent = {
    type: `${typeof controllerName}:networkChange`;
    payload: [ChainData];
};

export type NetworkControllerEvents = NetworkControllerNetworkChangeEvent;

export type NetworkControllerGetCurrentProviderAction = {
    type: `${typeof controllerName}:getCurrentProvider`;
    handler: () => JsonRpcProvider;
};

export type NetworkControllerActions = NetworkControllerGetCurrentProviderAction;

export type NetworkControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    NetworkControllerActions,
    NetworkControllerEvents,
    never,
    never
>;

type Props = {
    state: NetworkControllerState;
    messenger: NetworkControllerMessenger;
    getRpcConfig: () => {
        rpcUrls?: Record<string, string>;
        customNetworks?: Array<{
            chain_id: number;
            rpcUrl: string;
            version?: number;
        }>;
    };
};

export default class NetworkController {
    store: ObservableStore<NetworkControllerState>;
    messagingSystem: NetworkControllerMessenger;
    networkProviders: Record<number, JsonRpcProvider> = {};

    #getRpcConfig: Props['getRpcConfig'];

    constructor(opts: Props) {
        const initState = {
            ...defaultState,
            ...opts.state,
        };

        this.store = new ObservableStore(initState);
        this.messagingSystem = opts.messenger;
        this.#getRpcConfig = opts.getRpcConfig;

        this.messagingSystem.registerActionHandler(
            'NetworkController:getCurrentProvider',
            this.getCurrentProvider.bind(this),
        );
    }

    getSelectedNetwork() {
        const rawChain = this.store.getState().selectedNetwork;
        return getCurrentChainByChainId(rawChain.chain_id);
    }

    initializeProvider() {
        return this.getProviderForNetwork(this.getSelectedNetwork());
    }

    /**
     * Returns the JsonRpcProvider for the currently selected network.
     * Uses the same RPC resolution as getProviderForNetwork (custom → remote → default).
     */
    getCurrentProvider(): JsonRpcProvider {
        return this.getProviderForNetwork(this.getSelectedNetwork());
    }

    setSelectedNetwork(chainId: number) {
        const chain = getCurrentChainByChainId(chainId);
        this.store.updateState({
            selectedNetwork: chain,
        });
        this.messagingSystem.publish('NetworkController:networkChange', chain);
    }

    getProviderForNetwork(network: ChainData) {
        const { rpcUrls, customNetworks } = this.#getRpcConfig?.() ?? {};
        const rpcUrl = getRpcUrlByNetwork(network, {
            rpcUrls,
            customNetworks,
        });

        if (!rpcUrl) {
            throw new Error('Network not supported');
        }

        const cacheProvider = this.networkProviders[network.chain_id];

        if (cacheProvider && cacheProvider._getConnection().url === rpcUrl) {
            return cacheProvider;
        }

        const provider = createRpcProvider(rpcUrl, network.chain_id);
        this.networkProviders[network.chain_id] = provider;

        return provider;
    }

    getProviderByChainId(chainId: number) {
        const network = getCurrentChainByChainId(chainId);
        return this.getProviderForNetwork(network);
    }

    getProviderByPlatformId(platformId: number) {
        const network = getCurrentChainByPlatformId(platformId);
        return this.getProviderForNetwork(network);
    }
}
