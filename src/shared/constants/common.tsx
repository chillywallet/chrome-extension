/**
 * Specifies the browser and their versions where a regression in the extension port
 * stream established between the contentscript and background was breaking for
 * prerendered pages.
 *
 * @see {@link https://issues.chromium.org/issues/40273420}
 */
export const BROKEN_PRERENDER_BROWSER_VERSIONS = {
    chrome: '>=113',
    edge: '>=113',
};

/**
 * Specifies the browser and their versions on a specific OS where a fix for the
 * prerender regression specified in BROKEN_PRERENDER_BROWSER_VERSIONS was resolved.
 *
 * @see {@link https://chromium.googlesource.com/chromium/src/+/a88eee8a2798c1dc4d69b255ccad24fea5ff2d8b}
 */
export const FIXED_PRERENDER_BROWSER_VERSIONS = {
    // https://chromiumdash.appspot.com/commits?commit=a88eee8a2798c1dc4d69b255ccad24fea5ff2d8b&platform=Windows
    windows: {
        chrome: '>=120',
        edge: '>=120',
    },
    // https://chromiumdash.appspot.com/commits?commit=a88eee8a2798c1dc4d69b255ccad24fea5ff2d8b&platform=Mac
    macos: {
        chrome: '>=120',
        edge: '>=120',
    },
    // https://chromiumdash.appspot.com/commits?commit=a88eee8a2798c1dc4d69b255ccad24fea5ff2d8b&platform=Linux
    chrome: '>=121',
    edge: '>=121',
};

export const PENDING_TX_EXPIRED_TIME = 7;
