/* eslint-disable jest/no-conditional-expect */
/* eslint-disable testing-library/prefer-screen-queries */
import { expect, screenshot, test, unlockScreen } from './util';

test('nad-domains', async ({ page, extensionId, context }) => {
	await page.goto(`chrome-extension://${extensionId}/home.html`);

	await unlockScreen(page);

	//open nad.domains in new tab
	await page.goto('https://app.nad.domains');

	await screenshot(page, 'add-account-nad-domains');

	await page.locator('text=Connect Wallet').click();

	await page.locator('text=Chilly Wallet').click();

	await page.waitForTimeout(5000);

	//get the new opened tab
	const pages = context.pages();
	const newPage = pages[pages.length - 1];

	await screenshot(newPage, 'confirm');

	await newPage.locator('text=Accept').click();

	await expect(newPage.locator('text=Succeeded')).toBeVisible();

	await page.waitForTimeout(5000);

	//generate 6 digits random number for testing
	const randomDigits = Math.floor(Math.random() * 900000 + 100000);
	const nadInput = "e2e-" + randomDigits;

	//search for a domain
	await page.locator('input[type="text"]').fill(nadInput);
	await expect(page.locator('text=Available')).toBeVisible();
	await page.locator('text=' + nadInput + '.nad').click();
	await page.locator('button').nth(1).click();

	await page.waitForTimeout(5000);

	await page.locator('img[src="/ic-wallet-white.svg"]').first().click();

	await page.waitForTimeout(2000);

	await screenshot(page, 'wallet');

	await page.locator('text=Disconnect').last().click();
});