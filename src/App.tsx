import { default as PortDuplexStream, default as PortStream } from 'extension-port-stream';
import browser from 'webextension-polyfill';

import EthQuery from '@metamask/eth-query';
//@ts-ignore
import Eth from '@metamask/ethjs';
//@ts-ignore
import StreamProvider from 'web3-stream-provider';
import ExtensionPlatform from './lib/ExtensionPlatform';
import createRPCClientFactory from './lib/RPCClientFactory';
import { setupMultiplex } from './lib/stream-utils';
import {
    ENVIRONMENT_TYPE_FULLSCREEN,
    ENVIRONMENT_TYPE_POPUP,
    EnvironmentType,
} from './shared/constants/app';
import { CONTROLLER, INTERNAL_PROVIDER } from './shared/constants/stream';
import { ActiveTab } from './shared/types/BrowserTab';
import { BackgroundConnection } from './shared/types/Connection';
import { Chrome } from './shared/types/Global';
import { checkForLastErrorAndLog, isManifestV3 } from './shared/utils/browser-runtime-utils';
import logger from './shared/utils/logger';
import { getEnvironmentType } from './shared/utils/utils';
import { ReduxStore } from './store/store';
import launchChillyUI, { startReloadPage, updateBackgroundConnection } from './ui';

declare global {
    namespace globalThis {
        var platform: ExtensionPlatform;
        var chrome: Chrome;
        var define: any;
        var ethereumProvider: StreamProvider;
        var ethQuery: EthQuery;
        var eth: Eth;
    }
}

const container = document.getElementById('app-content');

export async function start() {
    // create platform global
    global.platform = new ExtensionPlatform();

    // identify window type (popup, notification)
    const windowType = getEnvironmentType();

    let isUIInitialised = false;

    // setup stream to background
    let extensionPort = browser.runtime.connect({ name: windowType });
    let connectionStream = new PortStream(extensionPort);

    const activeTab = await queryCurrentActiveTab(windowType);

    if (isManifestV3) {
        /*
         * In case of MV3 the issue of blank screen was very frequent, it is caused by UI initialising before background is ready to send state.
         * Code below ensures that UI is rendered only after "CONNECTION_READY" or "startUISync"
         * messages are received thus the background is ready, and ensures that streams and
         * phishing warning page load only after the "startUISync" message is received.
         * In case the UI is already rendered, only update the streams.
         */
        const messageListener = async (message: any) => {
            if (message?.data?.method === 'startUISync') {
                if (isUIInitialised) {
                    // Currently when service worker is revived we create new streams
                    // in later version we might try to improve it by reviving same streams.
                    updateUIStreams();
                } else {
                    initializeUiWithTab(activeTab);
                }
            }
        };

        // resetExtensionStreamAndListeners takes care to remove listeners from closed streams
        // it also creates new streams and attaches event listeners to them
        const resetExtensionStreamAndListeners = () => {
            extensionPort.onMessage.removeListener(messageListener);
            extensionPort.onDisconnect.removeListener(resetExtensionStreamAndListeners);

            extensionPort = browser.runtime.connect({ name: windowType });
            connectionStream = new PortStream(extensionPort);
            extensionPort.onMessage.addListener(messageListener);
            extensionPort.onDisconnect.addListener(resetExtensionStreamAndListeners);
        };

        extensionPort.onMessage.addListener(messageListener);
        extensionPort.onDisconnect.addListener(resetExtensionStreamAndListeners);
    } else {
        const messageListener = async (message: any) => {
            if (message?.data?.method === 'startUISync') {
                initializeUiWithTab(activeTab);
                extensionPort.onMessage.removeListener(messageListener);
            }
        };
        extensionPort.onMessage.addListener(messageListener);
    }

    // Try to reload the extension if the UI is waiting for more than 60s
    setTimeout(() => {
        if (!isUIInitialised) {
            startReloadPage(container);
        }
    }, 60000);

    function initializeUiWithTab(tab: any) {
        initializeUi(tab, connectionStream, (store: ReduxStore) => {
            isUIInitialised = true;

            const state = store.getState();
            const { globalState: { completedOnboarding } = {} } = state;

            if (!completedOnboarding && windowType !== ENVIRONMENT_TYPE_FULLSCREEN) {
                global.platform.openExtensionInBrowser();
            }
        });
    }

    function initializeUi(activeTab: any, connectionStream: any, cb: (store: ReduxStore) => void) {
        connectToAccountManager(connectionStream, (backgroundConnection: BackgroundConnection) => {
            launchChillyUI(
                backgroundConnection,
                {
                    activeTab,
                    container,
                },
                cb,
            );
        });
    }

    // Function to update new backgroundConnection in the UI
    function updateUIStreams() {
        connectToAccountManager(connectionStream, (backgroundConnection: BackgroundConnection) => {
            updateBackgroundConnection(backgroundConnection);
        });
    }
}

export async function queryCurrentActiveTab(windowType: EnvironmentType) {
    // At the time of writing we only have the `activeTab` permission which means
    // that this query will only succeed in the popup context (i.e. after a "browserAction")
    if (windowType !== ENVIRONMENT_TYPE_POPUP) {
        return null;
    }

    const tabs = await browser.tabs.query({ active: true, currentWindow: true }).catch(e => {
        checkForLastErrorAndLog() || logger.error(e);
    });

    if (tabs) {
        const [activeTab] = tabs;
        const { id, title, url } = activeTab;

        if (url) {
            const { origin, protocol } = new URL(url);

            if (origin && origin !== 'null') {
                const _activeTab: ActiveTab = {
                    id: id ?? 0,
                    title: title ?? '',
                    origin,
                    protocol,
                    url,
                };
                return _activeTab;
            }
        }
    }

    return null;
}

/**
 * Establishes a connection to the background and a Web3 provider
 *
 * @param {PortDuplexStream} connectionStream - PortStream instance establishing a background connection
 * @param {Function} cb - Called when controller connection is established
 */
export function connectToAccountManager(connectionStream: PortDuplexStream, cb: Function) {
    const mx = setupMultiplex(connectionStream);
    const controllerConnectionStream = mx.createStream(CONTROLLER);
    setupControllerConnection(controllerConnectionStream, cb);
    setupWeb3Connection(mx.createStream(INTERNAL_PROVIDER));
}

/**
 * Establishes a streamed connection to the background account manager
 *
 * @param {PortDuplexStream} controllerConnectionStream - PortStream instance establishing a background connection
 * @param {Function} cb - Called when the remote account manager connection is established
 */
export function setupControllerConnection(controllerConnectionStream: PortDuplexStream, cb: Function) {
    const backgroundRPC = createRPCClientFactory(controllerConnectionStream);
    cb(backgroundRPC);
}

/**
 * Establishes a streamed connection to a Web3 provider
 *
 * @param {PortDuplexStream} connectionStream - PortStream instance establishing a background connection
 */
export function setupWeb3Connection(connectionStream: PortDuplexStream) {
    const providerStream = new StreamProvider();
    providerStream.pipe(connectionStream).pipe(providerStream);
    //@ts-ignore
    connectionStream.on('error', logger.error.bind(logger));
    providerStream.on('error', logger.error.bind(logger));
    global.ethereumProvider = providerStream;
    global.ethQuery = new EthQuery(providerStream);
    global.eth = new Eth(providerStream);
}

if (typeof process === 'undefined' || !process.env?.JEST_WORKER_ID) {
    start().catch(logger.error);
}
