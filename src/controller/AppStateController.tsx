import { RestrictedControllerMessenger } from '@metamask/base-controller';
import { ApprovalType } from '@metamask/controller-utils';
import { ObservableStore } from '@metamask/obs-store';
import { v4 as uuid } from 'uuid';
import { ORIGIN_CHILLY } from '../shared/constants/app';
import logger from '../shared/utils/logger';
import { AcceptRequest, AddApprovalRequest } from './ApprovalController';

const controllerName = 'AppStateController';

export type AppStateControllerState = {
    currentPopupId?: number;
};

const defaultState: AppStateControllerState = {};

export type AllowedActions = AddApprovalRequest | AcceptRequest;

export type AppStateControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    AllowedActions,
    any,
    AllowedActions['type'],
    any
>;

type Props = {
    state: AppStateControllerState;
    messenger: AppStateControllerMessenger;
    isUnlocked: () => boolean;
};

export default class AppStateController {
    store: ObservableStore<AppStateControllerState>;
    messagingSystem: AppStateControllerMessenger;
    _approvalRequestId: string = '';
    waitingForUnlock: Function[] = [];
    isUnlocked: () => boolean;

    constructor(opts: Props) {
        const initState = {
            ...defaultState,
            ...opts.state,
        };

        this.store = new ObservableStore(initState);
        this.messagingSystem = opts.messenger;
        this.isUnlocked = opts.isUnlocked;
    }

    /**
     * A setter for the currentPopupId which indicates the id of popup window that's currently active
     *
     * @param currentPopupId
     */
    setCurrentPopupId(currentPopupId?: number) {
        this.store.updateState({
            currentPopupId,
        });
    }

    /**
     * A getter to retrieve currentPopupId saved in the appState
     */
    getCurrentPopupId() {
        return this.store.getState().currentPopupId;
    }

    /**
     * Get a Promise that resolves when the extension is unlocked.
     */
    async getUnlockPromise() {
        return new Promise<void>(resolve => {
            if (this.isUnlocked()) {
                resolve();
            } else {
                this.waitingForUnlock.push(resolve);
                this._requestApproval();
            }
        });
    }

    /**
     * Drains the waitingForUnlock queue, resolving all the related Promises.
     */
    handleUnlock() {
        if (this.waitingForUnlock.length > 0) {
            while (this.waitingForUnlock.length > 0) {
                const resolve = this.waitingForUnlock.shift();
                resolve && resolve();
            }
        }

        this._acceptApproval();
    }

    _requestApproval() {
        // If we already have a pending request this is a no-op
        if (this._approvalRequestId) {
            return;
        }

        this._approvalRequestId = uuid();

        this.messagingSystem
            .call(
                'ApprovalController:addRequest',
                {
                    id: this._approvalRequestId,
                    origin: ORIGIN_CHILLY,
                    type: ApprovalType.Unlock,
                },
                true,
            )
            .catch(() => {
                // If the promise fails, we allow a new popup to be triggered
                this._approvalRequestId = '';
            });
    }

    _acceptApproval() {
        if (!this._approvalRequestId) {
            return;
        }
        try {
            this.messagingSystem.call('ApprovalController:acceptRequest', this._approvalRequestId);
        } catch (error) {
            logger.error('Failed to unlock approval request', error);
        }

        this._approvalRequestId = '';
    }
}
