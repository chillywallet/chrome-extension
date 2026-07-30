/* eslint-disable testing-library/prefer-screen-queries */
import { expect, pasteText, screenshot, test } from './util';

/**
 * Backend-free onboarding: GET STARTED → Create Pin Code → import wallet from
 * seed phrase → Home. This spec seeds the shared session used by later specs.
 */
test('onboarding: create pin and import wallet', async ({ page, extensionId }) => {
	const pinCode = process.env.PLAYWRIGHT_PIN_CODE || '';
	const seedPhrase = process.env.PLAYWRIGHT_SEED_PHRASE || '';
	if (!pinCode || !seedPhrase) {
		throw new Error(
			'Please set PLAYWRIGHT_PIN_CODE and PLAYWRIGHT_SEED_PHRASE environment variables',
		);
	}

	await page.goto(`chrome-extension://${extensionId}/home.html`);

	//wait for the page to load
	await page.waitForSelector('button');

	await expect(page.locator('button').first()).toHaveText('Get started');

	//start local onboarding
	await page.locator('button').first().click();

	await page.bringToFront();

	await expect(page.locator('text=Create Pin Code').first()).toBeVisible({
		timeout: 30000,
	});

	//fill both pin code fields
	await page.locator('input[type="password"]').first().fill(pinCode);
	await page.locator('input[type="password"]').last().fill(pinCode);

	await page.locator('text=Continue').click();

	//choose to import rather than create
	await page.getByRole('button', { name: /Import an Existing Wallet/i }).click();

	//click seed phrase button
	await page.getByRole('button', { name: /Seed Phrase/i }).click();

	await screenshot(page, 'before-enter-seed-phrase');

	// The screen renders one input per word (12 by default, 24 behind a toggle).
	// Filling them individually is deterministic; a clipboard paste depends on
	// clipboard permissions in the persistent context.
	const words = seedPhrase.trim().split(/\s+/).filter(Boolean);
	const wordInputs = page.locator('input[type="text"]');
	await expect(wordInputs).toHaveCount(words.length, { timeout: 30000 });

	for (let i = 0; i < words.length; i++) {
		await wordInputs.nth(i).fill(words[i]);
	}

	await screenshot(page, 'after-enter-seed-phrase');

	await page.getByRole('button', { name: /^Continue$/i }).click();

	await page.getByRole('button', { name: /Start Using Wallet/i }).click();

	// Home is reached once the wallet tabs render.
	await expect(page.getByText('Tokens').first()).toBeVisible({
		timeout: 30000,
	});

	await screenshot(page, 'onboarded');
});
