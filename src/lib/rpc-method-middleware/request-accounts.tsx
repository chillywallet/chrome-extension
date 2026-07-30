import { ethErrors } from 'eth-rpc-errors';
import { MESSAGE_TYPE } from '../../shared/constants/app';

/**
 * This method attempts to retrieve the Ethereum accounts available to the
 * requester, or initiate a request for account access if none are currently
 * available. It is essentially a wrapper of wallet_requestPermissions that
 * only errors if the user rejects the request. We maintain the method for
 * backwards compatibility reasons.
 */

const requestEthereumAccounts = {
    methodNames: [MESSAGE_TYPE.ETH_REQUEST_ACCOUNTS],
    implementation: requestEthereumAccountsHandler,
    hookNames: {
        origin: true,
        getAccounts: true,
        getUnlockPromise: true,
        hasPermission: true,
        requestAccountsPermission: true,
    },
};
export default requestEthereumAccounts;

// Used to rate-limit pending requests to one per origin
const locks = new Set();

async function requestEthereumAccountsHandler(
    _req: any,
    res: any,
    _next: Function,
    end: Function,
    {
        origin,
        getAccounts,
        getUnlockPromise,
        hasPermission,
        requestAccountsPermission,
    }: {
        origin: string;
        getAccounts: Function;
        getUnlockPromise: Function;
        hasPermission: Function;
        requestAccountsPermission: Function;
    },
) {
    if (locks.has(origin)) {
        res.error = ethErrors.rpc.resourceUnavailable(
            `Already processing ${MESSAGE_TYPE.ETH_REQUEST_ACCOUNTS}. Please wait.`,
        );
        return end();
    }

    if (hasPermission(MESSAGE_TYPE.ETH_ACCOUNTS)) {
        // We wait for the extension to unlock in this case only, because permission
        // requests are handled when the extension is unlocked, regardless of the
        // lock state when they were received.
        try {
            locks.add(origin);
            await getUnlockPromise();
            res.result = await getAccounts();
            end();
        } catch (error) {
            end(error);
        } finally {
            locks.delete(origin);
        }
        return undefined;
    }

    // If no accounts, request the accounts permission
    try {
        await requestAccountsPermission();
    } catch (err) {
        res.error = err;
        return end();
    }

    // Get the approved accounts
    const accounts = await getAccounts();

    if (accounts.length > 0) {
        res.result = accounts;
    } else {
        // This should never happen, because it should be caught in the
        // above catch clause
        res.error = ethErrors.rpc.internal(
            'Accounts unexpectedly unavailable. Please report this bug.',
        );
    }

    return end();
}
