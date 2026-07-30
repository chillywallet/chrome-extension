import PortStream from 'extension-port-stream';
import browser from 'webextension-polyfill';

import { storeAsStream } from '@metamask/obs-store';
import { isObject } from '@metamask/utils';
//@ts-ignore
import debounce from 'debounce-stream';
import { finished, pipeline } from 'readable-stream';
import AppController from './controller/AppController';
import ExtensionPlatform from './lib/ExtensionPlatform';
import LocalStore from './lib/LocalStore';
import Migrator from './lib/Migrator';
import NotificationManager from './lib/NotificationManager';
import createStreamSink from './lib/createStreamSink';
import { EIP5792_APPROVAL_TYPES } from './lib/eip5792/types';
import {
    ENVIRONMENT_TYPE_BACKGROUND,
    ENVIRONMENT_TYPE_FULLSCREEN,
    ENVIRONMENT_TYPE_NOTIFICATION,
    ENVIRONMENT_TYPE_POPUP,
    ENVIRONMENT_TYPE_SIDEPANEL,
    EnvironmentType,
    CHILLY_EXTENSION_READY,
    MESSAGE_TYPE,
    PLATFORM_FIREFOX,
} from './shared/constants/app';
import { checkForLastErrorAndLog, isManifestV3 } from './shared/utils/browser-runtime-utils';
import logger from './shared/utils/logger';
import { deferredPromise, getPlatform } from './shared/utils/utils';

/**
 * Field names used by persisted state written before the Chilly rebrand.
 *
 * The only place these legacy spellings survive. Migrator v8 renames them to
 * `chain_key` / `platform_id` / `coinId`; tests import this map rather than
 * duplicating the literals.
 */
export const PRE_REBRAND_FIELDS = {
    chainKey: 'haha_chain',
    platformId: 'haha_platform_id',
    coinId: 'hahaid',
} as const;

const TAG = 'Background';
const keys = ['XMLHttpRequest'];

keys.forEach(key => {
    if (!Reflect.has(globalThis, key)) {
        //@ts-ignore
        globalThis[key] = undefined;
    }
});

if (!Reflect.has(globalThis, 'window')) {
    //@ts-ignore
    globalThis.window = globalThis;
}

/**
 * This deferred Promise is used to track whether initialization has finished.
 *
 * It is very important to ensure that `resolveInitialization` is *always*
 * called once initialization has completed, and that `rejectInitialization` is
 * called if initialization fails in an unrecoverable way.
 */
const {
    promise: isInitialized,
    resolve: resolveInitialization,
    reject: rejectInitialization,
} = deferredPromise();

/**
 * Sends a message to the dapp(s) content script to signal it can connect to Chilly background as
 * the backend is not active. It is required to re-connect dapps after service worker re-activates.
 * For non-dapp pages, the message will be sent and ignored.
 */
const sendReadyMessageToTabs = async () => {
    const tabs = await browser.tabs
        .query({
            /**
             * Only query tabs that our extension can run in. To do this, we query for all URLs that our
             * extension can inject scripts in, which is by using the "<all_urls>" value and __without__
             * the "tabs" manifest permission. If we included the "tabs" permission, this would also fetch
             * URLs that we'd not be able to inject in, e.g. chrome://pages, chrome://extension, which
             * is not what we'd want.
             *
             * You might be wondering, how does the "url" param work without the "tabs" permission?
             *
             * @see {@link https://bugs.chromium.org/p/chromium/issues/detail?id=661311#c1}
             *  "If the extension has access to inject scripts into Tab, then we can return the url
             *   of Tab (because the extension could just inject a script to message the location.href)."
             */
            url: '<all_urls>',
            windowType: 'normal',
        })
        .then(result => {
            checkForLastErrorAndLog();
            return result;
        })
        .catch(() => {
            checkForLastErrorAndLog();
        });

    if (tabs) {
        for (const tab of tabs) {
            if (tab.id) {
                browser.tabs
                    .sendMessage(tab.id, {
                        name: CHILLY_EXTENSION_READY,
                    })
                    .then(() => {
                        checkForLastErrorAndLog();
                    })
                    .catch(() => {
                        // An error may happen if the contentscript is blocked from loading,
                        // and thus there is no runtime.onMessage handler to listen to the message.
                        checkForLastErrorAndLog();
                    });
            }
        }
    }
};

