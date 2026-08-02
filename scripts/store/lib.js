/*
 * Shared plumbing for the Chrome Web Store automation.
 *
 * The dashboard lives on chrome.google.com, which Chrome refuses to let *extensions*
 * script ("The extensions gallery cannot be scripted"). Playwright drives the browser
 * over CDP instead of from inside an extension, so that restriction does not apply.
 *
 * Both scripts share one persistent profile at .store-profile/, which is gitignored
 * because it holds live Google session cookies. `npm run store:login` is what puts a
 * session in it; everything else reuses it.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..', '..');
const PROFILE = path.join(ROOT, '.store-profile');
const DEBUG_DIR = path.join(ROOT, 'store-assets/debug');

const DASHBOARD = 'https://chrome.google.com/webstore/devconsole';
const CDP_PORT = Number(process.env.CWS_CDP_PORT || 9222);

/*
 * Why Chrome is started here rather than by Playwright.
 *
 * Launching through Playwright applies --enable-automation, which is what raises
 * the "Chrome is being controlled by automated test software" banner. Google's
 * sign-in refuses that browser outright: "This browser or app may not be secure."
 *
 * The fix is not to hide the automation — defeating a sign-in protection on a real
 * account is not something to automate around. Instead Chrome is started as an
 * ordinary browser with one extra flag, --remote-debugging-port, which enables an
 * API rather than suppressing a check. You sign in in that window through the
 * normal, entirely un-automated flow, and the tooling attaches afterwards to the
 * session you established. Nothing about the sign-in itself is automated.
 */

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
].filter(Boolean);

function chromePath() {
    const found = CHROME_CANDIDATES.find(candidate => fs.existsSync(candidate));
    if (!found) {
        throw new Error(
            'could not find Chrome — set CHROME_PATH to the executable and retry',
        );
    }
    return found;
}

/** Start Chrome detached, with a debugging port and nothing that flags automation. */
function spawnChrome(url = DASHBOARD) {
    fs.mkdirSync(PROFILE, { recursive: true });

    const child = spawn(
        chromePath(),
        [
            `--remote-debugging-port=${CDP_PORT}`,
            `--user-data-dir=${PROFILE}`,
            '--no-first-run',
            '--no-default-browser-check',
            url,
        ],
        { detached: true, stdio: 'ignore' },
    );
    child.unref();
    return child;
}

/** Attach to the Chrome started above. Returns its first browser context. */
async function attach({ timeoutMs = 30000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError;

    while (Date.now() < deadline) {
        try {
            const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
            const context = browser.contexts()[0] ?? (await browser.newContext());
            return { browser, context };
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // The usual cause: a Chrome already open on this profile. A second launch just
    // hands the URL to that instance and exits, so no debugging port is ever opened.
    throw new Error(
        `could not attach to Chrome on port ${CDP_PORT}.\n` +
            `  - run \`npm run store:login\` first, and leave its window open\n` +
            `  - close any other Chrome window using ${PROFILE}\n` +
            `${lastError?.message ?? ''}`,
    );
}

/** True when the dashboard is showing rather than an accounts.google.com interstitial. */
async function isSignedIn(page) {
    if (!page.url().includes('chrome.google.com')) return false;
    const body = await page.textContent('body').catch(() => '');
    return !/Sign in|Verify it.s you|Choose an account/i.test(body ?? '');
}

/**
 * Run a named step, and on failure dump a screenshot plus the page HTML.
 *
 * The dashboard is an unversioned Google app whose DOM shifts without notice, so a
 * failure here usually means a selector moved rather than anything being wrong with
 * the release. The artefacts are what make that quick to fix.
 */
async function step(page, name, fn) {
    process.stdout.write(`  ${name} … `);
    try {
        const result = await fn();
        console.log('ok');
        return result;
    } catch (error) {
        console.log('FAILED');
        fs.mkdirSync(DEBUG_DIR, { recursive: true });
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await page.screenshot({ path: path.join(DEBUG_DIR, `${slug}.png`), fullPage: true });
        fs.writeFileSync(path.join(DEBUG_DIR, `${slug}.html`), await page.content());
        console.error(`\n${error.message}\n`);
        console.error(`wrote store-assets/debug/${slug}.{png,html}`);
        throw error;
    }
}

/** Newest chilly-extension-prod-*.zip in build/, which is what `npm run release` emits. */
function latestPackage() {
    const buildDir = path.join(ROOT, 'build');
    if (!fs.existsSync(buildDir)) return null;

    const zips = fs
        .readdirSync(buildDir)
        .filter(name => /^chilly-extension-prod-.*\.zip$/.test(name))
        .map(name => ({ name, mtime: fs.statSync(path.join(buildDir, name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

    return zips.length ? path.join(buildDir, zips[0].name) : null;
}

function loadListing() {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'store-assets/listing.json'), 'utf8'));
}

function screenshotPaths() {
    const dir = path.join(ROOT, 'store-assets/screenshots');
    return fs
        .readdirSync(dir)
        .filter(name => name.endsWith('.png'))
        .sort()
        .map(name => path.join(dir, name));
}

module.exports = {
    ROOT,
    PROFILE,
    DEBUG_DIR,
    DASHBOARD,
    CDP_PORT,
    chromePath,
    spawnChrome,
    attach,
    isSignedIn,
    step,
    latestPackage,
    loadListing,
    screenshotPaths,
};
