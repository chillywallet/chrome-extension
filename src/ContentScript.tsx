import ObjectMultiplex from '@metamask/object-multiplex';
import { Substream } from '@metamask/object-multiplex/dist/Substream';
import { WindowPostMessageStream } from '@metamask/post-message-stream';
import PortStream from 'extension-port-stream';
import { pipeline } from 'readable-stream';
import browser from 'webextension-polyfill';
import { CHILLY_EXTENSION_READY } from './shared/constants/app';
import { CONTENT_SCRIPT, EXTERNAL_PROVIDER, INPAGE } from './shared/constants/stream';
import {
    checkForLastError,
    getIsBrowserPrerenderBroken,
} from './shared/utils/browser-runtime-utils';
import logger from './shared/utils/logger';
import shouldInjectProvider from './shared/utils/provider-injection';

let extensionMux: ObjectMultiplex,
    extensionChannel: Substream,
    extensionPort: browser.Runtime.Port | null,
    extensionStream: PortStream | null,
    pageMux: ObjectMultiplex,
    pageChannel: Substream;

/**
 * INPAGE - EXTENSION STREAM LOGIC
 */

const setupPageStreams = () => {
    // the transport-specific streams for communication between inpage and background
    const pageStream = new WindowPostMessageStream({
        name: CONTENT_SCRIPT,
        target: INPAGE,
    });

    // create and connect channel muxers
    // so we can handle the channels individually
    pageMux = new ObjectMultiplex();
    pageMux.setMaxListeners(25);

    pipeline(pageMux, pageStream, pageMux, (err: any) =>
        logStreamDisconnectWarning('Chilly Inpage Multiplex', err),
    );

    pageChannel = pageMux.createStream(EXTERNAL_PROVIDER);
};

// The field below is used to ensure that replay is done only once for each restart.
let CHILLY_EXTENSION_CONNECT_SENT = false;

const setupExtensionStreams = () => {
    CHILLY_EXTENSION_CONNECT_SENT = true;
    extensionPort = browser.runtime.connect({ name: CONTENT_SCRIPT });
    extensionStream = new PortStream(extensionPort);
    //@ts-ignore
    extensionStream.on('data', extensionStreamMessageListener);

    // create and connect channel muxers
    // so we can handle the channels individually
    extensionMux = new ObjectMultiplex();
    extensionMux.setMaxListeners(25);

    pipeline(extensionMux, extensionStream, extensionMux, (err: any) => {
        logStreamDisconnectWarning('Chilly Background Multiplex', err);
        notifyInpageOfStreamFailure();
    });

    // forward communication across inpage-background for these channels only
    extensionChannel = extensionMux.createStream(EXTERNAL_PROVIDER);

    pipeline(pageChannel, extensionChannel, pageChannel, error =>
        console.debug(`Chilly: Muxed traffic for channel "${EXTERNAL_PROVIDER}" failed.`, error),
    );

    // eslint-disable-next-line no-use-before-define
    extensionPort.onDisconnect.addListener(onDisconnectDestroyStreams);
};

/** Destroys all of the extension streams */
const destroyExtensionStreams = () => {
    pageChannel.removeAllListeners();

    extensionMux.removeAllListeners();
    extensionMux.destroy();

    //@ts-ignore
    extensionChannel.removeAllListeners();
    //@ts-ignore
    extensionChannel.destroy();

    extensionStream = null;
};

/**
 * Ends two-way communication streams between browser extension and
 * the local per-page browser context.
 */
export function destroyStreams() {
    if (!extensionPort) {
        return;
    }
    extensionPort.onDisconnect.removeListener(onDisconnectDestroyStreams);

    destroyExtensionStreams();

    extensionPort.disconnect();
    extensionPort = null;

    CHILLY_EXTENSION_CONNECT_SENT = false;
}

/**
 * When the extension background is loaded it sends the EXTENSION_MESSAGES.READY message to the browser tabs.
 * This listener/callback receives the message to set up the streams after service worker in-activity.
 *
 * @param {object} msg
 * @param {string} msg.name - custom property and name to identify the message received
 * @returns {Promise|undefined}
 */
