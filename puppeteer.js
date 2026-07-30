const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    // Change this to the correct path of your unpacked Chrome extension
    const extensionPath = path.join(__dirname, './build/debug/');

    // Launch Puppeteer with the extension loaded
    const browser = await puppeteer.launch({
        headless: false,  // Extensions don't work in headless mode
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    });

    const pages = await browser.pages();
    const extensionPage = pages.find(page => page.url().startsWith('chrome-extension://'));

    if (extensionPage) {
        console.log('Extension loaded at:', extensionPage.url());
    }

    // Open a new tab
    const page = await browser.newPage();
    await page.goto("chrome-extension://iahhclefnbncclggdgfknfdncegcagla/home.html"); // Replace with the actual URL

    // Wait for the page to load
    await page.waitForSelector('button');

    // Verify button text
    const firstButtonText = await page.evaluate(() => document.querySelectorAll('button')[0].innerText);
    const lastButtonText = await page.evaluate(() => document.querySelectorAll('button')[document.querySelectorAll('button').length - 1].innerText);

    if (firstButtonText !== 'GET STARTED' || lastButtonText !== 'I HAVE AN ACCOUNT') {
        console.error('Button texts do not match expected values!');
        await browser.close();
        return;
    }

    // Click "I HAVE AN ACCOUNT"
    await page.evaluate(() => {
        document.querySelectorAll('button')[document.querySelectorAll('button').length - 1].click();
    });

    await page.bringToFront();

    // Fill email and password
    await page.waitForSelector('input[type="email"]');
    //await page.type('input[type="email"]', 'feb+dashboard@chilly.me');
    //await page.type('input[type="password"]', 'password');

    // Click "CONTINUE" button
    await page.waitForSelector('text=CONTINUE');
    await page.click('text=CONTINUE');

    // Take a screenshot
    await page.screenshot({ path: 'test-results/1-after-login.png' });

    // Should see "Create Pin Code"
    await page.waitForSelector('text=Create Pin Code');

    // Input pin code
    await page.type('input[placeholder="Your Pin Code"]', process.env.PLAYWRIGHT_PIN_CODE || '');
    await page.type('input[placeholder="Confirm Pin Code"]', process.env.PLAYWRIGHT_PIN_CODE || '');

    // Click "Continue"
    await page.waitForSelector('text=Continue');
    await page.click('text=Continue');

    // Should see "Let's get started"
    await page.waitForSelector('text=Let\'s get started');

    // Click the checkbox
    await page.click('input[type="checkbox"]');

    // Click "Import Existing Wallet"
    await page.waitForSelector('text=Import Existing Wallet');
    await page.click('text=Import Existing Wallet');

    // Copy clipboard text
    //let stringToCopy = 'outdoor response hero century easily all danger primary critic oppose used margin';
    let stringToCopy = 'target uncle angle inmate mail famous opera follow grant dinosaur pledge pear';
    await page.evaluate((text) => navigator.clipboard.writeText(text), stringToCopy);

    // Paste into the second input field
    await page.waitForSelector("input[type='text']");
    const firstInput = (await page.$$("input[type='text']"))[0];
    await firstInput.focus();

    const isMac = process.platform === 'darwin'; // Check if the platform is macOS
    if (isMac) {
        await page.keyboard.down('Meta');
        await page.keyboard.press('KeyV');
        await page.keyboard.up('Meta');
    } else {
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyV');
        await page.keyboard.up('Control');
    }

    // Click "Continue" button
    await page.waitForSelector('text=Continue');
    await page.click('text=Continue');

    // Should see "Start Using Wallet"
    await page.waitForSelector('text=Start Using Wallet');
    await page.click('text=Start Using Wallet');

    // Open app.nad.domains in a new tab
    const nadPage = await browser.newPage();
    await nadPage.goto('https://app.nad.domains/');

    // Example: Interact with the page
    await page.evaluate(() => {
        console.log('Running inside Puppeteer with extension loaded');
    });

    // Keep the browser open for debugging
})();