let controller: AppController;

const localStore = new LocalStore();
const firstTimeState = {
    config: {},
};
const platform = new ExtensionPlatform();
const notificationManager = new NotificationManager();
let openPopupCount = 0;
let notificationIsOpen = false;
let uiIsTriggering = false;
const openTabsIDs: Record<any, boolean> = {};
let sidePanelOpened = false;
const tabOriginMapping: Record<any, string> = {};
const requestAccountTabIds: Record<any, string> = {};
const bypassList = new Set();

const internalProcessHash: Record<EnvironmentType, boolean> = {
    [ENVIRONMENT_TYPE_POPUP]: true,
    [ENVIRONMENT_TYPE_NOTIFICATION]: true,
    [ENVIRONMENT_TYPE_SIDEPANEL]: true,
    [ENVIRONMENT_TYPE_FULLSCREEN]: true,
    [ENVIRONMENT_TYPE_BACKGROUND]: false,
};

// These are set after initialization
let connectRemote: (port: any) => void;
let connectExternal: (port: any) => void;

browser.runtime.onConnect.addListener(async (...args) => {
    // Queue up connection attempts here, waiting until after initialization
    await isInitialized;

    // This is set in `setupController`, which is called as part of initialization
    connectRemote && connectRemote(...args);
});
browser.runtime.onConnectExternal.addListener(async (...args) => {
    // Queue up connection attempts here, waiting until after initialization
    await isInitialized;
    // This is set in `setupController`, which is called as part of initialization
    connectExternal && connectExternal(...args);
});

function saveTimestamp() {
    const timestamp = new Date().toISOString();
    browser.storage.session.set({ timestamp });
}

/** SCAM SITE DETECTION */
browser.webNavigation.onBeforeNavigate.addListener(
    async details => {
        try {
            const url = new URL(details.url);
            const domain = url.hostname;

            if (bypassList.has(domain)) {
                return; // Skip check
            }

            const res = await fetch(`https://lookup.phishfort.com/api/lookup?domain=${domain}`);
            const data = await res.json();

            if (data.dangerous) {
                await browser.tabs.update(details.tabId, {
                    // Bundled warning page — the wallet has no website to redirect to.
                    url: browser.runtime.getURL(`/phishing.html#domain=${domain}`),
                });
            }
        } catch (err) {
            logger.log('Phishing check failed:', err);
        }
    },
    {
        url: [{ urlMatches: 'https?://.*' }],
    },
);

//add listener for bypass domain
browser.runtime.onMessage.addListener(async msg => {
    if (msg.type === 'bypass-domain' && msg.domain) {
        if (!bypassList.has(msg.domain)) {
            bypassList.add(msg.domain);
        }

        return { success: true };
    } else if (msg.type === 'get-expanded-view-ids') {
        return Promise.resolve(Object.keys(openTabsIDs).map(Number));
    }
});

