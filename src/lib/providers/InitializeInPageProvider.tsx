import type { Duplex } from 'readable-stream';
import type { EIP6963ProviderInfo } from './EIP6963';
import { announceProvider } from './EIP6963';
import { InpageProvider, InpageProviderOptions } from './InPageProvider';
import { shimWeb3 } from './shimWeb3';

type InitializeProviderOptions = {
    /**
     * The stream used to connect to the wallet.
     */
    connectionStream: Duplex;

    /**
     * The EIP-6963 provider info that should be announced if set.
     */
    providerInfo?: EIP6963ProviderInfo;

    /**
     * Whether the provider should be set as window.ethereum.
     */
    shouldSetOnWindow?: boolean;

    /**
     * Whether the window.web3 shim should be set.
     */
    shouldShimWeb3?: boolean;
} & InpageProviderOptions;

/**
 * Initializes a InpageProvider and (optionally) assigns it as window.ethereum.
 *
 * @param options - An options bag.
 * @param options.connectionStream - A Node.js stream.
 * @param options.jsonRpcStreamName - The name of the internal JSON-RPC stream.
 * @param options.maxEventListeners - The maximum number of event listeners.
 * @param options.providerInfo - The EIP-6963 provider info that should be announced if set.
 * @param options.shouldSendMetadata - Whether the provider should send page metadata.
 * @param options.shouldSetOnWindow - Whether the provider should be set as window.ethereum.
 * @param options.shouldShimWeb3 - Whether a window.web3 shim should be injected.
 * @param options.logger - The logging API to use. Default: `console`.
 * @returns The initialized provider (whether set or not).
 */
export function initializeProvider({
    connectionStream,
    jsonRpcStreamName,
    logger = console,
    maxEventListeners = 100,
    providerInfo,
    shouldSendMetadata = true,
    shouldSetOnWindow = true,
    shouldShimWeb3 = false,
}: InitializeProviderOptions): InpageProvider {
    const provider = new InpageProvider(connectionStream, {
        jsonRpcStreamName,
        logger,
        maxEventListeners,
        shouldSendMetadata,
    });

    const proxiedProvider = new Proxy(provider, {
        // some common libraries, e.g. web3@1.x, mess with our API
        deleteProperty: () => true,
        // fix issue with Proxy unable to access private variables from getters
        // https://stackoverflow.com/a/73051482
        get(target, propName: 'chainId' | 'networkVersion' | 'selectedAddress') {
            return target[propName];
        },
    });

    if (providerInfo) {
        announceProvider({
            info: providerInfo,
            provider: proxiedProvider,
        });
    }

    if (shouldSetOnWindow) {
        setGlobalProvider(proxiedProvider);
    }

    if (shouldShimWeb3) {
        shimWeb3(proxiedProvider, logger);
    }

    return proxiedProvider;
}

/**
 * Sets the given provider instance as window.chilly and window.ethereum and dispatches the
 * 'ethereum#initialized' event and 'chilly#initialized' event on window.
 *
 * @param providerInstance - The provider instance.
 */
export function setGlobalProvider(providerInstance: InpageProvider): void {
    try {
        (window as Record<string, any>).chilly = providerInstance;
        window.dispatchEvent(new Event('chilly#initialized'));
    } catch (error) {
        console.error('Chilly: Error setting global provider', error);
    }

    try {
        (window as Record<string, any>).ethereum = providerInstance;
        window.dispatchEvent(new Event('ethereum#initialized'));
    } catch (error) {
        console.error('Chilly: Error setting global provider', error);
    }
}
