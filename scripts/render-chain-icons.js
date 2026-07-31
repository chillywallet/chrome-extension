/*
 * Renders the network badges used by the chain registry.
 *
 *   node scripts/render-chain-icons.js
 *
 * Every entry in src/config/chains.ts needs an `icon`. The chains that predate
 * this script ship real brand logos in src/assets/images/; the ones added since
 * use a generated badge instead — a monogram on the chain's brand colour, in the
 * bundled Space Grotesk so the render never depends on a font being installed.
 *
 * These are deliberately *not* official logos. Shipping third-party marks would
 * mean vendoring assets we have no licence to redistribute, so the badge is a
 * neutral stand-in that still reads as distinct at 24px. Drop a real logo into
 * src/assets/images/ and point Images.tsx at it to replace one.
 *
 * Outputs: src/assets/images/chain-{key}.png (128px, transparent corners)
 *
 * The BADGES table below is the source of truth for the generated set. Keep the
 * keys in step with the `icon` fields in src/config/chains.ts.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src/assets/images');

/** key -> [monogram, brand colour]. Monograms are capped at 4 glyphs to stay legible at 24px. */
const BADGES = {
    optimism: ['OP', '#FF0420'],
    zksync: ['ZK', '#1E69FF'],
    scroll: ['SCR', '#EBC28E'],
    zora: ['ZORA', '#2B6DEF'],
    mode: ['MODE', '#DFFE00'],
    metis: ['MTS', '#00DACC'],
    ink: ['INK', '#7132F5'],
    soneium: ['SONE', '#8C8C94'],
    lisk: ['LSK', '#4070F4'],
    aurora: ['AUR', '#70D44B'],
    gnosis: ['GNO', '#3E6957'],
    celo: ['CELO', '#FCFF52'],
    unichain: ['UNI', '#F50DB4'],
    bob: ['BOB', '#F25D00'],
    degen: ['DGN', '#A36EFD'],
    plume: ['PLM', '#E4572E'],
    taiko: ['TKO', '#E81899'],
    worldchain: ['WLD', '#6B7280'],
    linea: ['LNA', '#61DFFF'],
    blast: ['BLST', '#FCFC03'],
    mantle: ['MNT', '#65B3AE'],
    opbnb: ['oBNB', '#F0B90B'],
    sonic: ['S', '#FE9A4D'],
    berachain: ['BERA', '#C4711F'],
    sei: ['SEI', '#B4342E'],
    apechain: ['APE', '#0054FA'],
    hyperevm: ['HYPE', '#97FCE4'],
    katana: ['KAT', '#C8102E'],
    plasma: ['XPL', '#2ECC8F'],
    abstract: ['ABS', '#04D361'],
    moonbeam: ['GLMR', '#E1147B'],
    moonriver: ['MOVR', '#F2A007'],
    xdc: ['XDC', '#F49200'],
};

/** Relative luminance (WCAG) — picks ink vs. white so every badge stays readable. */
function textColorFor(hex) {
    const channel = index => {
        const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
    return luminance > 0.45 ? '#0B1B2B' : '#F4FAFD';
}

function buildBadge(monogram, color, fontDataUri) {
    // Font size steps down as the monogram grows so 4-glyph marks still fit the disc.
    const fontSize = { 1: 60, 2: 50, 3: 38, 4: 30 }[monogram.length] ?? 30;
    return (
        `<html><head><style>` +
        `@font-face{font-family:'Space Grotesk';src:url(${fontDataUri}) format('woff2');font-weight:100 900}` +
        `html,body{margin:0;padding:0;background:transparent}` +
        `#badge{width:128px;height:128px;border-radius:50%;display:flex;align-items:center;` +
        `justify-content:center;background:radial-gradient(circle at 32% 26%,` +
        `${color}FF 0%,${color}E0 55%,${color}B8 100%);` +
        `box-shadow:inset 0 0 0 2px rgba(255,255,255,.16)}` +
        `span{font-family:'Space Grotesk';font-weight:700;font-size:${fontSize}px;` +
        `letter-spacing:-1px;line-height:1;color:${textColorFor(color)};` +
        `font-variant-numeric:tabular-nums}` +
        `</style></head><body><div id="badge"><span>${monogram}</span></div></body></html>`
    );
}

(async () => {
    const fontDataUri =
        'data:font/woff2;base64,' +
        fs
            .readFileSync(path.join(ROOT, 'extension/fonts/space-grotesk-var.woff2'))
            .toString('base64');

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 128, height: 128, deviceScaleFactor: 1 });

    for (const [key, [monogram, color]] of Object.entries(BADGES)) {
        await page.setContent(buildBadge(monogram, color, fontDataUri));
        await page.evaluate(() => document.fonts.ready);
        const el = await page.$('#badge');
        const out = path.join(SRC, `chain-${key}.png`);
        await el.screenshot({ path: out, omitBackground: true });
        console.log('wrote', path.relative(ROOT, out));
    }

    await browser.close();
})().catch(error => {
    console.error(error);
    process.exit(1);
});
