/*
 * One-time sign-in for the store automation.
 *
 *   npm run store:login
 *
 * Opens the Developer Dashboard in the dedicated .store-profile/ Chrome profile and
 * waits while you sign in by hand. Nothing here types a password or touches your
 * credentials — it only watches for the dashboard to appear and then saves the
 * profile, so `npm run store:draft` can reuse the session.
 *
 * Close the window when you are done, or leave it and this exits on its own once it
 * sees you are through.
 */
const { launch, isSignedIn, DASHBOARD, PROFILE } = require('./lib');

const TIMEOUT_MS = 15 * 60 * 1000;
const POLL_MS = 3000;

(async () => {
    const context = await launch({ headless: false });
    const page = context.pages()[0] ?? (await context.newPage());

    await page.goto(DASHBOARD).catch(() => {});

    console.log('\nA Chrome window is open on the Developer Dashboard.');
    console.log('Sign in there as you normally would — including any 2FA.');
    console.log('This script is only watching for the dashboard to load.\n');

    const deadline = Date.now() + TIMEOUT_MS;
    let signedIn = false;

    while (Date.now() < deadline) {
        // The user closing the window is a perfectly good way to finish.
        if (context.pages().length === 0) break;

        signedIn = await isSignedIn(page).catch(() => false);
        if (signedIn) break;

        await page.waitForTimeout(POLL_MS);
    }

    if (signedIn) {
        console.log('signed in — session saved to .store-profile/');
        console.log('next: npm run store:draft\n');
    } else {
        console.log('did not detect a signed-in dashboard.');
        console.log('If you did sign in, the session is still saved; just run store:draft.\n');
    }

    await context.close();
    process.exit(signedIn ? 0 : 1);
})().catch(error => {
    console.error(error);
    console.error(`\nprofile: ${PROFILE}`);
    console.error('If Chrome refused to launch, close any Chrome running from this profile.');
    process.exit(1);
});
