import EventEmitter from '@metamask/safe-event-emitter';
import { Windows } from 'webextension-polyfill';
import { NOTIFICATION_HEIGHT, NOTIFICATION_WIDTH } from '../shared/constants/notifications';
import ExtensionPlatform from './ExtensionPlatform';

export const NOTIFICATION_MANAGER_EVENTS = {
    POPUP_CLOSED: 'onPopupClosed',
};

/**
 * A collection of methods for controlling the showing and hiding of the notification popup.
 */
export default class NotificationManager extends EventEmitter {
    _popupId?: number;
    _popupAutomaticallyClosed?: boolean;
    platform: ExtensionPlatform;
    _setCurrentPopupId?: (popupId?: number) => void;

    constructor() {
        super();
        this.platform = new ExtensionPlatform();
        this.platform.addOnRemovedListener(this._onWindowClosed.bind(this));
    }

    /**
     * Mark the notification popup as having been automatically closed.
     *
     * This lets us differentiate between the cases where we close the
     * notification popup v.s. when the user closes the popup window directly.
     */
    markAsAutomaticallyClosed() {
        this._popupAutomaticallyClosed = true;
    }

    /**
     * Either brings an existing app notification window into focus, or creates a new notification window. New
     * notification windows are given a 'popup' type.
     *
     * @param {Function} setCurrentPopupId - setter of current popup id from appStateController
     * @param {number} currentPopupId - id of current opened chilly popup window
     */
    async showPopup(setCurrentPopupId: (popupId?: number) => void, currentPopupId?: number) {
        this._popupId = currentPopupId;
        this._setCurrentPopupId = setCurrentPopupId;
        const popup = await this._getPopup(currentPopupId);
        // Bring focus to chrome popup
        if (popup?.id) {
            // bring focus to existing chrome popup
            await this.platform.focusWindow(popup.id);
        } else {
            // create new notification popup
            let left = 0;
            let top = 0;
            try {
                const lastFocused = await this.platform.getLastFocusedWindow();
                // Position window in top right corner of lastFocused window.
                top = lastFocused.top ?? 0;
                // - this is to make sure no error is triggered from polyfill
                // error eg: Invalid value for bounds. Bounds must be at least 50% within visible screen space.
                left = Math.max(
                    (lastFocused.left ?? 0) + ((lastFocused.width ?? 0) - NOTIFICATION_WIDTH),
                    0,
                );
            } catch (_) {
                // The following properties are more than likely 0, due to being
                // opened from the background chrome process for the extension that
                // has no physical dimensions
                const { screenX, screenY, outerWidth } = window;
                top = Math.max(screenY, 0);
                left = Math.max(screenX + (outerWidth - NOTIFICATION_WIDTH), 0);
            }

            const popupWindow = await this.platform.openWindow({
                url: 'notification.html',
                type: 'popup',
                width: NOTIFICATION_WIDTH,
                height: NOTIFICATION_HEIGHT,
                left,
                top,
            });

            if (popupWindow.id) {
                if (popupWindow.left !== left && popupWindow.state !== 'fullscreen') {
                    // Firefox currently ignores left/top for create, but it works for update
                    await this.platform.updateWindowPosition(popupWindow.id, left, top);
                }
                // pass new created popup window id to appController setter
                // and store the id to private variable this._popupId for future access
                this._setCurrentPopupId(popupWindow.id);
                this._popupId = popupWindow.id;
            }
        }
    }

    _onWindowClosed(windowId: number) {
        if (windowId === this._popupId) {
            this._setCurrentPopupId && this._setCurrentPopupId(undefined);
            this._popupId = undefined;
            this.emit(NOTIFICATION_MANAGER_EVENTS.POPUP_CLOSED, {
                automaticallyClosed: this._popupAutomaticallyClosed,
            });
            this._popupAutomaticallyClosed = undefined;
        }
    }

    /**
     * Checks all open Chilly windows, and returns the first one it finds that is a notification window (i.e. has the
     * type 'popup')
     *
     * @private
     */
    async _getPopup(popupId?: number) {
        const windows = await this.platform.getAllWindows();
        return this._getPopupIn(windows, popupId);
    }

    /**
     * Given an array of windows, returns the 'popup' that has been opened by Chilly, or null if no such window exists.
     *
     * @private
     * @param {Array} windows - An array of objects containing data about the open Chilly extension windows.
     */
    _getPopupIn(windows: Windows.Window[], popupId?: number) {
        const _id = popupId ? popupId : this._popupId;
        return windows
            ? windows.find(win => {
                  // Returns notification popup
                  return win && win.type === 'popup' && win.id === _id;
              })
            : null;
    }
}
