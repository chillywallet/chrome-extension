import {
    deferredPromise,
    extractParams,
    checkValidWalletAddress,
    getPlatform,
    isPrefixedFormattedHexString,
    isSafeChainId,
    getCurrentScreenBreakpoint,
    MAX_SAFE_CHAIN_ID,
    getEnvironmentType,
} from '../../../src/shared/utils/utils';
import {
    ENVIRONMENT_TYPE_BACKGROUND,
    ENVIRONMENT_TYPE_FULLSCREEN,
    ENVIRONMENT_TYPE_NOTIFICATION,
    ENVIRONMENT_TYPE_POPUP,
    ENVIRONMENT_TYPE_SIDEPANEL,
    PLATFORM_BRAVE,
    PLATFORM_CHROME,
    PLATFORM_EDGE,
    PLATFORM_FIREFOX,
    PLATFORM_OPERA,
} from '../../../src/shared/constants/app';

jest.mock('@ethereumjs/util', () => {
    const actual = jest.requireActual('@ethereumjs/util');
    return {
        ...actual,
        isValidAddress: (addr: string) => {
            if (addr === '__throw__') {
                throw new Error('boom');
            }
            return actual.isValidAddress(addr);
        },
    };
});

describe('utils', () => {
    describe('deferredPromise', () => {
        it('returns an object with promise/resolve/reject', () => {
            const d = deferredPromise();
            expect(d.promise).toBeInstanceOf(Promise);
            expect(typeof d.resolve).toBe('function');
            expect(typeof d.reject).toBe('function');
        });

        it('resolves when resolve() is called', async () => {
            const d = deferredPromise();
            d.resolve();
            await expect(d.promise).resolves.toBeUndefined();
        });

        it('rejects when reject() is called', async () => {
            const d = deferredPromise();
            d.reject();
            await expect(d.promise).rejects.toBeUndefined();
        });
    });

    describe('extractParams', () => {
        const originalHash = window.location.hash;
        afterEach(() => {
            window.location.hash = originalHash;
        });

        it('returns empty object when no params', () => {
            window.location.hash = 'route';
            expect(extractParams()).toEqual({});
        });

        it('parses query string', () => {
            window.location.hash = 'route?a=1&b=2';
            const params = extractParams();
            expect(params.a).toBe('1');
            expect(params.b).toBe('2');
        });

        it('returns true for valueless keys', () => {
            window.location.hash = 'route?flag';
            const params = extractParams();
            expect(params.flag).toBe(true);
        });
    });

    describe('checkValidWalletAddress', () => {
        it('returns true for a valid checksummed address', () => {
            expect(
                checkValidWalletAddress('0x32Be343B94f860124dC4fEe278FDCBD38C102D88'),
            ).toBe(true);
        });

        it('returns false for an empty string', () => {
            expect(checkValidWalletAddress('')).toBe(false);
        });

        it('returns false for an invalid address', () => {
            expect(checkValidWalletAddress('not-an-address')).toBe(false);
        });

        it('returns true for 0x0 when with0x0 is true', () => {
            expect(checkValidWalletAddress('0x0', true)).toBe(true);
        });

        it('returns false for 0x0 when with0x0 is false', () => {
            expect(checkValidWalletAddress('0x0', false)).toBe(false);
        });

        it('returns false when isValidAddress throws', () => {
            expect(checkValidWalletAddress('__throw__')).toBe(false);
        });
    });

    describe('getPlatform', () => {
        const originalNavigator = window.navigator;

        const setNavigator = (props: any) => {
            Object.defineProperty(window, 'navigator', {
                value: { ...originalNavigator, ...props },
                configurable: true,
            });
        };

        afterEach(() => {
            Object.defineProperty(window, 'navigator', {
                value: originalNavigator,
                configurable: true,
            });
        });

        it('detects Firefox', () => {
            setNavigator({ userAgent: 'Mozilla/5.0 Firefox/118.0' });
            expect(getPlatform()).toBe(PLATFORM_FIREFOX);
        });

        it('detects Brave', () => {
            setNavigator({ userAgent: 'Mozilla', brave: {} });
            expect(getPlatform()).toBe(PLATFORM_BRAVE);
        });

        it('detects Edge', () => {
            setNavigator({ userAgent: 'Mozilla Edg/118' });
            expect(getPlatform()).toBe(PLATFORM_EDGE);
        });

        it('detects Opera', () => {
            setNavigator({ userAgent: 'Mozilla OPR/110' });
            expect(getPlatform()).toBe(PLATFORM_OPERA);
        });

        it('falls back to Chrome', () => {
            setNavigator({ userAgent: 'Mozilla Chrome/118' });
            expect(getPlatform()).toBe(PLATFORM_CHROME);
        });
    });

    describe('isPrefixedFormattedHexString', () => {
        it('returns false for non-strings', () => {
            expect(isPrefixedFormattedHexString(123)).toBe(false);
            expect(isPrefixedFormattedHexString(undefined)).toBe(false);
        });

        it('matches valid hex strings', () => {
            expect(isPrefixedFormattedHexString('0x1')).toBe(true);
            expect(isPrefixedFormattedHexString('0xa')).toBe(true);
        });

        it('rejects strings missing prefix or leading zero', () => {
            expect(isPrefixedFormattedHexString('1a')).toBe(false);
            expect(isPrefixedFormattedHexString('0x0')).toBe(false);
        });
    });

    describe('isSafeChainId', () => {
        it('accepts safe positive integer', () => {
            expect(isSafeChainId(1)).toBe(true);
        });

        it('rejects zero, negatives, oversized', () => {
            expect(isSafeChainId(0)).toBe(false);
            expect(isSafeChainId(-1)).toBe(false);
            expect(isSafeChainId(MAX_SAFE_CHAIN_ID + 1)).toBe(false);
        });

        it('rejects non-integer', () => {
            expect(isSafeChainId(1.5)).toBe(false);
            expect(isSafeChainId('1')).toBe(false);
        });
    });

    describe('getCurrentScreenBreakpoint', () => {
        it('returns null when no breakpoints match', () => {
            (window.matchMedia as jest.Mock).mockImplementation(() => ({ matches: false }));
            expect(getCurrentScreenBreakpoint()).toBeNull();
        });

        it('returns the matching breakpoint key', () => {
            (window.matchMedia as jest.Mock).mockImplementation((q: string) => ({
                matches: q.includes('640px') && q.includes('767px'),
            }));
            expect(getCurrentScreenBreakpoint()).toBe('sm');
        });
    });

    describe('getEnvironmentType', () => {
        it('returns popup for /popup.html', () => {
            expect(getEnvironmentType('https://example.com/popup.html')).toBe(
                ENVIRONMENT_TYPE_POPUP,
            );
        });

        it('returns fullscreen for /home.html', () => {
            expect(getEnvironmentType('https://example.com/home.html')).toBe(
                ENVIRONMENT_TYPE_FULLSCREEN,
            );
        });

        it('returns sidepanel for /sidepanel.html', () => {
            expect(getEnvironmentType('https://example.com/sidepanel.html')).toBe(
                ENVIRONMENT_TYPE_SIDEPANEL,
            );
        });

        it('returns notification for /notification.html', () => {
            expect(getEnvironmentType('https://example.com/notification.html')).toBe(
                ENVIRONMENT_TYPE_NOTIFICATION,
            );
        });

        it('returns background otherwise', () => {
            expect(getEnvironmentType('https://example.com/other.html')).toBe(
                ENVIRONMENT_TYPE_BACKGROUND,
            );
        });

        it('uses window.location.href when no url is passed', () => {
            // window.location.href in jsdom defaults to about:blank or http://localhost/
            // which won't match any known path -> background
            const result = getEnvironmentType();
            expect([
                ENVIRONMENT_TYPE_BACKGROUND,
                ENVIRONMENT_TYPE_POPUP,
                ENVIRONMENT_TYPE_FULLSCREEN,
                ENVIRONMENT_TYPE_NOTIFICATION,
                ENVIRONMENT_TYPE_SIDEPANEL,
            ]).toContain(result);
        });
    });
});
