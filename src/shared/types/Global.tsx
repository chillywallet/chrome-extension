import { EarnListItem } from './Earn';

declare class MessageSender {
    documentId?: string;

    documentLivecycle?: string;

    frameId?: number;

    id?: string;

    origin?: string;

    url?: string;
}

/**
 * Defines an overloaded set of function call signatures for the chrome
 * runtime sendMessage function. Each of these are overloaded by specific
 * input values so that the correct type can be inferred in the callback
 * method
 */
type sendMessage = {
    (
        extensionId: string,
        message: Record<string, unknown>,
        options?: Record<string, unknown>,
        callback?: (response: Record<string, unknown>) => void,
    ): void;
    (
        // TODO: Replace `any` with type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: any,
        options?: Record<string, unknown>,
        callback?: (response: Record<string, unknown>) => void,
    ): void;
    (message: Record<string, unknown>, callback?: (response: ResponseType) => void): void;
};

declare class Runtime {
    onMessage: {
        addListener: (
            callback: (
                // TODO: Replace `any` with type
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                message: any,
                sender: MessageSender,
                sendResponse: (response?: ResponseType) => void,
            ) => void,
        ) => void;
    };

    sendMessage: sendMessage;
}

export declare class Chrome {
    runtime: Runtime;
}

export type AlertButton = {
    name: string;
    type?: 'cancel' | 'primary';
    onPress?: Function;
};

export type AlertModalData = {
    title?: string;
    message?: string;
    buttons?: AlertButton[];
    closable?: boolean;
    isHtml?: boolean;
};

export type GasPriceSetting = {
    chain_id: number;
    name: string;
    type: 'default' | 'custom';
    url_pattern?: string;
    customPriorityFee?: {
        low?: string;
        medium?: string;
        high?: string;
    };
    customGasPrice?: {
        low?: string;
        medium?: string;
        high?: string;
    };
};

export type RemoteData = {
    enableCluster: boolean;
    enableAllDomains: boolean;
    enableChangeIcon: boolean;
    nnsMetadata: {
        label?: string;
        chain_id?: number;
    };
    gasPrice: GasPriceSetting[];
    addCustomNFTEnabled: boolean;
    earnEnabled: boolean;
    buyEnabled: boolean;
    sellEnabled: boolean;
    earnList: EarnListItem[];
    bridgeUrl: string;
    defaultChainId: number;
    rpcUrls: { [chain_id: string]: string };
};

export enum NotificationType {
    /** noti_type */
    nft_collection_alert = 'nft_collection_alert',
    nft_price_alert = 'nft_price_alert',
    nft_custom_alert = 'nft_custom_alert',
    price_alert = 'price_alert',
    portfolio_alert = 'portfolio_alert',
    article = 'article',
    transactions = 'transactions',
    karma = 'karma',
    referral = 'referral',
    custom_karma = 'custom_karma',
    task_karma = 'task_karma',
    quest_completed = 'quest_completed',

    /** type */
    quests = 'quests',
}