async function initialize() {
    try {
        const initData = await loadStateFromPersistence();
        const initState = initData.data;
        let isFirstControllerSetup;

        if (isManifestV3) {
            saveTimestamp();

            setInterval(() => {
                saveTimestamp();
            }, 3000);

            const sessionData = await browser.storage.session.get(['isFirstControllerSetup']);
            isFirstControllerSetup = sessionData?.isFirstControllerSetup === undefined;
            await browser.storage.session.set({ isFirstControllerSetup });
        }

        controller = new AppController({ initState, localStore, showUserConfirmation, platform });

        // setup state persistence
        pipeline(
            storeAsStream(controller.store),
            debounce(1000),
            createStreamSink(async (state: any) => {
                await localStore.set(state);
            }),
            (error: any) => {
                logger.log(TAG, 'Persistence pipeline failed', error);
            },
        );

        /**
         * Connects a Port to the controller via a multiplexed duplex stream.
         * This method identifies trusted interfaces, and connects them differently from untrusted (web pages).
         */
        connectRemote = async (remotePort: any) => {
            const streamName: EnvironmentType = remotePort.name;

            let isInternalProcess = false;
            const senderUrl = remotePort.sender?.url ? new URL(remotePort.sender.url) : null;

            const sourcePlatform = getPlatform();

            if (sourcePlatform === PLATFORM_FIREFOX) {
                isInternalProcess = internalProcessHash[streamName];
            } else {
                isInternalProcess =
                    senderUrl?.origin === `chrome-extension://${browser.runtime.id}`;
            }

            if (isInternalProcess) {
                logger.log(TAG, 'internal', streamName);
                const portStream = new PortStream(remotePort);
                controller.isClientOpen = true;
                controller.setupTrustedCommunication(portStream, remotePort.sender);

                switch (streamName) {
                    case ENVIRONMENT_TYPE_POPUP:
                        openPopupCount += 1;

                        finished(portStream, () => {
                            openPopupCount -= 1;
                            const isClientOpen = isClientOpenStatus();
                            controller.isClientOpen = isClientOpen;
                            onCloseEnvironmentInstances(isClientOpen, ENVIRONMENT_TYPE_POPUP);
                            resolveWalletShowCallsStatusApprovals();
                        });
                        break;

                    case ENVIRONMENT_TYPE_NOTIFICATION:
                        notificationIsOpen = true;

                        finished(portStream, () => {
                            notificationIsOpen = false;
                            const isClientOpen = isClientOpenStatus();
                            controller.isClientOpen = isClientOpen;
                            onCloseEnvironmentInstances(
                                isClientOpen,
                                ENVIRONMENT_TYPE_NOTIFICATION,
                            );
                            resolveWalletShowCallsStatusApprovals();
                        });
                        break;

                    case ENVIRONMENT_TYPE_FULLSCREEN:
                        const tabId = remotePort.sender.tab.id;
                        openTabsIDs[tabId] = true;

                        finished(portStream, () => {
                            delete openTabsIDs[tabId];
                            const isClientOpen = isClientOpenStatus();
                            controller.isClientOpen = isClientOpen;
                            onCloseEnvironmentInstances(isClientOpen, ENVIRONMENT_TYPE_FULLSCREEN);
                        });
                        break;

                    case ENVIRONMENT_TYPE_SIDEPANEL:
                        sidePanelOpened = true;

                        finished(portStream, () => {
                            sidePanelOpened = false;
                            const isClientOpen = isClientOpenStatus();
                            controller.isClientOpen = isClientOpen;
                            onCloseEnvironmentInstances(isClientOpen, ENVIRONMENT_TYPE_SIDEPANEL);
                        });
                        break;
                }
            } else {
                // this is triggered when a new tab is opened, or origin(url) is changed
                if (remotePort.sender && remotePort.sender.tab && remotePort.sender.url) {
                    const tabId = remotePort.sender.tab.id;
                    const url = new URL(remotePort.sender.url);
                    const { origin } = url;

                    // store the orgin to corresponding tab so it can provide infor for onActivated listener
                    if (!Object.keys(tabOriginMapping).includes(tabId)) {
                        tabOriginMapping[tabId] = origin;
                    }

                    remotePort.onMessage.addListener((msg: any) => {
                        if (msg.data && msg.data.method === MESSAGE_TYPE.ETH_REQUEST_ACCOUNTS) {
                            requestAccountTabIds[origin] = tabId;
                        }
                    });
                }
                connectExternal(remotePort);
            }
        };

        // communication with page or other extension
        connectExternal = remotePort => {
            const streamName: EnvironmentType = remotePort.name;
            logger.log(TAG, 'external', streamName);

            const portStream = new PortStream(remotePort);
            controller.setupUntrustedCommunication({
                connectionStream: portStream,
                sender: remotePort.sender,
            });
        };

        const isClientOpenStatus = () => {
            return (
                openPopupCount > 0 || Boolean(Object.keys(openTabsIDs).length) || notificationIsOpen
            );
        };

        const onCloseEnvironmentInstances = (
            isClientOpen: boolean,
            environmentType: EnvironmentType,
        ) => {
            // if all instances are closed we call a method on the controller to stop any polling
            if (isClientOpen === false) {
                controller.onClientClosed();
                // otherwise we want to only remove the polling tokens for the environment type that has closed
            } else {
                // in the case of fullscreen environment a user might have multiple tabs open so we don't want to disconnect all of
                // its corresponding polling tokens unless all tabs are closed.
                if (
                    environmentType === ENVIRONMENT_TYPE_FULLSCREEN &&
                    Boolean(Object.keys(openTabsIDs).length)
                ) {
                    return;
                }
                controller.onEnvironmentTypeClosed(environmentType);
            }
        };

        const resolveWalletShowCallsStatusApprovals = () => {
            const pendingApprovals = controller.approvalController.state.pendingApprovals;
            for (const [approvalId, approval] of Object.entries(pendingApprovals)) {
                if (approval.type === EIP5792_APPROVAL_TYPES.SHOW_CALLS_STATUS) {
                    void controller.resolvePendingApproval(approvalId, null);
                }
            }
        };

        /**
         * Opens the browser popup for user confirmation
         */
        async function showUserConfirmation() {
            if (!uiIsTriggering && openPopupCount === 0) {
                uiIsTriggering = true;
                try {
                    if (!sidePanelOpened) {
                        const currentPopupId = controller.appStateController.getCurrentPopupId();
                        await notificationManager.showPopup(
                            newPopupId =>
                                controller.appStateController.setCurrentPopupId(newPopupId),
                            currentPopupId,
                        );
                    }
                } finally {
                    uiIsTriggering = false;
                }
            }
        }

        function getUnapprovedTransactionCount() {
            let count =
                controller.appStateController.waitingForUnlock.length +
                controller.approvalController.getTotalApprovalCount();

            return count;
        }

        /**
         * Updates the Web Extension's "badge" number, on the little fox in the toolbar.
         * The number reflects the current number of pending transactions or message signatures needing user approval.
         */
        function updateBadge() {
            let label = '';
            const count = getUnapprovedTransactionCount();
            if (count) {
                label = String(count);
            }
            // browserAction has been replaced by action in MV3
            if (isManifestV3) {
                browser.action.setBadgeText({ text: label });
                browser.action.setBadgeBackgroundColor({ color: '#4AA8DC' });
            } else {
                browser.browserAction.setBadgeText({ text: label });
                browser.browserAction.setBadgeBackgroundColor({ color: '#4AA8DC' });
            }
        }

        controller.signatureController.hub.on('updateBadge', updateBadge);

        //@ts-ignore
        controller.controllerMessenger.subscribe('ApprovalController:stateChange', updateBadge);

        updateBadge();

        await sendReadyMessageToTabs();

        logger.log(TAG, 'initialized');

        resolveInitialization();
    } catch (error) {
        logger.error(TAG, error);
        rejectInitialization();
    }
}

