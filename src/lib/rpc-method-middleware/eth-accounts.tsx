/**
 * A wrapper for `eth_accounts` that returns an empty array when permission is denied.
 */

import { MESSAGE_TYPE } from '../../shared/constants/app';

const requestEthereumAccounts = {
    methodNames: [MESSAGE_TYPE.ETH_ACCOUNTS],
    implementation: ethAccountsHandler,
    hookNames: {
        getAccounts: true,
    },
};
export default requestEthereumAccounts;

async function ethAccountsHandler(
    _req: any,
    res: any,
    _next: Function,
    end: Function,
    { getAccounts }: { getAccounts: Function },
) {
    res.result = await getAccounts();
    return end();
}