const onMessageSetUpExtensionStreams = (msg: any) => {
    if (msg.name === CHILLY_EXTENSION_READY) {
        if (!extensionStream) {
            setupExtensionStreams();
        }
        return Promise.resolve(`Chilly: handled ${CHILLY_EXTENSION_READY}`);
    }
    return undefined;
};

/**
 * This listener destroys the extension streams when the extension port is disconnected,
 * so that streams may be re-established later when the extension port is reconnected.
 *
 * @param {Error} [err] - Stream connection error
 */
const onDisconnectDestroyStreams = (err: any) => {
    const lastErr = err || checkForLastError();

    destroyStreams();

    /**
     * If an error is found, reset the streams. When running two or more dapps, resetting the service
     * worker may cause the error, "Error: Could not establish connection. Receiving end does not
     * exist.", due to a race-condition. The disconnect event may be called by runtime.connect which
     * may cause issues. We suspect that this is a chromium bug as this event should only be called
     * once the port and connections are ready. Delay time is arbitrary.
     */
    if (lastErr) {
        logger.warn(`${lastErr} Resetting the streams.`);
        setTimeout(setupExtensionStreams, 1000);
    }
};

/**
 * Initializes two-way communication streams between the browser extension and
 * the local per-page browser context. This function also creates an event listener to
 * reset the streams if the service worker resets.
 */
const initStreams = () => {
    setupPageStreams();

    setupExtensionStreams();

    browser.runtime.onMessage.addListener(onMessageSetUpExtensionStreams);
};

/**
 * Error handler for page to extension stream disconnections
 *
 * @param {string} remoteLabel - Remote stream name
 * @param {Error} error - Stream connection error
 */
function logStreamDisconnectWarning(remoteLabel: string, error?: Error) {
    console.debug(`Chilly: Content script lost connection to "${remoteLabel}".`, error);
}

/**
 * The function notifies inpage when the extension stream connection is ready. When the
 * 'chilly_chainChanged' method is received from the extension, it implies that the
 * background state is completely initialized and it is ready to process method calls.
 * This is used as a notification to replay any pending messages in MV3.
 *
 * @param msg - instance of message received
 */
function extensionStreamMessageListener(msg: any) {
    if (CHILLY_EXTENSION_CONNECT_SENT && msg.data.method === 'chilly_chainChanged') {
        CHILLY_EXTENSION_CONNECT_SENT = false;
        window.postMessage(
            {
                target: INPAGE, // the post-message-stream "target"
                data: {
                    // this object gets passed to obj-multiplex
                    name: EXTERNAL_PROVIDER, // the obj-multiplex channel name
                    data: {
                        jsonrpc: '2.0',
                        method: 'CHILLY_EXTENSION_CONNECT_CAN_RETRY',
                    },
                },
            },
            window.location.origin,
        );
    }
}

/**
 * This function must ONLY be called in pump destruction/close callbacks.
 * Notifies the inpage context that streams have failed, via window.postMessage.
 * Relies on obj-multiplex and post-message-stream implementation details.
 */
function notifyInpageOfStreamFailure() {
    window.postMessage(
        {
            target: INPAGE, // the post-message-stream "target"
            data: {
                // this object gets passed to obj-multiplex
                name: EXTERNAL_PROVIDER, // the obj-multiplex channel name
                data: {
                    jsonrpc: '2.0',
                    method: 'CHILLY_STREAM_FAILURE',
                },
            },
        },
        window.location.origin,
    );
}

export function startContentScript() {
    if (shouldInjectProvider()) {
        initStreams();

        //@ts-ignore
        if (document.prerendering && getIsBrowserPrerenderBroken()) {
            document.addEventListener('prerenderingchange', () => {
                onDisconnectDestroyStreams(new Error('Prerendered page has become active.'));
            });
        }

        window.addEventListener('pageshow', event => {
            if (event.persisted) {
                console.warn('BFCached page has become active. Restoring the streams.');
                setupExtensionStreams();
            }
        });

        window.addEventListener('pagehide', event => {
            if (event.persisted) {
                console.warn('Page may become BFCached. Destroying the streams.');
                destroyStreams();
            }
        });
    }
}

if (typeof process === 'undefined' || !process.env?.JEST_WORKER_ID) {
    startContentScript();
}
