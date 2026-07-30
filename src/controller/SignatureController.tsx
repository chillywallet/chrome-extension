import type {
    ControllerGetStateAction,
    ControllerStateChangeEvent,
    RestrictedControllerMessenger,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import { ApprovalType } from '@metamask/controller-utils';
import { providerErrors } from '@metamask/rpc-errors';
import { add0x, type Hex, type Json } from '@metamask/utils';
import EventEmitter from 'events';
import { cloneDeep } from 'lodash';
import { getCurrentChainByChainId } from '../lib/ChainsUtils';
import type {
    AbstractMessage,
    AbstractMessageManager,
    AbstractMessageParams,
    AbstractMessageParamsInternal,
    MessageManagerState,
    OriginalRequest,
    PersonalMessage,
    PersonalMessageParams,
    PersonalMessageParamsInternal,
    TypedMessage,
    TypedMessageParams,
    TypedMessageParamsInternal,
} from '../lib/message-manager';
import { PersonalMessageManager, TypedMessageManager } from '../lib/message-manager';
import { ORIGIN_CHILLY } from '../shared/constants/app';
import { ChainData } from '../shared/types/Chain';
import { ChillyAccount } from '../shared/types/Wallet';
import type { AcceptResultCallbacks, AddApprovalRequest, AddResult } from './ApprovalController';
import type {
    KeyringControllerSignMessageAction,
    KeyringControllerSignPersonalMessageAction,
    KeyringControllerSignTypedMessageAction,
    SignTypedDataVersion,
} from './KeyringController';

const controllerName = 'SignatureController';

const stateMetadata = {
    unapprovedPersonalMsgs: { persist: false, anonymous: false },
    unapprovedTypedMessages: { persist: false, anonymous: false },
    unapprovedPersonalMsgCount: { persist: false, anonymous: false },
    unapprovedTypedMessagesCount: { persist: false, anonymous: false },
};

const getDefaultState = () => ({
    unapprovedPersonalMsgs: {},
    unapprovedTypedMessages: {},
    unapprovedPersonalMsgCount: 0,
    unapprovedTypedMessagesCount: 0,
});

export type CoreMessage = AbstractMessage & {
    messageParams: AbstractMessageParams;
};

export type StateMessage = Required<AbstractMessage> & {
    msgParams: Required<AbstractMessageParams>;
};

export type SignatureControllerState = {
    unapprovedPersonalMsgs: Record<string, StateMessage>;
    unapprovedTypedMessages: Record<string, StateMessage>;
    unapprovedPersonalMsgCount: number;
    unapprovedTypedMessagesCount: number;
};

type AllowedActions =
    | AddApprovalRequest
    | KeyringControllerSignMessageAction
    | KeyringControllerSignPersonalMessageAction
    | KeyringControllerSignTypedMessageAction;

type TypedMessageSigningOptions = {
    parseJsonData: boolean;
};

export type GetSignatureState = ControllerGetStateAction<
    typeof controllerName,
    SignatureControllerState
>;

export type SignatureStateChange = ControllerStateChangeEvent<
    typeof controllerName,
    SignatureControllerState
>;

export type SignatureControllerActions = GetSignatureState;

export type SignatureControllerEvents = SignatureStateChange;

export type SignatureControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    SignatureControllerActions | AllowedActions,
    SignatureControllerEvents,
    AllowedActions['type'],
    never
>;

export type SignatureControllerOptions = {
    messenger: SignatureControllerMessenger;
    getCurrentChainId: () => Hex;
    getAccountBySmartAddress: (address: string) => ChillyAccount | undefined;
    getPrivateKey: (address: string) => Promise<string>;
    getSelectedNetwork: () => ChainData;
};

/**
 * Controller for creating signing requests requiring user approval.
 */
export class SignatureController extends BaseController<
    typeof controllerName,
    SignatureControllerState,
    SignatureControllerMessenger
> {
    hub: EventEmitter;

    #personalMessageManager: PersonalMessageManager;

    #typedMessageManager: TypedMessageManager;

    #getAccountBySmartAddress: (address: string) => ChillyAccount | undefined;

    #getPrivateKey: (address: string) => Promise<string>;

    #getSelectedNetwork: () => ChainData;

    /**
     * Construct a Sign controller.
     *
     * @param options - The controller options.
     * @param options.messenger - The restricted controller messenger for the sign controller.
     * @param options.getCurrentChainId - A function for retrieving the current chainId.
     * @param options.getAccountByAddress - A function for retrieving the account by address.
     */
    constructor({
        messenger,
        getCurrentChainId,
        getAccountBySmartAddress,
        getPrivateKey,
        getSelectedNetwork,
    }: SignatureControllerOptions) {
        super({
            name: controllerName,
            metadata: stateMetadata,
            messenger,
            state: getDefaultState(),
        });

        this.hub = new EventEmitter();
        this.#personalMessageManager = new PersonalMessageManager(undefined, undefined);
        this.#typedMessageManager = new TypedMessageManager(
            undefined,
            undefined,
            undefined,
            undefined,
            getCurrentChainId,
        );
        this.#getAccountBySmartAddress = getAccountBySmartAddress;
        this.#getPrivateKey = getPrivateKey;
        this.#getSelectedNetwork = getSelectedNetwork;

        this.#handleMessageManagerEvents(this.#personalMessageManager, 'unapprovedPersonalMessage');
        this.#handleMessageManagerEvents(this.#typedMessageManager, 'unapprovedTypedMessage');

        this.#subscribeToMessageState(
            this.#personalMessageManager,
            (state, newMessages, messageCount) => {
                state.unapprovedPersonalMsgs = newMessages;
                state.unapprovedPersonalMsgCount = messageCount;
            },
        );

        this.#subscribeToMessageState(
            this.#typedMessageManager,
            (state, newMessages, messageCount) => {
                state.unapprovedTypedMessages = newMessages;
                state.unapprovedTypedMessagesCount = messageCount;
            },
        );
    }

    /**
     * A getter for the number of 'unapproved' PersonalMessages in this.messages.
     *
     * @returns The number of 'unapproved' PersonalMessages in this.messages
     */
    get unapprovedPersonalMessagesCount(): number {
        return this.#personalMessageManager.getUnapprovedMessagesCount();
    }

    /**
     * A getter for the number of 'unapproved' TypedMessages in this.messages.
     *
     * @returns The number of 'unapproved' TypedMessages in this.messages
     */
    get unapprovedTypedMessagesCount(): number {
        return this.#typedMessageManager.getUnapprovedMessagesCount();
    }

    /**
     * A getter for returning all messages.
     *
     * @returns The object containing all messages.
     */
    get messages(): { [id: string]: PersonalMessage | TypedMessage } {
        const messages = [
            ...this.#typedMessageManager.getAllMessages(),
            ...this.#personalMessageManager.getAllMessages(),
        ];

        const messagesObject = messages.reduce<{
            [id: string]: PersonalMessage | TypedMessage;
        }>((acc, message) => {
            acc[message.id] = message;
            return acc;
        }, {});

        return messagesObject;
    }

    /**
     * Reset the controller state to the initial state.
     */
    resetState() {
        this.update(() => getDefaultState());
    }

    /**
     * Reject all unapproved messages of any type.
     *
     * @param reason - A message to indicate why.
     */
    rejectUnapproved(reason?: string) {
        this.#rejectUnapproved(this.#personalMessageManager, reason);
        this.#rejectUnapproved(this.#typedMessageManager, reason);
    }

    /**
     * Clears all unapproved messages from memory.
     */
    clearUnapproved() {
        this.#clearUnapproved(this.#personalMessageManager);
        this.#clearUnapproved(this.#typedMessageManager);
    }

    /**
     * Called when a dapp uses the personal_sign method.
     *
     * We currently define personal_sign mostly for legacy Dapps.
     *
     * @param messageParams - The params of the message to sign & return to the Dapp.
     * @param req - The original request, containing the origin.
     * @returns Promise resolving to the raw data of the signature request.
     */
    async newUnsignedPersonalMessage(
        messageParams: PersonalMessageParams,
        req: OriginalRequest,
    ): Promise<string> {
        return this.#newUnsignedAbstractMessage(
            this.#personalMessageManager,
            ApprovalType.PersonalSign,
            'Personal Message',
            // TODO: Either fix this lint violation or explain why it's necessary to ignore.
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            this.#signPersonalMessage.bind(this),
            messageParams,
            req,
        );
    }

    /**
     * Called when a dapp uses the eth_signTypedData method, per EIP 712.
     *
     * @param messageParams - The params passed to eth_signTypedData.
     * @param req - The original request, containing the origin.
     * @param version - The version indicating the format of the typed data.
     * @param signingOpts - An options bag for signing.
     * @param signingOpts.parseJsonData - Whether to parse the JSON before signing.
     * @returns Promise resolving to the raw data of the signature request.
     */
    async newUnsignedTypedMessage(
        messageParams: TypedMessageParams,
        req: OriginalRequest,
        version: string,
        signingOpts: TypedMessageSigningOptions,
    ): Promise<string> {
        return this.#newUnsignedAbstractMessage(
            this.#typedMessageManager,
            ApprovalType.EthSignTypedData,
            'Typed Message',
            // TODO: Either fix this lint violation or explain why it's necessary to ignore.
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            this.#signTypedMessage.bind(this),
            messageParams,
            req,
            version,
            signingOpts,
        );
    }

    /**
     * Called to update the message status as signed.
     *
     * @param messageId - The id of the Message to update.
     * @param signature - The data to update the message with.
     */
    // TODO: Replace `any` with type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDeferredSignSuccess(messageId: string, signature: any) {
        this.#tryForEachMessageManager(this.#trySetDeferredSignSuccess, messageId, signature);
    }

    /**
     * Called when the message metadata needs to be updated.
     *
     * @param messageId - The id of the message to update.
     * @param metadata - The data to update the metadata property in the message.
     */
    setMessageMetadata(messageId: string, metadata: Json) {
        this.#tryForEachMessageManager(this.#trySetMessageMetadata, messageId, metadata);
    }

    /**
     * Called to cancel a signing message.
     *
     * @param messageId - The id of the Message to update.
     */
    setDeferredSignError(messageId: string) {
        this.#tryForEachMessageManager(this.#trySetDeferredSignError, messageId);
    }

    setTypedMessageInProgress(messageId: string) {
        this.#typedMessageManager.setMessageStatusInProgress(messageId);
    }

    setPersonalMessageInProgress(messageId: string) {
        this.#personalMessageManager.setMessageStatusInProgress(messageId);
    }

    async #newUnsignedAbstractMessage<
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        M extends AbstractMessage,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        P extends AbstractMessageParams,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PM extends AbstractMessageParamsInternal,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SO,
    >(
        messageManager: AbstractMessageManager<M, P, PM>,
        approvalType: ApprovalType,
        messageName: string,
        signMessage: (messageParams: PM, signingOpts?: SO) => void,
        messageParams: PM,
        req: OriginalRequest,
        version?: string,
        signingOpts?: SO,
    ) {
        let resultCallbacks: AcceptResultCallbacks | undefined;
        try {
            const messageId = await messageManager.addUnapprovedMessage(
                messageParams,
                req,
                version,
            );

            const messageParamsWithId = {
                ...messageParams,
                internalId: messageId,
                ...(version && { version }),
            };

            const signaturePromise = messageManager.waitForFinishStatus(
                messageParamsWithId,
                messageName,
            );

            try {
                const acceptResult = await this.#requestApproval(messageParamsWithId, approvalType);

                resultCallbacks = acceptResult.resultCallbacks;
            } catch {
                this.#cancelAbstractMessage(messageManager, messageId);
                throw providerErrors.userRejectedRequest('User rejected the request.');
            }

            // TODO: Either fix this lint violation or explain why it's necessary to ignore.
            // eslint-disable-next-line @typescript-eslint/await-thenable
            await signMessage(messageParamsWithId, signingOpts);

            const signatureResult = await signaturePromise;

            /* istanbul ignore next */
            resultCallbacks?.success(signatureResult);

            return signatureResult;
        } catch (error) {
            resultCallbacks?.error(error as Error);
            throw error;
        }
    }

    /**
     * Signifies a user's approval to sign a personal_sign message in queue.
     * Triggers signing, and the callback function from newUnsignedPersonalMessage.
     *
     * @param msgParams - The params of the message to sign & return to the Dapp.
     * @returns Signature result from signing.
     */
    async #signPersonalMessage(msgParams: PersonalMessageParamsInternal) {
        return await this.#signAbstractMessage(
            this.#personalMessageManager,
            ApprovalType.PersonalSign,
            msgParams,
            async (cleanMsgParams, smartWalletData) => {
                return await this.messagingSystem.call(
                    'KeyringController:signPersonalMessage',
                    cleanMsgParams,
                );
            },
        );
    }

    /**
     * The method for a user approving a call to eth_signTypedData, per EIP 712.
     * Triggers the callback in newUnsignedTypedMessage.
     *
     * @param msgParams - The params passed to eth_signTypedData.
     * @param opts - The options for the method.
     * @param opts.parseJsonData - Whether to parse JSON data before calling the KeyringController.
     * @returns Signature result from signing.
     */
    async #signTypedMessage(
        msgParams: TypedMessageParamsInternal,
        /* istanbul ignore next */
        opts = { parseJsonData: true },
        // TODO: Replace `any` with type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        const { version } = msgParams;
        return await this.#signAbstractMessage(
            this.#typedMessageManager,
            ApprovalType.EthSignTypedData,
            msgParams,
            async (cleanMsgParams, smartWalletData) => {
                const finalMessageParams = opts.parseJsonData
                    ? this.#removeJsonData(cleanMsgParams, version as string)
                    : cleanMsgParams;

                return await this.messagingSystem.call(
                    'KeyringController:signTypedMessage',
                    finalMessageParams,
                    version as SignTypedDataVersion,
                );
            },
        );
    }

    #tryForEachMessageManager(
        callbackFn: (
            // TODO: Replace `any` with type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messageManager: AbstractMessageManager<any, any, any>,
            // TODO: Replace `any` with type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...args: any[]
        ) => boolean,
        // TODO: Replace `any` with type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...args: any
    ) {
        const messageManagers = [this.#personalMessageManager, this.#typedMessageManager];

        for (const manager of messageManagers) {
            if (callbackFn(manager, ...args)) {
                return true;
            }
        }
        throw new Error('Message not found');
    }

    #trySetDeferredSignSuccess(
        // TODO: Replace `any` with type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messageManager: AbstractMessageManager<any, any, any>,
        messageId: string,
        // TODO: Replace `any` with type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signature: any,
    ) {
        try {
            messageManager.setMessageStatusSigned(messageId, signature);
            return true;
        } catch (error) {
            return false;
        }
    }

    #trySetMessageMetadata(
        // TODO: Replace `any` with type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messageManager: AbstractMessageManager<any, any, any>,
        messageId: string,
        metadata: Json,
    ) {
        try {
            messageManager.setMetadata(messageId, metadata);
            return true;
        } catch (error) {
            return false;
        }
    }

    #trySetDeferredSignError(
        // TODO: Replace `any` with type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messageManager: AbstractMessageManager<any, any, any>,
        messageId: string,
    ) {
        try {
            messageManager.rejectMessage(messageId);
            return true;
        } catch (error) {
            return false;
        }
    }

    #rejectUnapproved<
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        M extends AbstractMessage,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        P extends AbstractMessageParams,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PM extends AbstractMessageParamsInternal,
    >(messageManager: AbstractMessageManager<M, P, PM>, reason?: string) {
        Object.keys(messageManager.getUnapprovedMessages()).forEach(messageId => {
            this.#cancelAbstractMessage(messageManager, messageId, reason);
        });
    }

    #clearUnapproved<
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        M extends AbstractMessage,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        P extends AbstractMessageParams,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PM extends AbstractMessageParamsInternal,
    >(messageManager: AbstractMessageManager<M, P, PM>) {
        messageManager.update({
            unapprovedMessages: {},
            unapprovedMessagesCount: 0,
        });
    }

    async #signAbstractMessage<
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        M extends AbstractMessage,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        P extends AbstractMessageParams,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PM extends AbstractMessageParamsInternal,
    >(
        messageManager: AbstractMessageManager<M, P, PM>,
        methodName: string,
        msgParams: PM,
        // TODO: Replace `any` with type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getSignature: (
            cleanMessageParams: P,
            smartWalletData?: { privateKey: Hex; chainId: number },
        ) => Promise<any>,
    ) {
        const messageId = msgParams.internalId as string;

        try {
            const cleanMessageParams = await messageManager.approveMessage(msgParams);

            try {
                const chillyAccount = this.#getAccountBySmartAddress(msgParams.from);
                let smartWalletData: { privateKey: Hex; chainId: number } | undefined = undefined;

                if (chillyAccount) {
                    const privateKey = await this.#getPrivateKey(chillyAccount.address);
                    const selectedChain = this.#getSelectedNetwork();
                    smartWalletData = {
                        privateKey: add0x(privateKey),
                        chainId: selectedChain.chain_id,
                    };
                }

                const signature = await getSignature(cleanMessageParams, smartWalletData);

                this.hub.emit(`${methodName}:signed`, { signature, messageId });

                if (!cleanMessageParams.deferSetAsSigned) {
                    messageManager.setMessageStatusSigned(messageId, signature);
                }

                return signature;
            } catch (error) {
                this.hub.emit(`${messageId}:signError`, { error });
                throw error;
            }
            // TODO: Replace `any` with type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            this.#errorMessage(messageManager, messageId, error.message);
            throw error;
        }
    }

    #errorMessage<
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        M extends AbstractMessage,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        P extends AbstractMessageParams,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PM extends AbstractMessageParamsInternal,
    >(messageManager: AbstractMessageManager<M, P, PM>, messageId: string, error: string) {
        if (messageManager instanceof TypedMessageManager) {
            messageManager.setMessageStatusErrored(messageId, error);
        } else {
            this.#cancelAbstractMessage(messageManager, messageId);
        }
    }

    #cancelAbstractMessage<
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        M extends AbstractMessage,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        P extends AbstractMessageParams,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PM extends AbstractMessageParamsInternal,
    >(messageManager: AbstractMessageManager<M, P, PM>, messageId: string, reason?: string) {
        if (reason) {
            const message = this.#getMessage(messageId);
            this.hub.emit('cancelWithReason', { message, reason });
        }
        messageManager.rejectMessage(messageId);
    }

    #handleMessageManagerEvents<
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        M extends AbstractMessage,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        P extends AbstractMessageParams,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PM extends AbstractMessageParamsInternal,
    >(messageManager: AbstractMessageManager<M, P, PM>, eventName: string) {
        messageManager.hub.on('updateBadge', () => {
            this.hub.emit('updateBadge');
        });

        messageManager.hub.on('unapprovedMessage', (msgParams: AbstractMessageParamsInternal) => {
            this.hub.emit(eventName, msgParams);
        });
    }

    #subscribeToMessageState<
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        M extends AbstractMessage,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        P extends AbstractMessageParams,
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PM extends AbstractMessageParamsInternal,
    >(
        messageManager: AbstractMessageManager<M, P, PM>,
        updateState: (
            state: SignatureControllerState,
            newMessages: Record<string, StateMessage>,
            messageCount: number,
        ) => void,
    ) {
        messageManager.subscribe((state: MessageManagerState<AbstractMessage>) => {
            const newMessages = this.#migrateMessages(
                // TODO: Replace `any` with type
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                state.unapprovedMessages as any,
            );

            this.update(() => {
                const newState = { ...this.state };
                updateState(newState, newMessages, state.unapprovedMessagesCount);
                return newState;
            });
        });
    }

    #migrateMessages(coreMessages: Record<string, CoreMessage>): Record<string, StateMessage> {
        const stateMessages: Record<string, StateMessage> = {};

        for (const messageId of Object.keys(coreMessages)) {
            const coreMessage = coreMessages[messageId];
            const stateMessage = this.#migrateMessage(coreMessage);

            stateMessages[messageId] = stateMessage;
        }

        return stateMessages;
    }

    #migrateMessage(coreMessage: CoreMessage): StateMessage {
        const { messageParams, ...coreMessageData } = coreMessage;

        // Core message managers use messageParams but frontend uses msgParams with lots of references
        const stateMessage = {
            ...coreMessageData,
            msgParams: messageParams,
        };

        return stateMessage as StateMessage;
    }

    #getMessage(messageId: string): StateMessage {
        return {
            ...this.state.unapprovedPersonalMsgs,
            ...this.state.unapprovedTypedMessages,
        }[messageId];
    }

    async #requestApproval(
        msgParams: AbstractMessageParamsInternal,
        type: ApprovalType,
    ): Promise<AddResult> {
        const id = msgParams.internalId as string;
        const origin = msgParams.origin || ORIGIN_CHILLY;

        // We are explicitly cloning the message params here to prevent the mutation errors on development mode
        // Because sending it through the messaging system will make the object read only
        const clonedMsgParams = cloneDeep(msgParams);
        return (await this.messagingSystem.call(
            'ApprovalController:addRequest',
            {
                id,
                origin,
                type,
                requestData: clonedMsgParams as Required<AbstractMessageParamsInternal>,
                expectsResult: true,
            },
            true,
        )) as Promise<AddResult>;
    }

    #removeJsonData(messageParams: TypedMessageParams, version: string): TypedMessageParams {
        if (version === 'V1' || typeof messageParams.data !== 'string') {
            return messageParams;
        }

        return {
            ...messageParams,
            data: JSON.parse(messageParams.data),
        };
    }
}
