import browser from 'webextension-polyfill';
import { getEnvironmentType } from '../../src/shared/utils/utils';
import ExtensionPlatform from '../../src/lib/ExtensionPlatform';

jest.mock('webextension-polyfill', () => require('../helpers/webextensionTestMock.js'));

jest.mock('../../src/shared/utils/utils', () => ({
    getEnvironmentType: jest.fn(() => 'popup'),
}));

const setBrowserDefaults = () => {
    const b: any = browser;
    b.runtime.reload = jest.fn();
    b.runtime.getManifest = jest.fn(() => ({ version: '1.2.3' }));
    b.runtime.getURL = jest.fn((p: string) => `chrome-extension://x/${p}`);
    b.runtime.getPlatformInfo = jest.fn();
    b.runtime.sendMessage = jest.fn(async () => [1, 2, 3]);
    b.windows = {
        getCurrent: jest.fn(async () => ({ id: 1, incognito: false })),
        getLastFocused: jest.fn(async () => ({ id: 5 })),
        getAll: jest.fn(async () => [{ id: 1 }, { id: 2 }]),
        create: jest.fn(async (opts: any) => ({ id: 10, ...opts })),
        update: jest.fn(async () => undefined),
        remove: jest.fn(async () => undefined),
        onRemoved: { addListener: jest.fn() },
    };
    b.tabs.create = jest.fn(async (opts: any) => ({ id: 99, ...opts }));
    b.tabs.query = jest.fn(async () => [{ id: 7 }]);
    b.tabs.getCurrent = jest.fn(async () => ({ id: 11 }));
    b.tabs.update = jest.fn(async (id: number, props: any) => ({ id, ...props }));
    b.tabs.remove = jest.fn(async () => undefined);
    b.sidePanel = { open: jest.fn(async () => undefined) };
};

