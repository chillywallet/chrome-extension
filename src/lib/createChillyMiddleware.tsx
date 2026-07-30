import { JsonRpcMiddleware, createScaffoldMiddleware, mergeMiddleware } from 'json-rpc-engine';
import { WalletMiddlewareOptions, createWalletMiddleware } from './createWalletMiddleware';

export default function createChillyMiddleware({
    version,
    getAccounts,
    processTransaction,
    processTypedMessage,
    processTypedMessageV3,
    processTypedMessageV4,
    processPersonalMessage,
    getUnlockPromise,
}: WalletMiddlewareOptions & {
    version: string;
}) {
    const chillyMiddleware = mergeMiddleware([
        createScaffoldMiddleware({
            eth_syncing: false,
            web3_clientVersion: `Chilly/v${version}`,
        }),
        createWalletMiddleware({
            getAccounts,
            processTransaction,
            processTypedMessage,
            processTypedMessageV3,
            processTypedMessageV4,
            processPersonalMessage,
            getUnlockPromise,
        }) as JsonRpcMiddleware<unknown, unknown>,
    ]);
    return chillyMiddleware;
}
