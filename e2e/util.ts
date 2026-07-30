import { test as base, chromium, Page, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
    context: BrowserContext;
    extensionId: string;
}>({
    context: async ({ }, use) => {
        const pathToExtension = path.join(__dirname, '../build/debug/');

        // For persistent context, we need to specify a user data directory
        const userDataDir = path.join(__dirname, '..', 'test-results', 'session');

        const isCI = !!process.env.CI;
        const extensionArgs = [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
        ];
        const ciArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ];

        // In CI: use channel 'chromium' (Playwright's bundled Chromium) so extensions work headless.
        // See https://playwright.dev/docs/chrome-extensions
        const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] = isCI
            ? {
                channel: 'chromium',
                args: [...ciArgs, ...extensionArgs],
            }
            : {
                headless: false,
                args: process.platform === 'darwin' ? extensionArgs : ['--headless=new', ...extensionArgs],
            };

        const context = await chromium.launchPersistentContext(userDataDir, launchOptions);
        await use(context);
        await context.close();
    },
    extensionId: async ({ context }, use) => {
        // for manifest v3: get extension ID from service worker URL
        let [background] = context.serviceWorkers();
        if (!background) {
            // Timeout so we fail with a clear error instead of hanging (e.g. in CI if serviceworker never fires)
            background = await context.waitForEvent('serviceworker', { timeout: 60000 });
        }

        const extensionId = background.url().split('/')[2];
        await use(extensionId);
    },
});
export const expect = test.expect;

export const pasteText = async (page: Page) => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+V`);
}

let counter = 0;

export const screenshot = async (page: Page, name: string) => {
    counter++;
    const fileName = `test-results/${counter}-${name}.png`;
    //take screenshot
    await page.screenshot({ path: fileName });
}

export const unlockScreen = async (page: Page) => {
    const pinCode = process.env.PLAYWRIGHT_PIN_CODE || '';

    await page.locator('input[type="password"]').first().fill(pinCode);

    await expect(page.locator('button').first()).toHaveText('Unlock');
    await page.locator('button').first().click();
}