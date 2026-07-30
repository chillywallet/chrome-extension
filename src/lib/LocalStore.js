import browser from 'webextension-polyfill';
import { checkForLastError } from '../shared/utils/browser-runtime-utils';
import logger from '../shared/utils/logger';

/**
 * A wrapper around the extension's storage local API
 */
export default class LocalStore {
    constructor() {
        this.isSupported = Boolean(browser.storage.local);
        if (!this.isSupported) {
            logger.error('Storage local API not available.');
        }
        // we use this flag to avoid flooding sentry with a ton of errors:
        // once data persistence fails once and it flips true we don't send further
        // data persistence errors to sentry
        this.dataPersistenceFailing = false;
        this.mostRecentRetrievedState = null;
    }

    setMetadata(initMetaData) {
        this.metadata = initMetaData;
    }

    async set(state) {
        if (!this.isSupported) {
            throw new Error(
                'Cannot persist state to local store as this browser does not support this action',
            );
        }
        if (!state) {
            throw new Error('Updated state is missing');
        }
        if (!this.metadata) {
            throw new Error(
                'Metadata must be set on instance of ExtensionStore before calling "set"',
            );
        }
        try {
            // we format the data for storage as an object with the "data" key for the controller state object
            // and the "meta" key for a metadata object containing a version number that tracks how the data shape
            // has changed using migrations to adapt to backwards incompatible changes
            await this._set({ data: state, meta: this.metadata });
            if (this.dataPersistenceFailing) {
                this.dataPersistenceFailing = false;
            }
        } catch (err) {
            if (!this.dataPersistenceFailing) {
                this.dataPersistenceFailing = true;
            }

            logger.error('error setting state in local store:', err);
        }
    }

    /**
     * Returns all of the keys currently saved
     *
     * @returns {Promise<*>}
     */
    async get() {
        if (!this.isSupported) {
            return undefined;
        }
        const result = await this._get();
        // extension.storage.local always returns an obj
        // if the object is empty, treat it as undefined
        if (isEmpty(result)) {
            this.mostRecentRetrievedState = null;
            return undefined;
        }
        this.mostRecentRetrievedState = result;
        return result;
    }

    /**
     * Returns all of the keys currently saved
     *
     * @private
     * @returns {object} the key-value map from local storage
     */
    _get() {
        const { local } = browser.storage;
        return new Promise((resolve, reject) => {
            local.get(null).then((/** @type {any} */ result) => {
                const err = checkForLastError();
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Sets the key in local state
     *
     * @param {object} obj - The key to set
     * @returns {Promise<void>}
     * @private
     */
    _set(obj) {
        const { local } = browser.storage;
        return new Promise((resolve, reject) => {
            local.set(obj).then(() => {
                const err = checkForLastError();
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

/**
 * Returns whether or not the given object contains no keys
 *
 * @param {object} obj - The object to check
 * @returns {boolean}
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}
