/**
 * This RPC method gets background state relevant to the provider.
 * The background sends RPC notifications on state changes, but the provider
 * first requests state on initialization.
 */

import { MESSAGE_TYPE } from '../../shared/constants/app';

const getProviderState = {
    methodNames: [MESSAGE_TYPE.GET_PROVIDER_STATE],
    implementation: getProviderStateHandler,
    hookNames: {
        getProviderState: true,
    },
};
export default getProviderState;

async function getProviderStateHandler(
    req: any,
    res: any,
    _next: Function,
    end: Function,
    {
        getProviderState: _getProviderState,
    }: {
        getProviderState: (origin: string) => {
            chainId: string;
            isUnlocked: boolean;
            networkVersion: string;
        };
    },
) {
    res.result = {
        ...(await _getProviderState(req.origin)),
    };
    return end();
}
