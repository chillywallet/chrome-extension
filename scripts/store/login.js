/*
 * One-time sign-in for the store automation.
 *
 *   npm run store:login
 *
 * Starts Chrome as an ordinary browser — no automation flags, no "controlled by
 * automated test software" banner — pointed at the Developer Dashboard, and waits
 * while you sign in by hand.
 *
 * Nothing here types a password or touches your credentials. The only unusual flag
 * is --remote-debugging-port, which enables an API rather than suppressing any
 * check; the sign-in itself is entirely yours. Once it sees the dashboard, the
 * session is in .store-profile/ and `npm run store:draft` can reuse it.
 *
 * Leave the window open afterwards: store:draft attaches to this same browser.
 */
const { spawnChrome, attach, isSignedIn, DASHBOARD, PROFILE, CDP_PORT } = require('./lib');

const TIMEOUT_MS = 15 * 60 * 1000;
const POLL_MS = 3000;

(async () => {
    console.log('\nStarting Chrome on the Developer Dashboard.');
    console.log('Sign in there as you normally would, including any 2FA.');
    console.log('This script only watches for the dashboard to load.\n');

    spawnChrome(DASHBOARD);

    const { browser, context } = await attach({ timeoutMs: 60000 });
    console.log(`attached on port ${CDP_PORT}\n`);

    const deadline = Date.now() + TIMEOUT_MS;
    let signedIn = false;

    while (Date.now() < deadline) {
        const pages = context.pages();
        if (pages.length === 0) break;

        const page = pages.find(p => p.url().includes('chrome.google.com')) ?? pages[0];
        signedIn = await isSignedIn(page).catch(() => false);
        if (signedIn) break;

        await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }

    if (signedIn) {
        console.log('signed in — session saved to .store-profile/');
        console.log('LEAVE THIS CHROME WINDOW OPEN, then run:  npm run store:draft\n');
    } else {
        console.log('did not detect a signed-in dashboard within the timeout.');
        console.log('If you did sign in, the session is saved anyway — try store:draft.\n');
    }

    // Detach without closing: the window is the session store:draft attaches to.
    await browser.close();
    process.exit(signedIn ? 0 : 1);
})().catch(error => {
    console.error(`\n${error.message}`);
    console.error(`profile: ${PROFILE}`);
    console.error('If Chrome would not start, close any Chrome already using that profile.');
    process.exit(1);
});
