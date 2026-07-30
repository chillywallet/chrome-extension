import browser from 'webextension-polyfill';
import { ENVIRONMENT_TYPE_BACKGROUND } from '../shared/constants/app';
import { getEnvironmentType } from '../shared/utils/utils';

export default class ExtensionPlatform {
    //
    // Public
    //
    reload() {
        browser.runtime.reload();
    }

    async isRunningInIncognito() {
        const win = await browser.windows.getCurrent();
        return Boolean(win.incognito);
    }

    async openLink(url: string, target: string = '_blank', features?: string) {
        const currentWindow = await this.getCurrentWindow();
        const incognito = currentWindow?.incognito;

        if (incognito && currentWindow?.id) {
            this.openTab({ url, windowId: currentWindow?.id });
        } else {
            window.open(url, target, features);
        }
    }

    async openTab(options: browser.Tabs.CreateCreatePropertiesType) {
        const newTab = await browser.tabs.create(options);
        return newTab;
    }

    async openWindow(options?: browser.Windows.CreateCreateDataType) {
        const newWindow = await browser.windows.create(options);
        return newWindow;
    }

    async focusWindow(windowId: number) {
        await browser.windows.update(windowId, { focused: true });
    }

    async updateWindowPosition(windowId: number, left: number, top: number) {
        await browser.windows.update(windowId, { left, top });
    }

    async getLastFocusedWindow() {
        const windowObject = await browser.windows.getLastFocused();
        return windowObject;
    }

    async closeCurrentWindow() {
        const windowDetails = await browser.windows.getCurrent();

        if (typeof windowDetails?.id !== 'undefined') {
            browser.windows.remove(windowDetails.id);
        }
    }

    getVersion() {
        const { version, version_name: versionName } = browser.runtime.getManifest();

        const versionParts = version.split('.');

        if (versionName) {
            if (versionParts.length < 4) {
                throw new Error(`Version missing build number: '${version}'`);
            }
            // On Chrome, a more descriptive representation of the version is stored in the
            // `version_name` field for display purposes. We use this field instead of the `version`
            // field on Chrome for non-main builds (i.e. Flask, Beta) because we want to show the
            // version in the SemVer-compliant format "v[major].[minor].[patch]-[build-type].[build-number]",
            // yet Chrome does not allow letters in the `version` field.
            return versionName;
            // A fourth version part is sometimes present for "rollback" Chrome builds
        } else if (![3, 4].includes(versionParts.length)) {
            throw new Error(`Invalid version: ${version}`);
        } else if (versionParts[2].match(/[^\d]/u)) {
            // On Firefox, the build type and build version are in the third part of the version.
            const [major, minor, patchAndPrerelease] = versionParts;
            const matches = patchAndPrerelease.match(/^(\d+)([A-Za-z]+)(\d)+$/u);
            if (matches === null) {
                throw new Error(`Version contains invalid prerelease: ${version}`);
            }
            const [, patch, buildType, buildVersion] = matches;
            return `${major}.${minor}.${patch}-${buildType}.${buildVersion}`;
        }

        // If there is no `version_name` and there are only 3 or 4 version parts, then this is not a
        // prerelease and the version requires no modification.
        return version;
    }

    getExtensionURL(route?: string, queryString?: string) {
        let extensionURL = browser.runtime.getURL('home.html');

        if (route) {
            extensionURL += `#${route}`;
        }

        if (queryString) {
            extensionURL += `?${queryString}`;
        }

        return extensionURL;
    }

    openExtensionInBrowser(route?: string, queryString?: string) {
        const extensionURL = this.getExtensionURL(route, queryString);

        this.openTab({ url: extensionURL });

        if (getEnvironmentType() !== ENVIRONMENT_TYPE_BACKGROUND) {
            window.close();
        }
    }

    async openSidePanel() {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length) {
            const tabId = tabs[0].id;
            if (tabId !== undefined) {
                //@ts-ignore
                await browser.sidePanel.open({ tabId });
            }
        }

        if (getEnvironmentType() !== ENVIRONMENT_TYPE_BACKGROUND) {
            window.close();
        }
    }

    async getExpandedViewIds(): Promise<number[]> {
        return await browser.runtime.sendMessage({ type: 'get-expanded-view-ids' });
    }

    getPlatformInfo(cb: (info?: Promise<browser.Runtime.PlatformInfo>, error?: any) => void) {
        try {
            const platformInfo = browser.runtime.getPlatformInfo();
            cb(platformInfo);
        } catch (e) {
            cb(undefined, e);
        }
    }

    addOnRemovedListener(listener: (windowId: number) => void) {
        browser.windows.onRemoved.addListener(listener);
    }

    async getAllWindows() {
        const windows = await browser.windows.getAll();
        return windows;
    }

    async getCurrentWindow() {
        const window = await browser.windows.getCurrent();
        return window;
    }

    async getActiveTabs() {
        const tabs = await browser.tabs.query({ active: true });
        return tabs;
    }

    async getCurrentActiveTabs() {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        return tabs;
    }

    async currentTab() {
        const tab = await browser.tabs.getCurrent();
        return tab;
    }

    async switchToTab(tabId: number) {
        const tab = await browser.tabs.update(tabId, { highlighted: true });
        return tab;
    }

    async switchToAnotherURL(tabId: number, url: string) {
        await browser.tabs.update(tabId, { url });
    }

    async closeTab(tabId: number) {
        await browser.tabs.remove(tabId);
    }
}
