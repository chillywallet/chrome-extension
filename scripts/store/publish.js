/*
 * Drives the Chrome Web Store draft.
 *
 *   npm run store:login     # once, you sign in by hand
 *   npm run release         # build + verify the package
 *   npm run store:draft     # this
 *
 * Uploads the newest build/chilly-extension-prod-*.zip, attaches the screenshots and
 * fills the listing fields from store-assets/listing.json.
 *
 * It stops at "save draft" and never submits for review. Publishing is a decision,
 * not a build step, and the reviewer notes still need a testnet seed phrase pasted
 * in by a human.
 *
 * Options:
 *   --item <id>   edit an existing listing instead of creating a new one
 *                 (or set CWS_ITEM_ID)
 *   --headless    run without a visible window; only sensible once a run has worked
 *
 * A first run should be watched. The dashboard is an unversioned Google app whose DOM
 * moves without notice, so any step that cannot find its target dumps a screenshot and
 * the page HTML into store-assets/debug/ and stops rather than clicking something else.
 */
const {
    attach,
    isSignedIn,
    step,
    DASHBOARD,
    latestPackage,
    loadListing,
    screenshotPaths,
} = require('./lib');

const args = process.argv.slice(2);
const itemId = (args.includes('--item') ? args[args.indexOf('--item') + 1] : '') || process.env.CWS_ITEM_ID || '';

/** Try each locator in turn; the dashboard labels the same field differently over time. */
async function firstVisible(page, buildLocators) {
    for (const build of buildLocators) {
        const locator = build();
        if ((await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))) {
            return locator.first();
        }
    }
    return null;
}

(async () => {
    const zip = latestPackage();
    if (!zip) {
        console.error('no build/chilly-extension-prod-*.zip — run `npm run release` first');
        process.exit(1);
    }

    const listing = loadListing();
    const shots = screenshotPaths();

    console.log(`package    ${zip.replace(/.*[\\/]/, '')}`);
    console.log(`screenshots ${shots.length}`);
    console.log(`item        ${itemId || '(new)'}\n`);

    if (!listing.privacyPolicyUrl) {
        console.log('note: listing.json has no privacyPolicyUrl — the store will not accept a');
        console.log('      submission without one. The draft can still be saved.\n');
    }

    // Attaches to the Chrome that store:login left open, so the session is one a
    // human established rather than one this script tried to obtain.
    const { browser, context } = await attach();
    const page =
        context.pages().find(p => p.url().includes('chrome.google.com')) ??
        context.pages()[0] ??
        (await context.newPage());

    await page.bringToFront().catch(() => {});
    await page.goto(itemId ? `${DASHBOARD}/${itemId}/edit` : DASHBOARD, {
        waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(4000);

    if (!(await isSignedIn(page))) {
        console.error('not signed in — run `npm run store:login` first and sign in');
        await browser.close();
        process.exit(1);
    }
    console.log('signed in\n');

    // --- package -----------------------------------------------------------
    await step(page, 'upload package', async () => {
        const input = await firstVisible(page, [() => page.locator('input[type="file"]')]);

        if (input) {
            await input.setInputFiles(zip);
        } else {
            // A new item hides the picker behind "Add new item" / "Upload new package".
            const opener = await firstVisible(page, [
                () => page.getByRole('button', { name: /add new item|new item|upload new package/i }),
                () => page.getByText(/add new item|upload new package/i),
            ]);
            if (!opener) throw new Error('no file input and no upload button on the page');
            await opener.click();
            await page.waitForTimeout(3000);

            const hidden = page.locator('input[type="file"]').first();
            await hidden.waitFor({ state: 'attached', timeout: 20000 });
            await hidden.setInputFiles(zip);
        }

        // The store unpacks and validates before the listing form appears.
        await page.waitForTimeout(15000);
    });

    // --- listing fields ----------------------------------------------------
    const fill = (label, value, patterns) =>
        step(page, `fill ${label}`, async () => {
            if (!value) {
                console.log('(empty, skipped)');
                return;
            }
            const field = await firstVisible(page, [
                ...patterns.map(pattern => () => page.getByLabel(pattern)),
                ...patterns.map(pattern => () => page.getByPlaceholder(pattern)),
            ]);
            if (!field) throw new Error(`could not find the ${label} field`);
            await field.fill(value);
        });

    await fill('description', listing.description, [/description/i]);
    await fill('summary', listing.summary, [/summary|short description/i]);
    await fill('category', listing.category, [/category/i]);

    // --- screenshots -------------------------------------------------------
    await step(page, 'upload screenshots', async () => {
        const inputs = page.locator('input[type="file"][accept*="image"]');
        if ((await inputs.count()) === 0) {
            throw new Error('no image file input — the graphical assets section may not be open');
        }
        await inputs.first().setInputFiles(shots);
        await page.waitForTimeout(8000);
    });

    // --- save --------------------------------------------------------------
    await step(page, 'save draft', async () => {
        const save = await firstVisible(page, [
            () => page.getByRole('button', { name: /save draft|^save$/i }),
            () => page.getByText(/save draft/i),
        ]);
        if (!save) throw new Error('could not find a save button');
        await save.click();
        await page.waitForTimeout(6000);
    });

    console.log('\ndraft saved. Not submitted for review — that is deliberate.');
    console.log('Still to do by hand in the dashboard:');
    console.log('  - privacy policy URL, and the privacy practices tab');
    console.log('  - permission justifications (text in store-assets/listing.json)');
    console.log('  - reviewer notes, including a funded testnet seed phrase');

    // Detach rather than close — the window stays yours to review and finish in.
    await browser.close();
})().catch(error => {
    console.error(`\n${error.message}`);
    console.error('see store-assets/debug/ for a screenshot and the page HTML');
    process.exit(1);
});
