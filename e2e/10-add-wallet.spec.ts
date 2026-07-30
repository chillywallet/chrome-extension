/* eslint-disable jest/no-conditional-expect */
/* eslint-disable testing-library/prefer-screen-queries */
import { expect, screenshot, test, unlockScreen } from './util';

test('add-wallet', async ({ page, extensionId, context }) => {
	await page.goto(`chrome-extension://${extensionId}/home.html`);

	await unlockScreen(page);

	await page.waitForTimeout(3000);

	await page.locator('text=Account 1').click();

	await page.locator('text=Add New Wallet').click();

	//get new opened tab
	const newPage = await context.waitForEvent('page');
	await newPage.locator('text=Create a New Wallet').click();

	await screenshot(newPage, 'add-wallet-1.png');

	await newPage.locator('input[type="checkbox"]').click();
	await newPage.locator('text=Continue').click();
	await newPage.locator('text=Start Using Wallet').click();

	await newPage.waitForTimeout(3000);

	await screenshot(newPage, 'new-account');

	await expect(newPage.locator('text=$0.00').first()).toBeVisible();
	await expect(newPage.locator('text=MON').last()).toBeVisible();

	//Delete the newly created wallet
	await newPage.locator('text=Account 2').click();
	await newPage.locator('.wallet-context-menu').last().click();
	await newPage.locator('text=Delete Wallet').click();
	await newPage.locator('#alert-modal button').first().click();
	await expect(newPage.locator('text=Succeeded')).toBeVisible();
});