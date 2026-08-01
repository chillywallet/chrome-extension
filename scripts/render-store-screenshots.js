/*
 * Renders the Chrome Web Store screenshots.
 *
 *   npm run debug:build            # the extension has to exist first
 *   node scripts/render-store-screenshots.js
 *
 * Drives the real extension in Chromium and captures each screen, then frames
 * the capture on a 1280x800 canvas — the size the store wants, and far wider
 * than a 400px popup, so the raw capture is composited rather than stretched.
 *
 * Runs against the wallet in test-results/session, the same onboarded profile
 * the e2e suite uses, so the screenshots show a throwaway test wallet and never
 * a real balance. Delete that directory to start from onboarding instead.
 *
 * Outputs: store-assets/screenshots/NN-<name>.png
 *
 * Note the launch flags: `headless: false` plus `--headless=new`. Plain headless
 * runs the headless shell, which cannot host an extension at all — the service
 * worker never registers and the extension id can never be resolved.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const EXTENSION = path.join(ROOT, 'build/debug');
const SESSION = path.join(ROOT, 'test-results/session');
const OUT = path.join(ROOT, 'store-assets/screenshots');

require('dotenv').config({ path: path.join(ROOT, '.env.debug') });
const PIN = process.env.PLAYWRIGHT_PIN_CODE;

/**
 * Routes are a HashRouter with hashType="noslash". Screens that only look like
 * themselves once populated get a `prepare` step — an empty swap form or the
 * Explore tab's dapp search say nothing about what the wallet does.
 */
const SHOTS = [
    {
        file: '01-home',
        hash: '',
        caption: 'Your whole portfolio, 40 networks deep',
    },
    {
        file: '02-coin-detail',
        hash: '',
        caption: 'Live prices and charts for every coin',
        prepare: async page => {
            await page.getByTestId('open-explore').click();
            await page.waitForTimeout(1500);
            await page.locator('text=Coins').first().click();
            await page.waitForTimeout(3000);
            await page.locator('text=Bitcoin').first().click();
            await page.waitForTimeout(5000);
        },
    },
    {
        file: '03-swap',
        hash: '#swap',
        caption: 'Swap tokens through an on-chain aggregator',
        prepare: async page => {
            await page.locator('input[type="text"]').nth(0).fill('0.001');
            // Quotes are a network round-trip through the aggregator.
            await page.waitForTimeout(8000);
        },
    },
    {
        file: '04-activity',
        hash: '#activity',
        caption: 'Every transaction, grouped by day',
    },
    {
        // The network picker carries the headline claim better than the settings
        // menu did — it shows the registry rather than asserting it.
        file: '05-networks',
        hash: '',
        caption: 'Switch networks without switching wallets',
        prepare: async page => {
            await page.getByTestId('network-selector').click();
            await page.waitForTimeout(2500);
        },
    },
];

/** The popup's scrollbar is a bright Windows widget that reads as chrome, not UI. */
const HIDE_SCROLLBARS = '::-webkit-scrollbar { width: 0 !important; height: 0 !important; }';

const FRAME_W = 1280;
const FRAME_H = 800;

/** The Frost palette, matched to src/ui/pages.css. */
const framePage = (dataUri, caption) => `
<html><head><style>
    @font-face {
        font-family: 'Space Grotesk';
        src: url('file://${path.join(ROOT, 'extension/fonts/space-grotesk-var.woff2').replace(/\\/g, '/')}') format('woff2');
        font-weight: 100 900;
    }
    html, body { margin: 0; padding: 0; }
    #frame {
        width: ${FRAME_W}px; height: ${FRAME_H}px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 34px;
        background:
            radial-gradient(1100px 620px at 50% -18%, #1B3A57 0%, transparent 62%),
            linear-gradient(168deg, #0B1B2B 0%, #0E2136 52%, #0B1B2B 100%);
        font-family: 'Space Grotesk', system-ui, sans-serif;
    }
    h1 {
        margin: 0; color: #F4FAFD; font-size: 34px; font-weight: 600;
        letter-spacing: -0.7px; text-align: center; max-width: 900px;
    }
    /* Ice underline: the one accent, kept to a single element. */
    .rule {
        width: 74px; height: 3px; border-radius: 2px; margin-top: -18px;
        background: linear-gradient(90deg, #7FD9F5, #4FA8E8);
    }
    .shot {
        border-radius: 20px;
        box-shadow: 0 30px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.09);
        display: block;
    }
</style></head>
<body><div id="frame">
    <h1>${caption}</h1>
    <div class="rule"></div>
    <img class="shot" src="${dataUri}" height="560">
</div></body></html>`;

