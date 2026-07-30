import { MESSAGE_TYPE } from '../../shared/constants/app';
import ethAccounts from './eth-accounts';
import getProviderState from './get-provider-state';
import requestAccounts from './request-accounts';
import sendMetadata from './send-metadata';
import switchEthereumChain from './switch-ethereum-chain';
import addCustomRpc from './add-custom-rpc';
import eip5792 from './eip5792';

type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

type HandlerInterface = {
    methodNames: MessageType[];
    implementation: unknown;
    hookNames?: { [key: string]: boolean };
};

const handlers: HandlerInterface[] = [
    ethAccounts,
    sendMetadata,
    getProviderState,
    requestAccounts,
    switchEthereumChain,
    addCustomRpc,
    eip5792,
];

export default handlers;
