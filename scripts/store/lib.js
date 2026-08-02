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
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..', '..');
const PROFILE = path.join(ROOT, '.store-profile');
const DEBUG_DIR = path.join(ROOT, 'store-assets/debug');

const DASHBOARD = 'https://chrome.google.com/webstore/devconsole';

/**
 * Launch the shared profile.
 *
 * Uses `channel: 'chrome'` — the real Chrome install, not Playwright's bundled
 * Chromium. Google is markedly more willing to complete a sign-in in real Chrome,
 * and the profile is a normal Chrome profile as a result. No anti-detection flags
 * are set; if Google declines to sign in here, upload by hand rather than trying
 * to look less automated.
 */
async function launch({ headless = false } = {}) {
    fs.mkdirSync(PROFILE, { recursive: true });

    return chromium.launchPersistentContext(PROFILE, {
        channel: 'chrome',
        headless,
        viewport: { width: 1440, height: 900 },
        args: ['--no-first-run', '--no-default-browser-check'],
    });
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
    launch,
    isSignedIn,
    step,
    latestPackage,
    loadListing,
    screenshotPaths,
};
