const messages = {
    errors: {
        disconnected: () => 'Chilly: Disconnected from chain. Attempting to connect.',
        permanentlyDisconnected: () =>
            'Chilly: Disconnected from Chilly background. Page reload required.',
        sendSiteMetadata: () =>
            `Chilly: Failed to send site metadata. This is an internal error, please report this bug.`,
        unsupportedSync: (method: string) =>
            `Chilly: The Chilly Ethereum provider does not support synchronous methods like ${method} without a callback parameter.`,
        invalidDuplexStream: () => 'Must provide a Node.js-style duplex stream.',
        invalidNetworkParams: () =>
            'Chilly: Received invalid network parameters. Please report this bug.',
        invalidRequestArgs: () => `Expected a single, non-array, object argument.`,
        invalidRequestMethod: () => `'args.method' must be a non-empty string.`,
        invalidRequestParams: () => `'args.params' must be an object or array if provided.`,
        invalidLoggerObject: () => `'args.logger' must be an object if provided.`,
        invalidLoggerMethod: (method: string) =>
            `'args.logger' must include required method '${method}'.`,
    },
    info: {
        connected: (chainId: string) => `Chilly: Connected to chain with ID "${chainId}".`,
    },
    warnings: {
        // deprecated properties
        chainIdDeprecation: `Chilly: 'ethereum.chainId' is deprecated and may be removed in the future. Please use the 'eth_chainId' RPC method instead.`,
        networkVersionDeprecation: `Chilly: 'ethereum.networkVersion' is deprecated and may be removed in the future. Please use the 'net_version' RPC method instead.`,
        selectedAddressDeprecation: `Chilly: 'ethereum.selectedAddress' is deprecated and may be removed in the future. Please use the 'eth_accounts' RPC method instead.`,
        // deprecated methods
        enableDeprecation: `Chilly: 'ethereum.enable()' is deprecated and may be removed in the future. Please use the 'eth_requestAccounts' RPC method instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1102`,
        sendDeprecation: `Chilly: 'ethereum.send(...)' is deprecated and may be removed in the future. Please use 'ethereum.sendAsync(...)' or 'ethereum.request(...)' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`,
        // deprecated events
        events: {
            close: `Chilly: The event 'close' is deprecated and may be removed in the future. Please use 'disconnect' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#disconnect`,
            data: `Chilly: The event 'data' is deprecated and will be removed in the future. Use 'message' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#message`,
            networkChanged: `Chilly: The event 'networkChanged' is deprecated and may be removed in the future. Use 'chainChanged' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#chainchanged`,
            notification: `Chilly: The event 'notification' is deprecated and may be removed in the future. Use 'message' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#message`,
        },
        rpc: {
            ethDecryptDeprecation: `Chilly: The RPC method 'eth_decrypt' is deprecated and may be removed in the future.`,
            ethGetEncryptionPublicKeyDeprecation: `Chilly: The RPC method 'eth_getEncryptionPublicKey' is deprecated and may be removed in the future.`,
            walletWatchAssetNFTExperimental: `Chilly: The RPC method 'wallet_watchAsset' is experimental for ERC721/ERC1155 assets and may change in the future.`,
        },
    },
};
export default messages;
