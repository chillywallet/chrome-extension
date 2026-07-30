import {
    ControllerGetStateAction,
    ControllerStateChangeEvent,
    RestrictedControllerMessenger,
} from '@metamask/base-controller';
import { ObservableStore } from '@metamask/obs-store';
import { ChainUserOverride, DataProviderConfig } from '../config/types';
import { ChainData } from '../shared/types/Chain';
import { ExploreTabType } from '../shared/types/Home';

const controllerName = 'PreferencesController';

export type PreferencesControllerState = {
    preferences: Record<string, any>;
};

const defaultState = {
    preferences: {
        darkMode: false,
        darkModeSystem: true,
        preferColorScheme: 'no-preference',
        ignoreNotification: false,
        appIcon: 'default',
        defaultExploreTab: ExploreTabType.Main,
        favoriteCoins: [],
        useDefaultNetwork: true,
        nftCollectionsHideStatus: {},
        nftsHideStatus: {},
        hideTestnetBadge: false,

        // Static config (see src/config/defaults.ts)
        enableCluster: false,
        enableAllDomains: true,
        enableChangeIcon: true,
        nnsMetadata: {},
        gasPrice: [],
        addCustomNFTEnabled: true,
        earnEnabled: true,
        earnList: [],
        bridgeUrl: '',
        defaultChainId: 143,

        // Highlight UIs
        exploreRedDot: true,
        exploreRedDotDate: '',

        // Custom networks
        customNetworks: [],

        // Remote RPC URLs (optional, keyed by chain_id as string)
        rpcUrls: {},

        // Data-provider API keys (keyed by apiKeyRef, see src/config/apiKeys.ts)
        apiKeys: {},
    },
};

export type PreferencesControllerGetState = ControllerGetStateAction<
    typeof controllerName,
    PreferencesControllerState
>;

export type PreferencesControllerStateChangeEvent = ControllerStateChangeEvent<
    typeof controllerName,
    PreferencesControllerState
>;

export type PreferencesControllerGetPreferencesAction = {
    type: 'PreferencesController:getPreferences';
    handler: PreferencesController['getPreferences'];
};

export type PreferencesControllerActions =
    | PreferencesControllerGetState
    | PreferencesControllerGetPreferencesAction;

export type PreferencesControllerEvents = PreferencesControllerStateChangeEvent;

export type PreferencesControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    PreferencesControllerActions,
    PreferencesControllerEvents,
    never,
    never
>;

type Props = {
    state: PreferencesControllerState;
    messenger: PreferencesControllerMessenger;
    getSelectedNetwork: () => ChainData;
    setSelectedNetwork: (chain_id: number) => void;
};

export default class PreferencesController {
    store: ObservableStore<any>;
    messagingSystem: PreferencesControllerMessenger;

    #getSelectedNetwork: () => ChainData;

    #setSelectedNetwork: (chain_id: number) => void;

    constructor(opts: Props) {
        const initState = {
            ...defaultState,
            ...opts.state,
        };

        this.store = new ObservableStore(initState);
        this.store.setMaxListeners(13);

        this.messagingSystem = opts.messenger;
        this.#getSelectedNetwork = opts.getSelectedNetwork;
        this.#setSelectedNetwork = opts.setSelectedNetwork;
        this.messagingSystem.registerInitialEventPayload({
            eventType: 'PreferencesController:stateChange',
            getPayload: () => [this.store.getState(), []],
        });

        this.messagingSystem.registerActionHandler('PreferencesController:getState', () =>
            this.store.getState(),
        );
        this.messagingSystem.registerActionHandler(
            'PreferencesController:getPreferences',
            this.getPreferences.bind(this),
        );
    }

