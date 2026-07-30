import PreferencesController from '../../src/controller/PreferencesController';

const mockGetCountryCode = jest.fn(() =>
    Promise.resolve({ data: { country_code: 'US', region_code: 'CA' } }),
);

jest.mock('../../src/api/index', () => ({
    getCountryCode: (...args: any[]) => mockGetCountryCode(...args),
}));

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn() },
}));

function buildMessenger() {
    return {
        registerInitialEventPayload: jest.fn(),
        registerActionHandler: jest.fn(),
    } as any;
}

const baseOpts: any = {
    state: {},
    messenger: buildMessenger(),
    getSelectedNetwork: () => ({ chain_id: 1 }),
    setSelectedNetwork: jest.fn(),
};

beforeEach(() => {
    mockGetCountryCode.mockImplementation(() =>
        Promise.resolve({ data: { country_code: 'US', region_code: 'CA' } }),
    );
});

describe('PreferencesController', () => {
    it('initializes with the default preferences object', () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });
        const prefs = c.getPreferences();
        expect(prefs.darkMode).toBe(false);
        expect(prefs.darkModeSystem).toBe(true);
    });

    it('setPreference updates a single key', async () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });
        const next = await c.setPreference('darkMode', true);
        expect(next.darkMode).toBe(true);
        expect(c.getPreferences().darkMode).toBe(true);
    });

    it('setPreferences merges multiple keys', async () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });
        await c.setPreferences({ appIcon: 'red', earnEnabled: true });
        const prefs = c.getPreferences();
        expect(prefs.appIcon).toBe('red');
        expect(prefs.earnEnabled).toBe(true);
    });

    it('setCustomNetworks adds new entry and replaces existing same-id', async () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });
        await c.setCustomNetworks(1, 'https://a.test');
        await c.setCustomNetworks(1, 'https://b.test');
        const cn = c.getPreferences().customNetworks;
        expect(cn).toHaveLength(1);
        expect(cn[0].rpcUrl).toBe('https://b.test');
    });

    it('setCustomNetworks preserves an existing dataProvider override', async () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });
        const dataProvider = {
            kind: 'blockvision' as const,
            baseUrl: 'https://api.blockvision.org/v2/monad',
            apiKeyRef: 'blockvision',
        };

        await c.setChainDataProvider(143, dataProvider);
        // wallet_addEthereumChain reaches this path from a dapp; it must not drop the
        // user's provider choice.
        await c.setCustomNetworks(143, 'https://rpc.test');

        const entry = c.getPreferences().customNetworks[0];
        expect(entry.rpcUrl).toBe('https://rpc.test');
        expect(entry.dataProvider).toEqual(dataProvider);
    });

    it('setApiKey stores, trims and clears keys independently', async () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });

        await c.setApiKey('etherscan', '  abc123  ');
        expect(c.getPreferences().apiKeys).toEqual({ etherscan: 'abc123' });

        await c.setApiKey('blockvision', 'xyz789');
        expect(c.getPreferences().apiKeys).toEqual({
            etherscan: 'abc123',
            blockvision: 'xyz789',
        });

        // Empty value removes the ref so the committed default applies again.
        await c.setApiKey('etherscan', '   ');
        expect(c.getPreferences().apiKeys).toEqual({ blockvision: 'xyz789' });
    });

    it('setChainDataProvider sets, replaces and clears the override', async () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });
        const blockvision = {
            kind: 'blockvision' as const,
            baseUrl: 'https://api.blockvision.org/v2/monad',
            apiKeyRef: 'blockvision',
        };
        const etherscan = {
            kind: 'etherscan' as const,
            baseUrl: 'https://api.etherscan.io/v2/api',
            apiKeyRef: 'etherscan',
        };

        await c.setChainDataProvider(143, blockvision);
        expect(c.getPreferences().customNetworks).toEqual([
            { chain_id: 143, dataProvider: blockvision },
        ]);

        await c.setChainDataProvider(143, etherscan);
        expect(c.getPreferences().customNetworks).toEqual([
            { chain_id: 143, dataProvider: etherscan },
        ]);

        // Clearing drops the entry entirely when nothing else is overridden.
        await c.setChainDataProvider(143, null);
        expect(c.getPreferences().customNetworks).toEqual([]);
    });

    it('setChainDataProvider keeps a custom rpcUrl when the override is cleared', async () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });

        await c.setCustomNetworks(143, 'https://rpc.test');
        await c.setChainDataProvider(143, {
            kind: 'blockvision',
            baseUrl: 'https://api.blockvision.org/v2/monad',
            apiKeyRef: 'blockvision',
        });
        await c.setChainDataProvider(143, null);

        expect(c.getPreferences().customNetworks).toEqual([
            { chain_id: 143, rpcUrl: 'https://rpc.test' },
        ]);
    });





    function buildCurrency(overrides: Record<string, any> = {}) {
        return {
            code: 'USDC',
            name: 'USDC',
            metadata: {
                contractAddress: '0xAAAA',
                chainId: '1',
            },
            isSuspended: false,
            isSellSupported: true,
            supportsTestMode: true,
            supportsLiveMode: true,
            isSupportedInUS: true,
            notAllowedCountries: [] as string[],
            notAllowedUSStates: [] as string[],
            ...overrides,
        };
    }

    async function controllerWithCurrency(overrides: Record<string, any> = {}) {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });
        await c.setPreferences({
            moonPayCurrencies: [buildCurrency(overrides)],
        });
        return c;
    }














    it('setCustomNetworks initializes empty list when none exist', async () => {
        const c = new PreferencesController({ ...baseOpts, messenger: buildMessenger() });
        const result = await c.setCustomNetworks(42, 'https://example.test');
        expect(result.customNetworks).toEqual([
            { chain_id: 42, rpcUrl: 'https://example.test' },
        ]);
    });


    it('registers initial event payload and getState action handler', () => {
        const messenger = {
            registerInitialEventPayload: jest.fn(),
            registerActionHandler: jest.fn(),
        };
        new PreferencesController({ ...baseOpts, messenger: messenger as any });

        expect(messenger.registerInitialEventPayload).toHaveBeenCalledWith({
            eventType: 'PreferencesController:stateChange',
            getPayload: expect.any(Function),
        });
        const payloadFn =
            messenger.registerInitialEventPayload.mock.calls[0][0].getPayload;
        const [state, events] = payloadFn();
        expect(state).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
        expect(events).toEqual([]);

        const getStateCall = messenger.registerActionHandler.mock.calls.find(
            ([name]: [string]) => name === 'PreferencesController:getState',
        );
        expect(getStateCall).toBeDefined();
        expect(getStateCall[1]()).toEqual(expect.objectContaining({ preferences: expect.any(Object) }));
    });
});