/**
 * Loads any stored data, prioritizing the latest storage strategy.
 * Migrates that data schema in case it was last loaded on an older version.
 */
export async function loadStateFromPersistence() {
    // migrations
    const migrator = new Migrator({
        migrations: [
            {
                version: 1,
                migrate: async (versionedData: any) => {
                    // Clean up old portfolioTransactions data from localStorage
                    if (versionedData.data && versionedData.data.PortfolioController) {
                        const portfolioController = versionedData.data.PortfolioController;

                        if (portfolioController.portfolioTransactions) {
                            logger.log(
                                'Cleaning up old portfolioTransactions data from localStorage...',
                            );
                            delete portfolioController.portfolioTransactions;
                        }

                        if (portfolioController.portfolioNfts) {
                            logger.log('Cleaning up old portfolioNfts data from localStorage...');
                            delete portfolioController.portfolioNfts;
                        }

                        if (portfolioController.topCoinsByNetwork) {
                            logger.log(
                                'Cleaning up old topCoinsByNetwork data from localStorage...',
                            );
                            delete portfolioController.topCoinsByNetwork;
                        }
                    }

                    return versionedData;
                },
            },
            {
                version: 2,
                migrate: async (versionedData: any) => {
                    // Migrate nativeCoinPrices from Record<string, Record<number, number>> to Record<number, number>
                    if (versionedData.data && versionedData.data.PortfolioController) {
                        const portfolioController = versionedData.data.PortfolioController;

                        if (portfolioController.nativeCoinPrices) {
                            const oldNativeCoinPrices = portfolioController.nativeCoinPrices;

                            // Check if it's the old nested structure (Record<string, Record<number, number>>)
                            const isOldStructure =
                                typeof oldNativeCoinPrices === 'object' &&
                                oldNativeCoinPrices !== null &&
                                !Array.isArray(oldNativeCoinPrices) &&
                                Object.keys(oldNativeCoinPrices).length > 0 &&
                                typeof Object.values(oldNativeCoinPrices)[0] === 'object' &&
                                Object.values(oldNativeCoinPrices)[0] !== null &&
                                !Array.isArray(Object.values(oldNativeCoinPrices)[0]);

                            if (isOldStructure) {
                                logger.log(
                                    'Migrating nativeCoinPrices from nested structure to flat structure...',
                                );

                                // Convert old nested structure to new flat structure
                                // We'll merge all wallet addresses' prices, keeping the last non-zero value for each platform_id
                                const newNativeCoinPrices: Record<number, number> = {};

                                Object.values(oldNativeCoinPrices).forEach((walletPrices: any) => {
                                    if (walletPrices && typeof walletPrices === 'object') {
                                        Object.entries(walletPrices).forEach(
                                            ([platformId, price]: [string, any]) => {
                                                const platformIdNum = Number(platformId);
                                                const priceNum = Number(price);

                                                // Keep the price if it's valid and non-zero, or if we don't have one yet
                                                if (
                                                    !isNaN(platformIdNum) &&
                                                    !isNaN(priceNum) &&
                                                    (priceNum !== 0 ||
                                                        newNativeCoinPrices[platformIdNum] ===
                                                            undefined)
                                                ) {
                                                    newNativeCoinPrices[platformIdNum] = priceNum;
                                                }
                                            },
                                        );
                                    }
                                });

                                portfolioController.nativeCoinPrices = newNativeCoinPrices;
                                logger.log(
                                    'Successfully migrated nativeCoinPrices structure',
                                    newNativeCoinPrices,
                                );
                            }
                        }
                    }

                    return versionedData;
                },
            },
            {
                version: 3,
                migrate: async (versionedData: any) => {
                    // Clean up old portfolioPrices data from storage (large + no longer needed)
                    if (versionedData.data && versionedData.data.PortfolioController) {
                        const portfolioController = versionedData.data.PortfolioController;

                        if (portfolioController.portfolioPrices) {
                            logger.log('Cleaning up old portfolioPrices data from localStorage...');
                            delete portfolioController.portfolioPrices;
                        }
                    }

                    return versionedData;
                },
            },
            {
                version: 4,
                migrate: async (versionedData: any) => {
                    // Remove deprecated latestGas from storage (GlobalState + GasController)
                    if (versionedData.data && versionedData.data.GasController) {
                        const gasControllerState = versionedData.data.GasController;

                        if (gasControllerState.latestGas) {
                            logger.log(
                                'Cleaning up deprecated GasController.latestGas from storage...',
                            );
                            delete gasControllerState.latestGas;

                            // Reset gasType to empty object to use MEDIUM as default
                            gasControllerState.gasType = {};
                        }
                    }

                    return versionedData;
                },
            },
            {
                version: 5,
                migrate: async (versionedData: any) => {
                    // Remove deprecated monadMetadata and monadMainnet from preferences
                    if (
                        versionedData.data &&
                        versionedData.data.PreferencesController &&
                        versionedData.data.PreferencesController.preferences
                    ) {
                        const preferences = versionedData.data.PreferencesController.preferences;

                        if ('monadMetadata' in preferences) {
                            logger.log('Cleaning up deprecated monadMetadata from preferences...');
                            delete preferences.monadMetadata;
                        }
                        if ('monadMainnet' in preferences) {
                            logger.log('Cleaning up deprecated monadMainnet from preferences...');
                            delete preferences.monadMainnet;
                        }
                    }

                    return versionedData;
                },
            },
            {
                version: 6,
                migrate: async (versionedData: any) => {
                    // Backend removal: drop state of deleted controllers
                    // (Cognito auth, Karma, Referral, backend Yield) and the
                    // orphaned encrypted cognito vault.
                    if (versionedData.data) {
                        for (const key of [
                            'CognitoController',
                            'KarmaController',
                            'ReferralController',
                            'YieldController',
                        ]) {
                            if (key in versionedData.data) {
                                logger.log(`Removing deprecated ${key} state from storage...`);
                                delete versionedData.data[key];
                            }
                        }

                        if ('cognitoVault' in versionedData.data) {
                            logger.log('Removing orphaned cognitoVault from storage...');
                            delete versionedData.data.cognitoVault;
                        }

                        // Drop preferences of removed features
                        const preferences =
                            versionedData.data.PreferencesController?.preferences;

                        if (preferences) {
                            for (const key of [
                                'smartWalletEnabled',
                                'enableReferralProgram',
                                'gasless',
                                'gaslessTokens',
                                'referFriendsMessage',
                                'userFlagSet',
                                'xHandleStatus',
                                'joinedGuild',
                                'moonPayCurrencies',
                                'moonPayCurrenciesTimestamp',
                            ]) {
                                if (key in preferences) {
                                    delete preferences[key];
                                }
                            }
                        }
                    }

                    return versionedData;
                },
            },
            {
                version: 7,
                migrate: async (versionedData: any) => {
                    // Platform-id unification: persisted state was keyed by the
                    // old backend platform ids; remap the keys to chain ids.
                    // Unknown ids are dropped (defensive; lookups throw on them).
                    const LEGACY_PLATFORM_TO_CHAIN_ID: Record<string, number> = {
                        '1027': 1,
                        '-1027': 11155111,
                        '1839': 56,
                        '3890': 137,
                        '-3890': 80002,
                        '11841': 42161,
                        '5805': 43114,
                        '27716': 8453,
                        '-27716': 84532,
                        '30495': 143,
                        '-10143': 10143,
                    };
                    const KNOWN_CHAIN_IDS = new Set([
                        1, 11155111, 56, 137, 80002, 42161, 43114, 8453, 84532, 143, 10143,
                    ]);

                    const remapKeys = (obj: any): any => {
                        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
                            return obj;
                        }
                        const result: Record<string, any> = {};
                        for (const key of Object.keys(obj)) {
                            const numericKey = Number(key);
                            if (Number.isNaN(numericKey)) {
                                result[key] = obj[key];
                            } else if (key in LEGACY_PLATFORM_TO_CHAIN_ID) {
                                result[String(LEGACY_PLATFORM_TO_CHAIN_ID[key])] = obj[key];
                            } else if (KNOWN_CHAIN_IDS.has(numericKey)) {
                                result[key] = obj[key];
                            }
                            // else: unknown platform id — drop the entry
                        }
                        return result;
                    };

                    const portfolio = versionedData.data?.PortfolioController;

                    if (portfolio) {
                        logger.log('Remapping PortfolioController platform-id keys...');
                        // Record<platformId, ...>
                        if (portfolio.nativeCoinPrices) {
                            portfolio.nativeCoinPrices = remapKeys(portfolio.nativeCoinPrices);
                        }
                        if (portfolio.coinPrices) {
                            portfolio.coinPrices = remapKeys(portfolio.coinPrices);
                        }
                        // Record<address, Record<platformId, ...>>
                        for (const field of [
                            'pendingTransactions',
                            'portfolioCoins',
                            'portfolioNfts',
                            'portfolioTransactions',
                        ]) {
                            const byAddress = portfolio[field];
                            if (byAddress && typeof byAddress === 'object') {
                                for (const address of Object.keys(byAddress)) {
                                    byAddress[address] = remapKeys(byAddress[address]);
                                }
                            }
                        }
                    }

                    return versionedData;
                },
            },
            {
                version: 8,
                migrate: async (versionedData: any) => {
                    // Remap pre-rebrand field names in place so existing installs keep
                    // their selected network, favorites and coin cache. The legacy
                    // spellings live in PRE_REBRAND_FIELDS (see its docblock).
                    const renameField = (obj: any, from: string, to: string) => {
                        if (obj && typeof obj === 'object' && from in obj) {
                            obj[to] = obj[from];
                            delete obj[from];
                        }
                    };

                    const remapChain = (chain: any) => {
                        renameField(chain, PRE_REBRAND_FIELDS.chainKey, 'chain_key');
                        renameField(chain, PRE_REBRAND_FIELDS.platformId, 'platform_id');
                    };

                    const network = versionedData.data?.NetworkController;
                    if (network?.selectedNetwork) {
                        remapChain(network.selectedNetwork);
                    }

                    const preferences = versionedData.data?.PreferencesController?.preferences;
                    if (Array.isArray(preferences?.favoriteCoins)) {
                        for (const coin of preferences.favoriteCoins) {
                            renameField(coin, PRE_REBRAND_FIELDS.coinId, 'coinId');
                        }
                    }

                    const portfolio = versionedData.data?.PortfolioController;
                    if (Array.isArray(portfolio?.cachingCoins)) {
                        for (const coin of portfolio.cachingCoins) {
                            renameField(coin, PRE_REBRAND_FIELDS.coinId, 'coinId');
                        }
                    }

                    return versionedData;
                },
            },
        ],
    });
    migrator.on('error', logger.warn);

    // read from disk
    // first from preferred, async API:
    let versionedData = (await localStore.get()) || migrator.generateInitialState(firstTimeState);

    if (versionedData && !versionedData.data) {
        versionedData = migrator.generateInitialState(firstTimeState);
    }

    // migrate data
    versionedData = await migrator.migrateData(versionedData);

    if (!versionedData) {
        throw new Error('Migrator returned undefined');
    } else if (!isObject(versionedData.meta)) {
        throw new Error(`Migrator metadata has invalid type '${typeof versionedData.meta}'`);
    } else if (typeof versionedData.meta.version !== 'number') {
        throw new Error(
            `Migrator metadata version has invalid type '${typeof versionedData.meta.version}'`,
        );
    } else if (!isObject(versionedData.data)) {
        throw new Error(`Migrator data has invalid type '${typeof versionedData.data}'`);
    }
    // this initializes the meta/version data as a class variable to be used for future writes
    localStore.setMetadata(versionedData.meta);

    // write to disk
    localStore.set(versionedData.data);

    // return just the data
    return versionedData;
}

async function onAppOpen() {
    // On first install, open a new tab with Chilly
    const storeAlreadyExisted = Boolean(await localStore.get());
    // If the store doesn't exist, then this is the first time running this script,
    // and is therefore an install
    if (!storeAlreadyExisted) {
        platform.openExtensionInBrowser();
    }
}

export async function initBackground() {
    await onAppOpen();
    initialize().catch(logger.log);
}

if (typeof process === 'undefined' || !process.env?.JEST_WORKER_ID) {
    initBackground();
}
