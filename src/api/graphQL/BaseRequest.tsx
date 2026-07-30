/* eslint-disable import/no-anonymous-default-export */

import ErrorMessages from '../../shared/messages/ErrorMessages';
import logger from '../../shared/utils/logger';
import Toast from '../../ui/components/Toast';

export const getErrorMessage = (e: any) => {
    let errorMessage: string = e?.message;

    if (e?.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS;
    } else if (e?.reason) {
        errorMessage = e?.reason;
    } else if (e?.response?.data?.message) {
        errorMessage = e?.response?.data?.message;
    } else if (e?.error?.message) {
        errorMessage = e?.error?.message;
    } else if (e?.shortMessage) {
        errorMessage = e?.shortMessage;
    } else if (e?.response?.data?.errors?.length) {
        e.response.data.errors.forEach((item: any, index: number) => {
            if (index === 0) {
                errorMessage = item.message;
            } else {
                errorMessage += '\n' + item.message;
            }
        });
    }

    let message = errorMessage || JSON.stringify(e);

    if (message && message.includes('Context creation failed')) {
        message =
            "We are experiencing extremely high usage. Data may be delayed or inaccurate during this time.\n\nDon't worry, your funds are safe.";
    }

    if (message && message.includes('HTTP request failed')) {
        message = "Seems like you're offline. Please check your internet connection and try again.";
    }

    if (message && message.startsWith('execution reverted: ')) {
        message = message.replace('execution reverted: ', '');
    }

    if (message === 'Invalid amount: TOKEN' || message === 'INSUFFICIENT_AMOUNT: TOKEN') {
        message = ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT;
    }

    if (message === 'Network error: Failed to fetch') {
        return '';
    }

    return message ? message : 'Unknown Error';
};

export const showErrorMessage = (e: any) => {
    const message = getErrorMessage(e);

    if (message) {
        Toast.showError(message);
    }
};
