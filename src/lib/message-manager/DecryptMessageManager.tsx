import { ApprovalType } from '@metamask/controller-utils';

import type {
    AbstractMessage,
    AbstractMessageParams,
    AbstractMessageParamsInternal,
    OriginalRequest,
} from './AbstractMessageManager';
import { AbstractMessageManager } from './AbstractMessageManager';
import { normalizeMessageData, validateDecryptedMessageData } from './utils';

/**
 * @type DecryptMessage
 *
 * Represents and contains data about a 'eth_decrypt' type signature request.
 * These are created when a signature for an eth_decrypt call is requested.
 * @property id - An id to track and identify the message object
 * @property messageParams - The parameters to pass to the eth_decrypt method once the request is approved
 * @property type - The json-prc signing method for which a signature request has been made.
 * A 'DecryptMessage' which always has a 'eth_decrypt' type
 */
// This interface was created before this ESLint rule was added.
// Convert to a `type` in a future major version.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface DecryptMessage extends AbstractMessage {
    messageParams: DecryptMessageParams;
}

/**
 * @type DecryptMessageParams
 *
 * Represents the parameters to pass to the eth_decrypt method once the request is approved.
 * @property data - A hex string conversion of the raw buffer data of the signature request
 */
// This interface was created before this ESLint rule was added.
// Convert to a `type` in a future major version.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface DecryptMessageParams extends AbstractMessageParams {
    data: string;
}

/**
 * @type DecryptMessageParamsInternal
 *
 * Represents the parameters to pass to the eth_decrypt method once the request is approved
 * plus data added by Chilly.
 * @property internalId - Added for tracking and identification within Chilly
 * @property data - A hex string conversion of the raw buffer data of the signature request
 * @property from - Address to sign this message from
 * @property origin? - Added for request origin identification
 */
// This interface was created before this ESLint rule was added.
// Convert to a `type` in a future major version.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface DecryptMessageParamsInternal extends AbstractMessageParamsInternal {
    data: string;
}

/**
 * Controller in charge of managing - storing, adding, removing, updating - DecryptMessages.
 */
export class DecryptMessageManager extends AbstractMessageManager<
    DecryptMessage,
    DecryptMessageParams,
    DecryptMessageParamsInternal
> {
    /**
     * Name of this controller used during composition
     */
    override name = 'DecryptMessageManager' as const;

    /**
     * Creates a new Message with an 'unapproved' status using the passed messageParams.
     * this.addMessage is called to add the new Message to this.messages, and to save the unapproved Messages.
     *
     * @param messageParams - The params for the personal_sign call to be made after the message is approved.
     * @param req - The original request object possibly containing the origin.
     * @returns Promise resolving to the raw data of the signature request.
     */
    async addUnapprovedMessageAsync(
        messageParams: DecryptMessageParams,
        req?: OriginalRequest,
    ): Promise<string> {
        validateDecryptedMessageData(messageParams);
        const messageId = await this.addUnapprovedMessage(messageParams, req);

        return new Promise((resolve, reject) => {
            this.hub.once(`${messageId}:finished`, (data: DecryptMessage) => {
                switch (data.status) {
                    case 'decrypted':
                        return resolve(data.rawSig as string);
                    case 'rejected':
                        return reject(
                            new Error('Chilly DecryptMessage: User denied message decryption.'),
                        );
                    case 'errored':
                        return reject(
                            new Error('Chilly DecryptMessage: This message cannot be decrypted.'),
                        );
                    default:
                        return reject(
                            new Error(
                                `Chilly DecryptMessage: Unknown problem: ${JSON.stringify(
                                    messageParams,
                                )}`,
                            ),
                        );
                }
            });
        });
    }

    /**
     * Creates a new Message with an 'unapproved' status using the passed messageParams.
     * this.addMessage is called to add the new Message to this.messages, and to save the
     * unapproved Messages.
     *
     * @param messageParams - The params for the personal_sign call to be made after the message
     * is approved.
     * @param req - The original request object possibly containing the origin.
     * @returns The id of the newly created message.
     */
    async addUnapprovedMessage(messageParams: DecryptMessageParams, req?: OriginalRequest) {
        const updatedMessageParams = this.addRequestToMessageParams(
            messageParams,
            req,
        ) satisfies DecryptMessageParams;
        messageParams.data = normalizeMessageData(messageParams.data);

        const messageData = this.createUnapprovedMessage(
            updatedMessageParams,
            ApprovalType.EthDecrypt,
            req,
        ) satisfies DecryptMessage;

        const messageId = messageData.id;

        await this.addMessage(messageData);
        this.hub.emit(`unapprovedMessage`, {
            ...updatedMessageParams,
            internalId: messageId,
        });
        return messageId;
    }

    /**
     * Removes the internalId property from passed messageParams and returns a promise which
     * resolves the updated messageParams.
     *
     * @param messageParams - The messageParams to modify.
     * @returns Promise resolving to the messageParams with the internalId property removed.
     */
    prepMessageForSigning(messageParams: DecryptMessageParamsInternal): Promise<DecryptMessageParams> {
        delete messageParams.internalId;
        return Promise.resolve(messageParams);
    }
}
