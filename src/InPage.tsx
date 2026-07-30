// need to make sure we aren't affected by overlapping namespaces
// and that we dont affect the app with our namespace
// mostly a fix for web3's BigNumber if AMD's "define" is defined...
let __define: any;

/**
 * Caches reference to global define object and deletes it to
 * avoid conflicts with other global define objects, such as
 * AMD's define function
 */
const cleanContextForImports = () => {
    __define = global.define;
    try {
        global.define = undefined;
    } catch (_) {
        console.warn('Chilly - global.define could not be deleted.');
    }
};

/**
 * Restores global define object from cached reference
 */
const restoreContextAfterImports = () => {
    try {
        global.define = __define;
    } catch (_) {
        console.warn('Chilly - global.define could not be overwritten.');
    }
};

cleanContextForImports();

/* eslint-disable import/first */
import { WindowPostMessageStream } from '@metamask/post-message-stream';
import { v4 as uuid } from 'uuid';
import { initializeProvider } from './lib/providers/InitializeInPageProvider';
import { CONTENT_SCRIPT, INPAGE } from './shared/constants/stream';
import logger from './shared/utils/logger';
import shouldInjectProvider from './shared/utils/provider-injection';

restoreContextAfterImports();

//
// setup plugin communication
//

export function startInPageProvider() {
    if (shouldInjectProvider()) {
    // setup background connection
    const stream = new WindowPostMessageStream({
        name: INPAGE,
        target: CONTENT_SCRIPT,
    });

    initializeProvider({
        connectionStream: stream,
        //@ts-ignore
        logger: logger,
        providerInfo: {
            uuid: uuid(),
            name: 'Chilly Wallet',
            // Classic mark (the default finish), kept in sync with
            // src/assets/images/icon-chilly-classic.svg — see scripts/render-icons.js.
            icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 rx=%2212%22 fill=%22%23152B40%22/%3E%3Cpath d=%22M24 9c-5 0-8.5 4.4-8.5 10.2 0 3.1-.9 5-2.5 7.1-1.2 1.6-.9 3.4.8 3.9-.4 3.7 1.7 8.8 10.2 8.8s10.6-5.1 10.2-8.8c1.7-.5 2-2.3.8-3.9-1.6-2.1-2.5-4-2.5-7.1C32.5 13.4 29 9 24 9z%22 fill=%22%2369C4EE%22/%3E%3C/svg%3E',
            rdns: 'io.chillywallet',
        },
    });
    }
}

if (typeof process === 'undefined' || !process.env?.JEST_WORKER_ID) {
    startInPageProvider();
}
