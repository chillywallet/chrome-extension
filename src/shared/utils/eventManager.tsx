import { formatNumber } from './format';
import Toast from '../../ui/components/Toast';
import EventType from '../types/EventType';
import { AlertModalData } from '../types/Global';
import { ChillyAccount, ChillyWallet } from '../types/Wallet';

/* eslint-disable import/no-anonymous-default-export */
export default {
    list: new Map<string, any>(),

    emit(event: any, ...args: any) {
        if (!this.list.has(event)) {
            return false;
        }
        this.list
            .get(event)
            .forEach((callback: Function) => setTimeout(() => callback.call(null, ...args), 0));

        return true;
    },

    on(event: any, callback: any) {
        if (!this.list.has(event)) {
            this.list.set(event, []);
        }

        this.list.get(event).push(callback);

        return this;
    },

    off(event: any, callback: any) {
        if (!this.list.has(event)) {
            return;
        }
        const callbackList: Function[] = [];
        this.list.get(event).forEach((cb: Function) => {
            if (cb !== callback) {
                callbackList.push(cb);
            }
        });
        this.list.set(event, callbackList);
    },

    reset(event: any) {
        this.list.delete(event);
        return this;
    },

    showAlertModal(alertData: AlertModalData) {
        this.emit(EventType.SHOW_ALERT_MODAL, alertData);
    },

    setTxConfirmationHandling(handling: boolean) {
        this.emit(EventType.SET_CONFIRMATION_HANDLING, handling);
    },

    showSeedPhraseModal(wallet: ChillyWallet) {
        this.emit(EventType.SHOW_SEED_PHRASE_MODAL, wallet);
    },

    showPrivateKeyModal(account: ChillyAccount) {
        this.emit(EventType.SHOW_PRIVATE_KEY_MODAL, account);
    },

    showWalletAddressModal(params: {
        account?: ChillyAccount;
        isSmartWallet?: boolean;
        walletAddress?: string;
    }) {
        this.emit(EventType.SHOW_WALLET_ADDRESS_MODAL, params);
    },

    showAddCustomCoinModal(walletAddress: string) {
        this.emit(EventType.SHOW_ADD_CUSTOM_COIN_MODAL, walletAddress);
    },

    showCelebration(point?: number) {
        if (point) {
            const formattedPoint = formatNumber(point);
            Toast.showSuccess(`Congrats! You just earned ${formattedPoint} karma points!`);
        }
    },
};