    /**
     * Updates the `preferences` property, which is an object. These are user-controlled features
     * found in the settings page.
     *
     * @param {string} preference - The preference to enable or disable.
     * @param {boolean |object} value - Indicates whether or not the preference should be enabled or disabled.
     * @returns {Promise<object>} Promises a new object; the updated preferences object.
     */
    async setPreference(preference: string, value: boolean | Object) {
        const currentPreferences = this.getPreferences();
        const updatedPreferences = {
            ...currentPreferences,
            [preference]: value,
        };

        this.store.updateState({ preferences: updatedPreferences });
        return updatedPreferences;
    }

    async setPreferences(preferences: Record<string, any>) {
        const currentPreferences = this.getPreferences();

        const updatedPreferences = {
            ...currentPreferences,
            ...preferences,
        };

        this.store.updateState({ preferences: updatedPreferences });

        return updatedPreferences;
    }

    async setCustomNetworks(chainId: number, rpcUrl: string) {
        const currentPreferences = this.getPreferences();
        const currentCustomNetworks: ChainUserOverride[] =
            currentPreferences.customNetworks ?? [];

        const existing = currentCustomNetworks.find(cn => cn.chain_id === chainId);
        const updatedCustomNetworks = currentCustomNetworks.filter(
            cn => cn.chain_id !== chainId,
        );

        // Preserve any other override fields (notably dataProvider): this is reachable
        // from dapps via wallet_addEthereumChain, which must not silently discard the
        // user's provider choice for the chain.
        updatedCustomNetworks.push({
            ...existing,
            chain_id: chainId,
            rpcUrl,
        });

        const updatedPreferences = {
            ...currentPreferences,
            customNetworks: updatedCustomNetworks,
        };

        this.store.updateState({ preferences: updatedPreferences });
        return updatedPreferences;
    }

    /**
     * Store (or clear) a user-supplied data-provider API key, keyed by `apiKeyRef`.
     * An empty value removes the key so the committed default in src/config/apiKeys.ts
     * applies again. Merging happens here rather than in the UI so concurrent writes
     * to different refs can't clobber each other.
     */
    async setApiKey(apiKeyRef: string, apiKey: string) {
        const currentPreferences = this.getPreferences();
        const updatedApiKeys: Record<string, string> = { ...(currentPreferences.apiKeys ?? {}) };
        const trimmed = (apiKey ?? '').trim();

        if (trimmed) {
            updatedApiKeys[apiKeyRef] = trimmed;
        } else {
            delete updatedApiKeys[apiKeyRef];
        }

        const updatedPreferences = {
            ...currentPreferences,
            apiKeys: updatedApiKeys,
        };

        this.store.updateState({ preferences: updatedPreferences });
        return updatedPreferences;
    }

    /**
     * Override (or clear) the data provider for a chain. Passing null restores the
     * committed default from src/config/chains.ts. The chain's custom rpcUrl, if any,
     * is left untouched; an entry holding nothing but a chain_id is dropped entirely.
     */
    async setChainDataProvider(chainId: number, dataProvider: DataProviderConfig | null) {
        const currentPreferences = this.getPreferences();
        const currentCustomNetworks: ChainUserOverride[] =
            currentPreferences.customNetworks ?? [];

        const existing = currentCustomNetworks.find(cn => cn.chain_id === chainId);
        const updatedCustomNetworks = currentCustomNetworks.filter(
            cn => cn.chain_id !== chainId,
        );

        const next: ChainUserOverride = { ...existing, chain_id: chainId };

        if (dataProvider) {
            next.dataProvider = dataProvider;
        } else {
            delete next.dataProvider;
        }

        // Keep the list free of entries that no longer override anything.
        if (next.dataProvider || next.rpcUrl) {
            updatedCustomNetworks.push(next);
        }

        const updatedPreferences = {
            ...currentPreferences,
            customNetworks: updatedCustomNetworks,
        };

        this.store.updateState({ preferences: updatedPreferences });
        return updatedPreferences;
    }

    /**
     * A getter for the `preferences` property
     *
     * @returns {object} A key-boolean map of user-selected preferences.
     */
    getPreferences() {
        return this.store.getState().preferences;
    }
}
