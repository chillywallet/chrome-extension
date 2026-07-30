import { isValidAddress } from '@ethereumjs/util';
import { memoize } from 'lodash';
import {
    ENVIRONMENT_TYPE_BACKGROUND,
    ENVIRONMENT_TYPE_FULLSCREEN,
    ENVIRONMENT_TYPE_NOTIFICATION,
    ENVIRONMENT_TYPE_POPUP,
    ENVIRONMENT_TYPE_SIDEPANEL,
    EnvironmentType,
    PLATFORM_BRAVE,
    PLATFORM_CHROME,
    PLATFORM_EDGE,
    PLATFORM_FIREFOX,
    PLATFORM_OPERA,
} from '../constants/app';

/**
 * @see {@link getEnvironmentType}
 */
const getEnvironmentTypeMemo = memoize((url: string) => {
    let type: EnvironmentType;
    const parsedUrl = new URL(url);

    if (parsedUrl.pathname === '/popup.html') {
        type = ENVIRONMENT_TYPE_POPUP;
    } else if (['/home.html'].includes(parsedUrl.pathname)) {
        type = ENVIRONMENT_TYPE_FULLSCREEN;
    } else if (parsedUrl.pathname === '/sidepanel.html') {
        type = ENVIRONMENT_TYPE_SIDEPANEL;
    } else if (parsedUrl.pathname === '/notification.html') {
        type = ENVIRONMENT_TYPE_NOTIFICATION;
    } else {
        type = ENVIRONMENT_TYPE_BACKGROUND;
    }

    return type;
});

/**
 * Returns the window type for the application
 *
 * - `popup` refers to the extension opened through the browser app icon (in top right corner in chrome and firefox)
 * - `fullscreen` refers to the main browser window
 * - `notification` refers to the popup that appears in its own window when taking action outside of app
 * - `background` refers to the background page
 *
 * NOTE: This should only be called on internal URLs.
 *
 * @param [url] - the URL of the window
 * @returns the environment ENUM
 */
export const getEnvironmentType = (url = window.location.href) => getEnvironmentTypeMemo(url);

/**
 * A deferred Promise.
 *
 * A deferred Promise is one that can be resolved or rejected independently of
 * the Promise construction.
 *
 * @typedef {object} DeferredPromise
 * @property {Promise} promise - The Promise that has been deferred.
 * @property {() => void} resolve - A function that resolves the Promise.
 * @property {() => void} reject - A function that rejects the Promise.
 */

type DeferredPromise = {
    // TODO: Replace `any` with type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    promise: Promise<any>;
    resolve: () => void;
    reject: () => void;
};

/**
/**
 * Create a defered Promise.
 *
 * @returns A deferred Promise.
 */
export function deferredPromise(): DeferredPromise {
    let resolve: DeferredPromise['resolve'];
    let reject: DeferredPromise['reject'];
    const promise = new Promise<void>((innerResolve: () => void, innerReject: () => void) => {
        resolve = innerResolve;
        reject = innerReject;
    });
    //@ts-ignore
    return { promise, resolve, reject };
}

export function extractParams() {
    let hash = window.location.hash;
    let fullUrl = '/' + hash.substring(1);
    let arr = fullUrl.split('?');

    if (arr.length >= 2) {
        let s = arr[1];
        let p = s.split(/\&/),
            l = p.length,
            kv;
        let r: { [key: string]: string | true } = {};
        if (l === 0) {
            return {};
        }
        while (l--) {
            kv = p[l].split(/\=/);
            r[kv[0]] = decodeURIComponent(kv[1] || '') || true;
        }
        return r;
    }
    return {};
}

export function checkValidWalletAddress(address: string, with0x0 = false) {
    if (address) {
        if (with0x0 && address === '0x0') {
            return true;
        }

        try {
            return isValidAddress(address);
        } catch (e) {
            return false;
        }
    }

    return false;
}

/**
 * Returns the platform (browser) where the extension is running.
 *
 * @returns the platform ENUM
 */
export const getPlatform = () => {
    const { navigator } = window;
    const { userAgent } = navigator;

    if (userAgent.includes('Firefox')) {
        return PLATFORM_FIREFOX;
    } else if ('brave' in navigator) {
        return PLATFORM_BRAVE;
    } else if (userAgent.includes('Edg/')) {
        return PLATFORM_EDGE;
    } else if (userAgent.includes('OPR')) {
        return PLATFORM_OPERA;
    }
    return PLATFORM_CHROME;
};

export function isPrefixedFormattedHexString(value: unknown) {
    if (typeof value !== 'string') {
        return false;
    }
    return /^0x[1-9a-f]+[0-9a-f]*$/iu.test(value);
}

export const MAX_SAFE_CHAIN_ID = 4503599627370476;

/**
 * Checks whether the given number primitive chain ID is safe.
 * Because some cryptographic libraries we use expect the chain ID to be a
 * number primitive, it must not exceed a certain size.
 *
 * @param chainId - The chain ID to check for safety.
 * @returns Whether the given chain ID is safe.
 */
export function isSafeChainId(chainId: unknown): boolean {
    return isSafeInteger(chainId) && chainId > 0 && chainId <= MAX_SAFE_CHAIN_ID;
}

/**
 * Like {@link Number.isSafeInteger}, but types the input as a `number` if it is
 * indeed a safe integer.
 *
 * @param value - The value to check.
 * @returns True if the value is a safe integer, false otherwise.
 */
function isSafeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value);
}

export function getCurrentScreenBreakpoint() {
    const breakpoints = {
        xs: '(max-width: 639px)',
        sm: '(min-width: 640px) and (max-width: 767px)',
        md: '(min-width: 768px) and (max-width: 1023px)',
        lg: '(min-width: 1024px) and (max-width: 1279px)',
        xl: '(min-width: 1280px) and (max-width: 1535px)',
        '2xl': '(min-width: 1536px)',
    };

    for (const [key, query] of Object.entries(breakpoints)) {
        if (window.matchMedia(query).matches) {
            return key;
        }
    }

    return null; // In case none of the breakpoints match
}
