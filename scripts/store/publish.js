/*
 * Drives the Chrome Web Store draft.
 *
 *   npm run store:login                  # once, you sign in by hand
 *   npm run release                      # build + verify the package
 *   npm run store:draft                  # this
 *   npm run store:draft -- --upload-package   # also push a new zip
 *
 * Attaches to the Chrome that store:login left open and fills the listing from
 * store-assets/listing.json.
 *
 * It stops at "save draft" and never submits for review. Publishing is a decision,
 * not a build step, and the submission is blocked anyway until a privacy policy URL
 * and reviewer test instructions are filled in by a human.
 *
 * Things the dashboard does that shaped this file:
 *  - The summary is NOT editable. It is read from the package manifest's
 *    description, so there is no field to fill.
 *  - Fields are Material floating labels: no placeholder, no aria-label, so they
 *    are resolved through the <label for> that sits above them.
 *  - Category and Language are `[role=combobox]` divs, not <select>.
 *  - Re-uploading a version that already exists is an error, so the package upload
 *    is opt-in rather than part of every run.
 *
 * IMAGES ARE NOT AUTOMATED. The store icon and screenshots go through a drop zone
 * whose hidden <input type=file> is decorative: setInputFiles resolves against it
 * and the image never arrives, and a synthetic DragEvent carrying a DataTransfer
 * does not take either. The steps below still try, and verify by watching the
 * thumbnail count rather than trusting the upload call, but expect to drag the six
 * files in by hand — it takes well under a minute and is a one-time cost per
 * listing, which is not worth a brittle workaround for.
 */
const fs = require('fs');
const path = require('path');
const {
    attach,
    isSignedIn,
    step,
    DASHBOARD,
    ROOT,
    latestPackage,
    loadListing,
    screenshotPaths,
} = require('./lib');

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const arg = name => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : '');

const listing = loadListing();
const itemId = arg('item') || process.env.CWS_ITEM_ID || listing.itemId || '';
const publisherId = listing.publisherId || '';

/*
 * Item pages live under the publisher, not directly under the console:
 *   /webstore/devconsole/<publisherId>/<itemId>/edit
 * Guessing /edit/listing instead returns a Google 404 page, which looks like a
 * missing field rather than a bad URL.
 */
const itemUrl = (suffix = '') =>
    `${DASHBOARD}/${publisherId}/${itemId}/edit${suffix}`;

/**
 * Resolve a field by its visible label.
 *
 * The dashboard is Material: the caption you see is a floating <label for="…">
 * wrapping a span, and the control carries no placeholder and no aria-label. So
 * neither getByLabel nor getByPlaceholder finds these — read the label's `for`
 * and address the control by id.
 */
async function fieldByLabel(page, text) {
    const id = await page.evaluate(labelText => {
        const wanted = labelText.toLowerCase();
        for (const label of document.querySelectorAll('label[for]')) {
            if ((label.textContent || '').trim().toLowerCase().startsWith(wanted)) {
                return label.getAttribute('for');
            }
        }
        return null;
    }, text);

    // Ids here are short generated tokens like "i14", so a plain selector is safe.
    return id ? page.locator(`#${id}`).first() : null;
}

/**
 * Pick a value from one of the dashboard's Material comboboxes.
 *
 * These are `[role=combobox]` divs, not <select>, so selectOption does nothing and
 * a plain click on the label area reports "element is not enabled".
 */
async function selectCombobox(page, labelPrefix, optionText) {
    const box = page
        .locator('[role=combobox]')
        .filter({ hasText: new RegExp(`^${labelPrefix}`, 'i') })
        .first();

    await box.scrollIntoViewIfNeeded();
    await box.click();
    await page.waitForTimeout(1500);

    const option = page.getByRole('option', { name: optionText, exact: false }).first();
    await option.waitFor({ state: 'visible', timeout: 8000 });
    await option.click();
    await page.waitForTimeout(1500);
}

/**
 * Drop a file onto one of the "Drop image here" zones.
 *
 * The hidden <input type=file> next to each zone looks like the way in, and
 * setInputFiles even resolves against it — but the image never arrives. The
 * uploader listens for drop events, so the file has to be delivered as a real
 * DragEvent carrying a DataTransfer.
 *
 * `marker` is text unique to the surrounding block, e.g. "Up to a maximum of 5".
 */
