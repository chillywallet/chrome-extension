import { constructPermission, PermissionType } from '@metamask/permission-controller';
import { CaveatTypes, RestrictedMethods } from '../../shared/constants/permissions';
import { ChillyAccount } from '../../shared/types/Wallet';
import { isEqualCaseInsensitive } from '../../shared/utils/string';

/**
 * This file contains the specifications of the permissions and caveats
 * that are recognized by our permission system. See the PermissionController
 * README in @metamask/controllers for details.
 */

/**
 * The "keys" of all of permissions recognized by the PermissionController.
 * Permission keys and names have distinct meanings in the permission system.
 */
const PermissionNames = Object.freeze({
    ...RestrictedMethods,
});

/**
 * Factory functions for all caveat types recognized by the
 * PermissionController.
 */
const CaveatFactories = Object.freeze({
    [CaveatTypes.restrictReturnedAccounts]: (accounts: string[]) => {
        return { type: CaveatTypes.restrictReturnedAccounts, value: accounts };
    },
});

/**
 * Gets the specifications for all caveats that will be recognized by the
 * PermissionController.
 */
export const getCaveatSpecifications = ({
    getInternalAccounts,
}: {
    getInternalAccounts: () => ChillyAccount[];
}) => {
    return {
        [CaveatTypes.restrictReturnedAccounts]: {
            type: CaveatTypes.restrictReturnedAccounts,

            decorator: (method: any, caveat: any) => {
                return async (args: any) => {
                    const result = (await method(args)) as ChillyAccount[];
                    const legacyAccounts = result.map(item => item.address);
                    const smartAccounts = result
                        .filter(item => !!item.smartAddress)
                        .map(item => item.smartAddress as string);
                    return legacyAccounts
                        .concat(smartAccounts)
                        .filter(account => caveat.value.includes(account));
                };
            },

            validator: (caveat: any, _origin: any, _target: any) =>
                validateCaveatAccounts(caveat.value, getInternalAccounts),
        },
    };
};

/**
 * Gets the specifications for all permissions that will be recognized by the
 * PermissionController.
 */
export const getPermissionSpecifications = ({
    getInternalAccounts,
}: {
    getInternalAccounts: () => ChillyAccount[];
}) => {
    return {
        [PermissionNames.eth_accounts]: {
            permissionType: PermissionType.RestrictedMethod,
            targetName: PermissionNames.eth_accounts,
            allowedCaveats: [CaveatTypes.restrictReturnedAccounts],

            factory: (permissionOptions: any, requestData: any) => {
                // This value will be further validated as part of the caveat.
                if (!requestData.approvedAccounts) {
                    throw new Error(
                        `${PermissionNames.eth_accounts} error: No approved accounts specified.`,
                    );
                }

                return constructPermission({
                    ...permissionOptions,
                    caveats: [
                        CaveatFactories[CaveatTypes.restrictReturnedAccounts](
                            requestData.approvedAccounts,
                        ),
                    ],
                });
            },

            methodImplementation: async (_args: any) => {
                return getInternalAccounts();
            },

            validator: (permission: any, _origin: any, _target: any) => {
                const { caveats } = permission;

                if (
                    !caveats ||
                    caveats.length !== 1 ||
                    caveats[0].type !== CaveatTypes.restrictReturnedAccounts
                ) {
                    throw new Error(
                        `${PermissionNames.eth_accounts} error: Invalid caveats. There must be a single caveat of type "${CaveatTypes.restrictReturnedAccounts}".`,
                    );
                }
            },
        },
    };
};

/**
 * Validates the accounts associated with a caveat. In essence, ensures that
 * the accounts value is an array of non-empty strings, and that each string
 * corresponds to a PreferencesController identity.
 *
 * @param {string[]} accounts - The accounts associated with the caveat.
 * @param {() => Record<string, ChillyAccount>} getInternalAccounts -
 * Gets all AccountsController InternalAccounts.
 */
function validateCaveatAccounts(accounts: string[], getInternalAccounts: () => ChillyAccount[]) {
    if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error(
            `${PermissionNames.eth_accounts} error: Expected non-empty array of Ethereum addresses.`,
        );
    }

    const internalAccounts = getInternalAccounts();
    accounts.forEach(address => {
        if (!address || typeof address !== 'string') {
            throw new Error(
                `${PermissionNames.eth_accounts} error: Expected an array of Ethereum addresses. Received: "${address}".`,
            );
        }

        if (
            !internalAccounts.some(
                internalAccount =>
                    isEqualCaseInsensitive(internalAccount.address, address) ||
                    isEqualCaseInsensitive(internalAccount.smartAddress, address),
            )
        ) {
            throw new Error(
                `${PermissionNames.eth_accounts} error: Received unrecognized address: "${address}".`,
            );
        }
    });
}

/**
 * All unrestricted methods recognized by the PermissionController.
 * Unrestricted methods are ignored by the permission system, but every
 * JSON-RPC request seen by the permission system must correspond to a
 * restricted or unrestricted method, or the request will be rejected with a
 * "method not found" error.
 */
export const unrestrictedMethods = Object.freeze([
    'eth_blockNumber',
    'eth_call',
    'eth_chainId',
    // 'eth_decrypt',
    'eth_estimateGas',
    'eth_feeHistory',
    'eth_gasPrice',
    'eth_getBalance',
    'eth_getBlockByHash',
    'eth_getBlockByNumber',
    'eth_getBlockTransactionCountByHash',
    'eth_getBlockTransactionCountByNumber',
    'eth_getCode',
    // 'eth_getEncryptionPublicKey',
    'eth_getFilterChanges',
    'eth_getFilterLogs',
    'eth_getLogs',
    'eth_getProof',
    'eth_getStorageAt',
    'eth_getTransactionByBlockHashAndIndex',
    'eth_getTransactionByBlockNumberAndIndex',
    'eth_getTransactionByHash',
    'eth_getTransactionCount',
    'eth_getTransactionReceipt',
    'eth_getUncleByBlockHashAndIndex',
    'eth_getUncleByBlockNumberAndIndex',
    'eth_getUncleCountByBlockHash',
    'eth_getUncleCountByBlockNumber',
    'eth_getWork',
    'eth_hashrate',
    'eth_mining',
    'eth_newBlockFilter',
    'eth_newFilter',
    'eth_newPendingTransactionFilter',
    'eth_protocolVersion',
    'eth_sendRawTransaction',
    'eth_sendTransaction',
    // 'eth_sign',
    'eth_signTypedData',
    'eth_signTypedData_v1',
    'eth_signTypedData_v3',
    'eth_signTypedData_v4',
    'eth_submitHashrate',
    'eth_submitWork',
    'eth_syncing',
    'eth_uninstallFilter',
    'chilly_getProviderState',
    // 'net_listening',
    // 'net_peerCount',
    // 'net_version',
    'personal_ecRecover',
    'personal_sign',
    // 'wallet_watchAsset',
    'wallet_switchEthereumChain',
    'wallet_getCapabilities',
    'wallet_sendCalls',
    'wallet_getCallsStatus',
    'wallet_showCallsStatus',
    'web3_clientVersion',
    // 'web3_sha3',
]);
