import type { JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import { createIdRemapMiddleware } from '@metamask/json-rpc-engine';
import { rpcErrors } from '@metamask/rpc-errors';
import type {
    Json,
    JsonRpcParams,
    JsonRpcRequest,
    PendingJsonRpcResponse,
} from '@metamask/utils';
import messages from './messages';

export const ERC721 = 'ERC721';
export const ERC1155 = 'ERC1155';
export const ERC20 = 'ERC20';

/**
 * Create JSON-RPC middleware that logs warnings for deprecated RPC methods.
 *
 * @param log - The logging API to use.
 * @returns The JSON-RPC middleware.
 */
export function createRpcWarningMiddleware(
  log: ConsoleLike,
): JsonRpcMiddleware<JsonRpcParams, Json> {
  const sentWarnings = {
    ethDecryptDeprecation: false,
    ethGetEncryptionPublicKeyDeprecation: false,
    walletWatchAssetNFTExperimental: false,
  };

  return (req, _res, next) => {
    if (!sentWarnings.ethDecryptDeprecation && req.method === 'eth_decrypt') {
      log.warn(messages.warnings.rpc.ethDecryptDeprecation);
      sentWarnings.ethDecryptDeprecation = true;
    } else if (
      !sentWarnings.ethGetEncryptionPublicKeyDeprecation &&
      req.method === 'eth_getEncryptionPublicKey'
    ) {
      log.warn(messages.warnings.rpc.ethGetEncryptionPublicKeyDeprecation);
      sentWarnings.ethGetEncryptionPublicKeyDeprecation = true;
    } else if (
      !sentWarnings.walletWatchAssetNFTExperimental &&
      req.method === 'wallet_watchAsset' &&
      [ERC721, ERC1155].includes(
        (req as JsonRpcRequest<{ type: string }>).params?.type || '',
      )
    ) {
      log.warn(messages.warnings.rpc.walletWatchAssetNFTExperimental);
      sentWarnings.walletWatchAssetNFTExperimental = true;
    }
    next();
  };
}

export type Maybe<Type> = Partial<Type> | null | undefined;

export type ConsoleLike = Pick<
  Console,
  'log' | 'warn' | 'error' | 'debug' | 'info' | 'trace'
>;

// Constants

export const EMITTED_NOTIFICATIONS = Object.freeze([
  'eth_subscription', // per eth-json-rpc-filters/subscriptionManager
]);

// Utility functions

/**
 * Gets the default middleware for external providers, consisting of an ID
 * remapping middleware and an error middleware.
 *
 * @param logger - The logger to use in the error middleware.
 * @returns An array of @metamask/json-rpc-engine middleware functions.
 */
export const getDefaultExternalMiddleware = (logger: ConsoleLike = console) => [
  createIdRemapMiddleware(),
  createErrorMiddleware(logger),
  createRpcWarningMiddleware(logger),
];

/**
 * A `json-rpc-engine` middleware that logs RPC errors and validates the request
 * method.
 *
 * @param log - The logging API to use.
 * @returns A @metamask/json-rpc-engine middleware function.
 */
function createErrorMiddleware(
  log: ConsoleLike,
): JsonRpcMiddleware<JsonRpcParams, Json> {
  return (request, response, next) => {
    // json-rpc-engine will terminate the request when it notices this error
    if (typeof request.method !== 'string' || !request.method) {
      response.error = rpcErrors.invalidRequest({
        message: `The request 'method' must be a non-empty string.`,
        data: request,
      });
    }

    next((done) => {
      const { error } = response;
      if (!error) {
        return done();
      }
      log.warn(`Chilly - RPC Error: ${error.message}`, error);
      return done();
    });
  };
}

// resolve response.result or response, reject errors
export const getRpcPromiseCallback =
  (
    resolve: (value?: any) => void,
    reject: (error?: Error) => void,
    unwrapResult = true,
  ) =>
  (error: Error, response: PendingJsonRpcResponse<Json>): void => {
    if (error || response.error) {
      reject(error || response.error);
    } else {
      !unwrapResult || Array.isArray(response)
        ? resolve(response)
        : resolve(response.result);
    }
  };

/**
 * Checks whether the given chain ID is valid, meaning if it is non-empty,
 * '0x'-prefixed string.
 *
 * @param chainId - The chain ID to validate.
 * @returns Whether the given chain ID is valid.
 */
export const isValidChainId = (chainId: unknown): chainId is string =>
  Boolean(chainId) && typeof chainId === 'string' && chainId.startsWith('0x');

/**
 * Checks whether the given network version is valid, meaning if it is non-empty
 * string.
 *
 * @param networkVersion - The network version to validate.
 * @returns Whether the given network version is valid.
 */
export const isValidNetworkVersion = (
  networkVersion: unknown,
): networkVersion is string =>
  Boolean(networkVersion) && typeof networkVersion === 'string';

export const NOOP = () => undefined;