async function dropFile(page, marker, filePath) {
    const b64 = fs.readFileSync(filePath).toString('base64');

    return page.evaluate(
        ({ marker, name, b64 }) => {
            const zones = [...document.querySelectorAll('div,section,label')].filter(
                el =>
                    /Drop (image|icon) here/i.test(el.textContent || '') &&
                    (el.textContent || '').trim().length < 40,
            );

            let target = null;
            for (const zone of zones) {
                let node = zone;
                for (let depth = 0; depth < 10 && node; depth += 1) {
                    node = node.parentElement;
                    if (node && (node.textContent || '').includes(marker)) {
                        target = zone;
                        break;
                    }
                }
                if (target) break;
            }
            if (!target) return 'no-zone';

            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

            const transfer = new DataTransfer();
            transfer.items.add(new File([bytes], name, { type: 'image/png' }));

            for (const type of ['dragenter', 'dragover', 'drop']) {
                target.dispatchEvent(
                    new DragEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        dataTransfer: transfer,
                    }),
                );
            }
            return 'dropped';
        },
        { marker, name: path.basename(filePath), b64 },
    );
}

/**
 * Tag a hidden file input by the text of the block it belongs to, so it can be
 * driven without relying on Google's obfuscated class names.
 */
async function tagFileInput(page, marker, tag) {
    return page.evaluate(
        ({ marker, tag }) => {
            document
                .querySelectorAll(`[data-cws="${tag}"]`)
                .forEach(node => node.removeAttribute('data-cws'));

            for (const input of document.querySelectorAll('input[type=file]')) {
                // Each slot takes one file and keeps it, so skip the ones already used.
                if (input.files && input.files.length > 0) continue;

                let node = input;
                for (let depth = 0; depth < 8 && node; depth += 1) {
                    node = node.parentElement;
                    if (node && (node.textContent || '').includes(marker)) {
                        input.setAttribute('data-cws', tag);
                        return true;
                    }
                }
            }
            return false;
        },
        { marker, tag },
    );
}

