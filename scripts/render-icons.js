/*
 * Regenerates the Chilly app icons.
 *
 *   node scripts/render-icons.js
 *
 * Two marks, four finishes. Classic is the original flat penguin silhouette and
 * remains the brand default; the other three use a more detailed penguin (belly,
 * beak, eyes). The SVGs in src/assets/images/ are written from the geometry below
 * (so they can never drift apart), then rasterised with the puppeteer Chromium
 * that is already a dev dependency.
 *
 * Outputs:
 *   src/assets/images/icon-chilly-{classic,frost,aurora,midnight}.{svg,png}  — the picker
 *   extension/images/icon-{16,32,48,128}.png                                 — the manifest
 *   src/assets/images/logo-chilly-white{,-text}.png                          — dark-surface wordmarks
 *   src/assets/images/logo-chilly-color-text.png                             — light-surface wordmark
 *
 * DEFAULT_VARIANT drives the manifest set and the wordmarks, so the toolbar icon
 * and the logo in the app can never diverge. The EIP-6963 icon that dapps see is
 * the same geometry, inlined as a data URI in src/InPage.tsx — regenerate that by
 * hand from the matching SVG if the default ever changes.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src/assets/images');
const EXT = path.join(ROOT, 'extension/images');

// The original mark: one flat silhouette, no interior detail.
const CLASSIC_BODY =
    'M24 9c-5 0-8.5 4.4-8.5 10.2 0 3.1-.9 5-2.5 7.1-1.2 1.6-.9 3.4.8 3.9' +
    '-.4 3.7 1.7 8.8 10.2 8.8s10.6-5.1 10.2-8.8c1.7-.5 2-2.3.8-3.9' +
    '-1.6-2.1-2.5-4-2.5-7.1C32.5 13.4 29 9 24 9z';

// Detailed mark: head and body, with flipper flares at the shoulders.
const BODY =
    'M24 8c6.4 0 10.9 5.4 10.9 12.9 0 4 1 6.2 2.1 8.9.8 2-.5 3.3-1.9 2.7' +
    '-.2 3.7-4.2 7.5-11.1 7.5s-10.9-3.8-11.1-7.5c-1.4.6-2.7-.7-1.9-2.7 ' +
    '1.1-2.7 2.1-4.9 2.1-8.9C13.1 13.4 17.6 8 24 8z';
const BELLY = 'M24 21.4c4.1 0 7.4 4 7.4 8.9s-3.3 8-7.4 8-7.4-3.1-7.4-8 3.3-8.9 7.4-8.9z';
const BEAK = 'M21.3 19.6h5.4L24 24.1z';
const EYES = [
    { cx: 20.4, cy: 16.6 },
    { cx: 27.6, cy: 16.6 },
];
const EYE_R = 1.55;
const CORAL = '#F58A3C';

const AURORA_DEF =
    '<defs><linearGradient id="aurora" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#69C4EE"/><stop offset="1" stop-color="#7FE8C1"/></linearGradient></defs>';

const DEFAULT_VARIANT = 'classic';

const VARIANTS = {
    // Classic keeps the original silhouette, so it takes no belly/beak/eye values.
    classic: { tile: '#152B40', body: '#69C4EE', classic: true },
    frost: { tile: '#152B40', body: '#69C4EE', belly: '#DCF1FB', eye: '#152B40' },
    // Aurora inverts the mark, so its eyes take the light value to stay visible on the navy body.
    aurora: { tile: 'url(#aurora)', body: '#0F2233', belly: '#DCF1FB', eye: '#DCF1FB' },
    midnight: { tile: '#0B1826', body: '#DCF1FB', belly: '#69C4EE', eye: '#0B1826' },
};

function buildSvg(name, c) {
    // Midnight adds a hairline ring so the near-black tile keeps an edge on dark chrome.
    const ring =
        name === 'midnight'
            ? '<rect x="1.5" y="1.5" width="45" height="45" rx="10.5" fill="none" stroke="#2A4159" stroke-width="1.5"/>'
            : '';
    const mark = c.classic
        ? `<path d="${CLASSIC_BODY}" fill="${c.body}"/>`
        : `<path d="${BODY}" fill="${c.body}"/>` +
          `<path d="${BELLY}" fill="${c.belly}"/>` +
          `<path d="${BEAK}" fill="${CORAL}"/>` +
          EYES.map(e => `<circle cx="${e.cx}" cy="${e.cy}" r="${EYE_R}" fill="${c.eye}"/>`).join('');

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
        (name === 'aurora' ? AURORA_DEF : '') +
        `<rect width="48" height="48" rx="12" fill="${c.tile}"/>` +
        ring +
        mark +
        '</svg>\n'
    );
}

/** Wordmark: the default mark plus "Chilly Wallet" set in the bundled display face. */
function buildWordmark(markSvg, { text, withText, fontDataUri }) {
    const MARK = 96;
    return (
        `<html><head><style>` +
        `@font-face{font-family:'Space Grotesk';font-weight:300 700;src:url(${fontDataUri}) format('woff2')}` +
        `*{margin:0;padding:0;box-sizing:border-box}` +
        `body{background:transparent}` +
        `#logo{display:inline-flex;align-items:center;gap:20px;padding:0}` +
        `#logo svg{width:${MARK}px;height:${MARK}px;display:block}` +
        `#logo span{font-family:'Space Grotesk';font-size:60px;font-weight:600;` +
        `letter-spacing:-1px;line-height:1;color:${text};white-space:nowrap;padding-bottom:4px}` +
        `</style></head><body><div id="logo">${markSvg}` +
        (withText ? '<span>Chilly Wallet</span>' : '') +
        `</div></body></html>`
    );
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    const render = async (svg, size, out) => {
        await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
        await page.setContent(
            `<html><body style="margin:0;padding:0;background:transparent">` +
                `<div style="width:${size}px;height:${size}px">${svg}</div></body></html>`,
        );
        const el = await page.$('div');
        await el.screenshot({ path: out, omitBackground: true });
        console.log('wrote', path.relative(ROOT, out));
    };

    let defaultSvg = '';

    for (const [name, colors] of Object.entries(VARIANTS)) {
        const svg = buildSvg(name, colors);
        if (name === DEFAULT_VARIANT) defaultSvg = svg;
        fs.writeFileSync(path.join(SRC, `icon-chilly-${name}.svg`), svg);
        console.log('wrote', path.relative(ROOT, path.join(SRC, `icon-chilly-${name}.svg`)));

        // The picker and chrome.action.setIcon both take a single 128px source.
        const scaled = svg.replace('<svg ', '<svg width="100%" height="100%" ');
        await render(scaled, 128, path.join(SRC, `icon-chilly-${name}.png`));

        if (name === DEFAULT_VARIANT) {
            for (const size of [16, 32, 48, 128]) {
                await render(scaled, size, path.join(EXT, `icon-${size}.png`));
            }
        }
    }

    // Wordmarks. The display face is inlined so the render never depends on a
    // font being installed on the machine running this script.
    const fontDataUri =
        'data:font/woff2;base64,' +
        fs.readFileSync(path.join(ROOT, 'extension/fonts/space-grotesk-var.woff2')).toString('base64');

    const WORDMARKS = [
        { file: 'logo-chilly-white.png', text: '#F4FAFD', withText: false },
        { file: 'logo-chilly-white-text.png', text: '#F4FAFD', withText: true },
        { file: 'logo-chilly-color-text.png', text: '#152B40', withText: true },
    ];

    for (const w of WORDMARKS) {
        await page.setViewport({ width: 900, height: 200, deviceScaleFactor: 1 });
        await page.setContent(buildWordmark(defaultSvg, { ...w, fontDataUri }));
        await page.evaluate(() => document.fonts.ready);
        const el = await page.$('#logo');
        const out = path.join(SRC, w.file);
        await el.screenshot({ path: out, omitBackground: true });
        console.log('wrote', path.relative(ROOT, out));
    }

    await browser.close();
})().catch(e => {
    console.error(e);
    process.exit(1);
});
