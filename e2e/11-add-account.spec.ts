/* eslint-disable jest/no-conditional-expect */
/* eslint-disable testing-library/prefer-screen-queries */
import { expect, test, unlockScreen } from './util';

test('add-account', async ({ page, extensionId, context }) => {
	await page.goto(`chrome-extension://${extensionId}/home.html`);

	await unlockScreen(page);

	await page.waitForTimeout(3000);

	await page.locator('text=Account 1').click();

	await page.locator('text=Add New Account').click();

	await page.locator('text=Create').click();

	await page.waitForTimeout(3000);

	await page.mouse.click(10, 10);

	await expect(page.locator('text=Account 2').first()).toBeVisible();
	await expect(page.locator('text=$0.00').first()).toBeVisible();

	await page.locator('text=Account 2').first().click();

	await page.locator('.account-context-menu').last().click();
	await page.locator('text=Delete Account').click();
	await page.locator('#alert-modal button').first().click();
	await expect(page.locator('text=Succeeded')).toBeVisible();
});