(async () => {
    if (!fs.existsSync(EXTENSION)) {
        console.error('build/debug missing — run `npm run debug:build` first');
        process.exit(1);
    }
    fs.mkdirSync(OUT, { recursive: true });

    const context = await chromium.launchPersistentContext(SESSION, {
        headless: false,
        args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION}`,
            `--load-extension=${EXTENSION}`,
        ],
        viewport: { width: 400, height: 640 },
        deviceScaleFactor: 2,
        colorScheme: 'dark',
    });

    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    console.log('extension id:', extensionId);

    // The capture context runs at deviceScaleFactor 2 so the popup is crisp, but
    // that would also double the frame to 2560x1600 and the store takes exactly
    // 1280x800. Frame in a separate 1x browser; the captures keep their detail
    // because they are scaled down into the layout.
    const framerBrowser = await chromium.launch();
    const framerContext = await framerBrowser.newContext({
        viewport: { width: FRAME_W, height: FRAME_H },
        deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // The vault relocks between runs. Unlock once up front — the background keeps
    // it open for the rest of the session, so the route loop below stays clean.
    // Enter does not submit this form; the Unlock button has to be clicked, which
    // is what e2e/util.ts does.
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(3000);

    const pin = page.locator('input[type="password"]');
    if ((await pin.count()) > 0 && (await pin.first().isVisible())) {
        if (!PIN) {
            console.error('wallet is locked but PLAYWRIGHT_PIN_CODE is unset in .env.debug');
            process.exit(1);
        }
        await pin.first().fill(PIN);
        await page.locator('button', { hasText: 'Unlock' }).first().click();
        await page.waitForTimeout(4000);

        if ((await pin.count()) > 0 && (await pin.first().isVisible())) {
            console.error('still on the unlock screen — is PLAYWRIGHT_PIN_CODE correct?');
            process.exit(1);
        }
        console.log('unlocked');
    }

    for (const shot of SHOTS) {
        await page.goto(`chrome-extension://${extensionId}/popup.html${shot.hash}`);
        // Holdings and prices arrive over the network; give them time to land so
        // the captures show real content rather than skeletons.
        await page.waitForTimeout(6000);

        if (shot.prepare) {
            try {
                await shot.prepare(page);
            } catch (error) {
                console.error(`  ${shot.file}: prepare step failed — ${error.message}`);
            }
        }

        await page.addStyleTag({ content: HIDE_SCROLLBARS });
        await page.waitForTimeout(400);

        const raw = await page.screenshot();

        // Frame it at store size in a throwaway page rather than stretching the popup.
        const framer = await framerContext.newPage();
        await framer.setContent(
            framePage(`data:image/png;base64,${raw.toString('base64')}`, shot.caption),
        );
        await framer.evaluate(() => document.fonts.ready);
        await framer.waitForTimeout(300);
        const out = path.join(OUT, `${shot.file}.png`);
        await framer.locator('#frame').screenshot({ path: out });
        await framer.close();

        console.log('wrote', path.relative(ROOT, out));
    }

    await framerBrowser.close();
    await context.close();
})().catch(error => {
    console.error(error);
    process.exit(1);
});
