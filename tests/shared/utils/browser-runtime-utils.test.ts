import {
    checkForLastError,
    checkForLastErrorAndLog,
    checkForLastErrorAndWarn,
    isManifestV3,
    getIsBrowserPrerenderBroken,
} from '../../../src/shared/utils/browser-runtime-utils';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        runtime: {
            lastError: undefined,
            getManifest: () => ({ manifest_version: 3 }),
        },
    },
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const browser = require('webextension-polyfill').default;

describe('browser-runtime-utils', () => {
    afterEach(() => {
        browser.runtime.lastError = undefined;
    });

    it('returns undefined when no lastError', () => {
        expect(checkForLastError()).toBeUndefined();
    });

    it('returns the error if it looks like one', () => {
        const err = new Error('boom');
        browser.runtime.lastError = err;
        expect(checkForLastError()).toBe(err);
    });

    it('repairs an incomplete error object into an Error', () => {
        browser.runtime.lastError = { message: 'incomplete' };
        const result = checkForLastError();
        expect(result).toBeInstanceOf(Error);
        expect(result!.message).toBe('incomplete');
    });

    it('checkForLastErrorAndLog logs the error', () => {
        const logger = require('../../../src/shared/utils/logger').default;
        browser.runtime.lastError = new Error('boom');
        checkForLastErrorAndLog();
        expect(logger.error).toHaveBeenCalled();
    });

    it('checkForLastErrorAndWarn warns about the error', () => {
        const logger = require('../../../src/shared/utils/logger').default;
        browser.runtime.lastError = new Error('boom');
        checkForLastErrorAndWarn();
        expect(logger.warn).toHaveBeenCalled();
    });

    it('exposes isManifestV3', () => {
        expect(isManifestV3).toBe(true);
    });

    it('getIsBrowserPrerenderBroken returns a boolean', () => {
        const fakeBowser = { satisfies: jest.fn(() => false) };
        expect(getIsBrowserPrerenderBroken(fakeBowser as any)).toBe(false);
    });

    it('checkForLastErrorAndLog is a no-op when no error', () => {
        const logger = require('../../../src/shared/utils/logger').default;
        // no lastError → checkForLastError returns undefined → `if (error)` false
        expect(checkForLastErrorAndLog()).toBeUndefined();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('checkForLastErrorAndWarn is a no-op when no error', () => {
        const logger = require('../../../src/shared/utils/logger').default;
        expect(checkForLastErrorAndWarn()).toBeUndefined();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('getIsBrowserPrerenderBroken uses the default Bowser parser when no arg given', () => {
        // Just ensure invocation with default arg returns a boolean
        const result = getIsBrowserPrerenderBroken();
        expect(typeof result).toBe('boolean');
    });

    it('getIsBrowserPrerenderBroken returns true when broken and not fixed', () => {
        const fakeBowser = {
            satisfies: jest
                .fn()
                .mockReturnValueOnce(true) // BROKEN matches
                .mockReturnValueOnce(false), // FIXED does not
        };
        expect(getIsBrowserPrerenderBroken(fakeBowser as any)).toBe(true);
    });
});
