import { ApprovalType } from '@metamask/controller-utils';
import { ethErrors } from 'eth-rpc-errors';
import { omit } from 'lodash';
import { MESSAGE_TYPE } from '../../shared/constants/app';
import { ChainData } from '../../shared/types/Chain';
import { isPrefixedFormattedHexString, isSafeChainId } from '../../shared/utils/utils';
import { getCurrentChainByChainId } from '../ChainsUtils';
import { hexToNumber } from '../web3';

const switchEthereumChain = {
    methodNames: [MESSAGE_TYPE.SWITCH_ETHEREUM_CHAIN],
    implementation: switchEthereumChainHandler,
    hookNames: {
        getCurrentChain: true,
        requestUserApproval: true,
        setSelectedNetwork: true,
        isSenderActiveBrowserTab: true,
    },
};

export default switchEthereumChain;

async function switchEthereumChainHandler(
    req: any,
    res: any,
    _next: Function,
    end: Function,
    {
        getCurrentChain,
        requestUserApproval,
        setSelectedNetwork,
        isSenderActiveBrowserTab,
    }: {
        getCurrentChain: Function;
        requestUserApproval: Function;
        setSelectedNetwork: (chainId: number) => void;
        isSenderActiveBrowserTab: (tabId: unknown, origin: string) => Promise<boolean>;
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

    const { origin } = req;

    const { chainId } = req.params[0];

    const otherKeys = Object.keys(omit(req.params[0], ['chainId']));

    if (otherKeys.length > 0) {
        return end(
            ethErrors.rpc.invalidParams({
                message: `Received unexpected keys on object parameter. Unsupported keys:\n${otherKeys}`,
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
    const chain = getCurrentChainByChainId(chainIdNum);

    if (!chain) {
        return end(
            ethErrors.provider.custom({
                code: 4902,
                message: `Unrecognized chain ID "${chainId}".`,
            }),
        );
    }

    const currentChain: ChainData = getCurrentChain();

    if (currentChain.chain_id === chain.chain_id) {
        res.result = null;
        return end();
    }

    if (!(await isSenderActiveBrowserTab(req.tabId, origin))) {
        return end(
            ethErrors.rpc.invalidRequest({
                message: `${MESSAGE_TYPE.SWITCH_ETHEREUM_CHAIN} can only request approval when the requesting site is open in the active browser tab.`,
            }),
        );
    }

    try {
        await requestUserApproval({
            origin,
            type: ApprovalType.SwitchEthereumChain,
            requestData: { chain },
        });

        await setSelectedNetwork(chain.chain_id);

        res.result = null;
        return end();
    } catch (error) {
        return end(error);
    }
}