(async () => {
    const shots = screenshotPaths();

    console.log(`item        ${itemId || '(new)'}`);
    console.log(`screenshots ${shots.length}`);
    if (flag('upload-package')) {
        console.log(`package     ${path.basename(latestPackage() ?? 'MISSING')}`);
    }
    console.log();

    const { browser, context } = await attach();
    const page =
        context.pages().find(p => p.url().includes('chrome.google.com')) ??
        context.pages()[0] ??
        (await context.newPage());

    // Never fall back to the dashboard root: the "new item" upload lives there, and
    // an accidental upload creates a second listing rather than editing this one.
    if (!itemId || !publisherId) {
        console.error('set itemId and publisherId in store-assets/listing.json first');
        process.exit(1);
    }

    await page.bringToFront().catch(() => {});
    await page.goto(itemUrl(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    if (!(await isSignedIn(page))) {
        console.error('not signed in — run `npm run store:login` first');
        await browser.close();
        process.exit(1);
    }
    console.log('signed in\n');

    if (flag('upload-package')) {
        await step(page, 'upload package', async () => {
            const zip = latestPackage();
            if (!zip) throw new Error('no build/chilly-extension-prod-*.zip — run `npm run release`');
            await page.goto(itemUrl('/package'), { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(4000);
            await page.locator('input[type="file"]').first().setInputFiles(zip);
            await page.waitForTimeout(15000);
            await page.goto(itemUrl(), { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(5000);
        });
    }

    // --- description -------------------------------------------------------
    // The summary is derived from the manifest and has no field of its own.
    await step(page, 'fill description', async () => {
        const field = page.getByLabel(/^Description/i).first();
        await field.waitFor({ state: 'visible', timeout: 20000 });
        await field.fill(listing.description);
    });

    if (listing.websiteUrl) {
        try {
            await step(page, 'fill website', async () => {
                const field = await fieldByLabel(page, 'Homepage URL');
                if (!field) throw new Error('no "Homepage URL" field');
                await field.scrollIntoViewIfNeeded();
                await field.fill(listing.websiteUrl);
            });
        } catch {
            console.log('  (set the website by hand)');
        }
    }

    // --- screenshots -------------------------------------------------------
    // "Up to a maximum of 5" is unique to the screenshots block; the store icon and
    // promo tiles carry different hints.
    // Each slot is a single-file input, so they go up one at a time; the dashboard
    // adds a fresh empty slot after every accepted image.
    //
    // setInputFiles resolving proves nothing here — the store uploads asynchronously
    // and a rejected image leaves no trace in the step. So each one is confirmed by
    // watching the thumbnail count actually rise.
    const shotCount = () =>
        page.evaluate(
            () => document.querySelectorAll('img[src^="blob:"], img[src*="googleusercontent"]').length,
        );

    let seen = await shotCount();
    let shotsFailed = false;
    for (const [index, shot] of shots.entries()) {
      try {
        await step(page, `screenshot ${index + 1}/${shots.length}`, async () => {
            const dropped = await dropFile(page, 'Up to a maximum of 5', shot);
            if (dropped !== 'dropped') throw new Error('no screenshot drop zone found');

            for (let waited = 0; waited < 25000; waited += 1000) {
                await page.waitForTimeout(1000);
                const now = await shotCount();
                if (now > seen) {
                    seen = now;
                    return;
                }
            }
            throw new Error('image never appeared — rejected, or still processing');
        });
      } catch {
        shotsFailed = true;
        break;
      }
    }
    if (shotsFailed) {
        console.log('  (drag store-assets/screenshots/*.png in by hand — see header note)');
    }

    // --- store icon --------------------------------------------------------
    // The 128px icon ships in the package but the listing needs its own copy.
    try {
        await step(page, 'upload store icon', async () => {
            const icon = path.join(ROOT, 'extension/images/icon-128.png');
            if (!fs.existsSync(icon)) throw new Error('extension/images/icon-128.png missing');
            const dropped = await dropFile(page, 'Store icon', icon);
            if (dropped !== 'dropped') throw new Error('no icon drop zone (already set?)');
            await page.waitForTimeout(9000);
        });
    } catch {
        console.log('  (store icon already set, or upload it by hand)');
    }

    // --- category and language ---------------------------------------------
    for (const [label, value] of [
        ['Category', listing.category],
        ['Language', listing.language],
    ]) {
        try {
            await step(page, `set ${label.toLowerCase()}`, () =>
                selectCombobox(page, label, value),
            );
        } catch {
            console.log(`  (set ${label} to "${value}" by hand)`);
        }
    }

    await step(page, 'save draft', async () => {
        await page.getByRole('button', { name: /save draft/i }).first().click();
        await page.waitForTimeout(8000);
    });

    // --- privacy practices -------------------------------------------------
    // Each of these blocks submission, so they are attempted, but the tab is a
    // different shape per account and is safe to finish by hand.
    try {
        await step(page, 'open privacy tab', async () => {
            await page.goto(itemUrl('/privacy'), { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(5000);
        });

        await step(page, 'fill single purpose', async () => {
            const field = await fieldByLabel(page, 'Single purpose description');
            if (!field) throw new Error('no "Single purpose description" field');
            await field.scrollIntoViewIfNeeded();
            await field.fill(listing.singlePurpose);
        });

        // listing.json keys match the permission names the dashboard prints, except
        // the two that are not literal manifest permissions.
        const labelFor = permission =>
            ({
                hostPermissions: 'Host permission justification',
                remoteCode: 'Remote code justification',
            })[permission] ?? `${permission} justification`;

        const missed = [];
        for (const [permission, justification] of Object.entries(
            listing.permissionJustifications,
        )) {
            try {
                await step(page, `justify ${permission}`, async () => {
                    const field = await fieldByLabel(page, labelFor(permission));
                    if (!field) throw new Error('field not present');
                    await field.scrollIntoViewIfNeeded();
                    await field.fill(justification);
                });
            } catch {
                missed.push(permission);
            }
        }
        if (missed.length) {
            console.log(`  (fill by hand from listing.json: ${missed.join(', ')})`);
        }

        if (listing.privacyPolicyUrl) {
            try {
                await step(page, 'privacy policy URL', async () => {
                    const field = await fieldByLabel(page, 'Privacy policy URL');
                    if (!field) throw new Error('field not present on this tab');
                    await field.scrollIntoViewIfNeeded();
                    await field.fill(listing.privacyPolicyUrl);
                });
            } catch {
                console.log('  (set the privacy policy URL by hand)');
            }
        }

        await step(page, 'save privacy draft', async () => {
            await page.getByRole('button', { name: /save draft/i }).first().click();
            await page.waitForTimeout(6000);
        });
    } catch {
        console.log('  (privacy tab needs finishing by hand — text is in listing.json)');
    }

    // --- what is left ------------------------------------------------------
    console.log('\ndraft saved. Not submitted for review — that is deliberate.\n');
    console.log('Blocking the submission until a human does them:');
    if (!listing.privacyPolicyUrl) {
        console.log('  - privacy policy URL (host PRIVACY.md, then set it in the Privacy tab)');
    }
    console.log('  - reviewer test instructions, incl. a funded TESTNET seed phrase');
    console.log('  - check the Privacy tab justifications and the data-usage certifications');
    console.log(`\nitem: ${DASHBOARD}/${itemId || ''}`);

    if (itemId && !listing.itemId) {
        console.log('\nTip: add this to store-assets/listing.json so reruns edit rather than');
        console.log(`create a second listing:   "itemId": "${itemId}"`);
    }

    fs.mkdirSync(path.join(ROOT, 'store-assets/debug'), { recursive: true });
    await page.screenshot({
        path: path.join(ROOT, 'store-assets/debug/final-state.png'),
        fullPage: true,
    });

    await browser.close();
})().catch(error => {
    console.error(`\n${error.message}`);
    console.error('see store-assets/debug/ for a screenshot and the page HTML');
    process.exit(1);
});