describe('ExtensionPlatform', () => {
    beforeEach(() => {
        setBrowserDefaults();
        (window as any).open = jest.fn();
        (window as any).close = jest.fn();
        (getEnvironmentType as jest.Mock).mockReturnValue('popup');
    });

    it('reload calls runtime.reload', () => {
        new ExtensionPlatform().reload();
        expect((browser.runtime.reload as jest.Mock)).toHaveBeenCalled();
    });

    it('isRunningInIncognito returns true if window incognito', async () => {
        (browser.windows.getCurrent as jest.Mock).mockResolvedValueOnce({ incognito: true });
        await expect(new ExtensionPlatform().isRunningInIncognito()).resolves.toBe(true);
    });

    it('isRunningInIncognito returns false in normal mode', async () => {
        await expect(new ExtensionPlatform().isRunningInIncognito()).resolves.toBe(false);
    });

    it('openLink opens in tab when incognito', async () => {
        (browser.windows.getCurrent as jest.Mock).mockResolvedValueOnce({ id: 5, incognito: true });
        await new ExtensionPlatform().openLink('https://x.com');
        expect(browser.tabs.create).toHaveBeenCalledWith({ url: 'https://x.com', windowId: 5 });
    });

    it('openLink uses window.open in normal mode', async () => {
        await new ExtensionPlatform().openLink('https://x.com');
        expect(window.open).toHaveBeenCalledWith('https://x.com', '_blank', undefined);
    });

    it('focusWindow calls update with focused', async () => {
        await new ExtensionPlatform().focusWindow(7);
        expect(browser.windows.update).toHaveBeenCalledWith(7, { focused: true });
    });

    it('updateWindowPosition forwards left/top', async () => {
        await new ExtensionPlatform().updateWindowPosition(5, 10, 20);
        expect(browser.windows.update).toHaveBeenCalledWith(5, { left: 10, top: 20 });
    });

    it('closeCurrentWindow removes current window id', async () => {
        await new ExtensionPlatform().closeCurrentWindow();
        expect(browser.windows.remove).toHaveBeenCalledWith(1);
    });

    it('closeCurrentWindow does nothing when no window id', async () => {
        (browser.windows.getCurrent as jest.Mock).mockResolvedValueOnce({});
        await new ExtensionPlatform().closeCurrentWindow();
        expect(browser.windows.remove).not.toHaveBeenCalled();
    });

    describe('getVersion', () => {
        it('returns version when 3 numeric parts', () => {
            (browser.runtime.getManifest as jest.Mock).mockReturnValue({ version: '1.2.3' });
            expect(new ExtensionPlatform().getVersion()).toBe('1.2.3');
        });

        it('returns versionName when present and 4 parts', () => {
            (browser.runtime.getManifest as jest.Mock).mockReturnValue({
                version: '1.2.3.4',
                version_name: 'v1.2.3-beta.4',
            });
            expect(new ExtensionPlatform().getVersion()).toBe('v1.2.3-beta.4');
        });

        it('throws on invalid part count', () => {
            (browser.runtime.getManifest as jest.Mock).mockReturnValue({ version: '1.2' });
            expect(() => new ExtensionPlatform().getVersion()).toThrow(/Invalid version/);
        });

        it('throws when version_name set but version too few parts', () => {
            (browser.runtime.getManifest as jest.Mock).mockReturnValue({
                version: '1.2.3',
                version_name: 'beta',
            });
            expect(() => new ExtensionPlatform().getVersion()).toThrow(/build number/);
        });

        it('parses firefox-style prerelease', () => {
            (browser.runtime.getManifest as jest.Mock).mockReturnValue({ version: '1.2.3beta1' });
            expect(new ExtensionPlatform().getVersion()).toBe('1.2.3-beta.1');
        });

        it('throws on invalid prerelease string', () => {
            (browser.runtime.getManifest as jest.Mock).mockReturnValue({ version: '1.2.abc' });
            expect(() => new ExtensionPlatform().getVersion()).toThrow(/prerelease/);
        });
    });

    it('getExtensionURL builds url with route and query', () => {
        const url = new ExtensionPlatform().getExtensionURL('home', 'a=1');
        expect(url).toContain('home.html');
        expect(url).toContain('#home');
        expect(url).toContain('?a=1');
    });

    it('getExtensionURL works without route or query', () => {
        const url = new ExtensionPlatform().getExtensionURL();
        expect(url).toContain('home.html');
        expect(url).not.toContain('#');
        expect(url).not.toContain('?');
    });

    it('openExtensionInBrowser opens a tab and closes window in popup mode', () => {
        new ExtensionPlatform().openExtensionInBrowser('home');
        expect(browser.tabs.create).toHaveBeenCalled();
        expect(window.close).toHaveBeenCalled();
    });

    it('openExtensionInBrowser does not close window in background context', () => {
        (getEnvironmentType as jest.Mock).mockReturnValueOnce('background');
        new ExtensionPlatform().openExtensionInBrowser('home');
        expect(window.close).not.toHaveBeenCalled();
    });

    it('openSidePanel opens the side panel for the active tab', async () => {
        await new ExtensionPlatform().openSidePanel();
        expect((browser as any).sidePanel.open).toHaveBeenCalledWith({ tabId: 7 });
        expect(window.close).toHaveBeenCalled();
    });

    it('openSidePanel skips open when no active tab', async () => {
        (browser.tabs.query as jest.Mock).mockResolvedValueOnce([]);
        await new ExtensionPlatform().openSidePanel();
        expect((browser as any).sidePanel.open).not.toHaveBeenCalled();
    });

    it('getExpandedViewIds sends a runtime message', async () => {
        const ids = await new ExtensionPlatform().getExpandedViewIds();
        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'get-expanded-view-ids' });
        expect(ids).toEqual([1, 2, 3]);
    });

    it('getPlatformInfo invokes callback with info', () => {
        (browser.runtime.getPlatformInfo as jest.Mock).mockReturnValueOnce(Promise.resolve({ os: 'mac' }));
        const cb = jest.fn();
        new ExtensionPlatform().getPlatformInfo(cb);
        expect(cb).toHaveBeenCalled();
    });

    it('getPlatformInfo passes errors to callback', () => {
        (browser.runtime.getPlatformInfo as jest.Mock).mockImplementationOnce(() => {
            throw new Error('nope');
        });
        const cb = jest.fn();
        new ExtensionPlatform().getPlatformInfo(cb);
        expect(cb).toHaveBeenCalledWith(undefined, expect.any(Error));
    });

    it('addOnRemovedListener subscribes on windows.onRemoved', () => {
        const fn = jest.fn();
        new ExtensionPlatform().addOnRemovedListener(fn);
        expect(browser.windows.onRemoved.addListener).toHaveBeenCalledWith(fn);
    });

    it('switchToTab updates the tab with highlighted', async () => {
        const tab = await new ExtensionPlatform().switchToTab(42);
        expect(browser.tabs.update).toHaveBeenCalledWith(42, { highlighted: true });
        expect(tab.id).toBe(42);
    });

    it('switchToAnotherURL updates the tab url', async () => {
        await new ExtensionPlatform().switchToAnotherURL(42, 'https://a');
        expect(browser.tabs.update).toHaveBeenCalledWith(42, { url: 'https://a' });
    });

    it('closeTab removes the tab', async () => {
        await new ExtensionPlatform().closeTab(7);
        expect(browser.tabs.remove).toHaveBeenCalledWith(7);
    });

    it('queries getAllWindows / getCurrentWindow / getActiveTabs / openWindow / currentTab', async () => {
        const p = new ExtensionPlatform();
        expect(await p.getAllWindows()).toEqual([{ id: 1 }, { id: 2 }]);
        expect((await p.getCurrentWindow()).id).toBe(1);
        const active = await p.getActiveTabs();
        expect(Array.isArray(active)).toBe(true);
        const ct = await p.getCurrentActiveTabs();
        expect(Array.isArray(ct)).toBe(true);
        const t = await p.currentTab();
        expect(t.id).toBe(11);
        const w = await p.openWindow({ url: 'x' } as any);
        expect(w.id).toBe(10);
    });

    it('getLastFocusedWindow returns last focused', async () => {
        const w = await new ExtensionPlatform().getLastFocusedWindow();
        expect(w.id).toBe(5);
    });
});
