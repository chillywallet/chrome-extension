import { ethErrors } from 'eth-rpc-errors';
import { MESSAGE_TYPE } from '../../shared/constants/app';
import { ChainData } from '../../shared/types/Chain';
import { isPrefixedFormattedHexString, isSafeChainId } from '../../shared/utils/utils';
import { getCurrentChains } from '../ChainsUtils';
import { hexToNumber } from '../web3';

const WHITELISTED_RPC_DOMAINS =
    process.env.BUILD_TYPE !== 'Prod'
        ? ['localhost', 'virtual.rpc.tenderly.co', 'virtual.monad.eu.rpc.tenderly.co']
        : [];

const addCustomRpc = {
    methodNames: [MESSAGE_TYPE.ADD_CUSTOM_RPC],
    implementation: addCustomRpcHandler,
    hookNames: {
        getCurrentChain: true,
        setCustomNetworks: true,
    },
};

export default addCustomRpc;

async function addCustomRpcHandler(
    req: any,
    res: any,
    _next: Function,
    end: Function,
    {
        getCurrentChain,
        setCustomNetworks,
    }: {
        getCurrentChain: () => ChainData;
        setCustomNetworks: (chainId: number, rpcUrl: string) => Promise<void>;
    },
) {
    if (!req.params?.[0] || typeof req.params[0] !== 'object') {
        return end(
            ethErrors.rpc.invalidParams({
                message: `Expected single, object parameter. Received:\n${JSON.stringify(
                    req.params,
                )}`,
            }),
        );
    }

    const { chainId, rpcUrl } = req.params[0];

    if (!rpcUrl || typeof rpcUrl !== 'string') {
        return end(
            ethErrors.rpc.invalidParams({
                message: `Invalid or missing 'rpcUrl'.`,
            }),
        );
    }

    // Basic whitelist check
    try {
        const urlObj = new URL(rpcUrl);
        const host = urlObj.hostname.toLowerCase();
        const allowed = WHITELISTED_RPC_DOMAINS.some(domain => host.endsWith(domain));

        if (!allowed) {
            return end(
                ethErrors.rpc.invalidParams({
                    message: `The RPC URL domain is not allowed. Please use a trusted RPC provider.`,
                }),
            );
        }
    } catch {
        return end(
            ethErrors.rpc.invalidParams({
                message: `Invalid RPC URL format.`,
            }),
        );
    }

    const _chainId = typeof chainId === 'string' ? chainId.toLowerCase() : '';

    if (!isPrefixedFormattedHexString(_chainId)) {
        return end(
            ethErrors.rpc.invalidParams({
                message: `Expected 0x-prefixed, unpadded, non-zero hexadecimal string 'chainId'. Received:\n${chainId}`,
            }),
        );
    }

    if (!isSafeChainId(parseInt(_chainId, 16))) {
        return end(
            ethErrors.rpc.invalidParams({
                message: `Invalid chain ID "${_chainId}": numerical value greater than max safe value. Received:\n${chainId}`,
            }),
        );
    }

    const chainIdNum = hexToNumber(chainId);
    const chains = getCurrentChains();
    const targetChain = chains.find((c: ChainData) => c.chain_id === chainIdNum);

    if (!targetChain) {
        return end(
            ethErrors.provider.custom({
                code: 4902,
                message: `Unrecognized chain ID "${chainId}".`,
            }),
        );
    }

    const currentChain = getCurrentChain();

    if (currentChain.chain_id !== targetChain.chain_id) {
        return end(
            ethErrors.rpc.invalidParams({
                message:
                    'The chainId does not match the currently selected network. Please verify and try again.',
            }),
        );
    }

    try {
        await setCustomNetworks(targetChain.chain_id, rpcUrl);

        res.result = null;
        return end();
    } catch (error: any) {
        return end(
            ethErrors.provider.custom({
                code: 4001,
                message: error?.message || 'Failed to add custom RPC.',
            }),
        );
    }
}
