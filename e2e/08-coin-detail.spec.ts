/* eslint-disable jest/no-conditional-expect */
/* eslint-disable testing-library/prefer-screen-queries */
import { expect, test, unlockScreen } from './util';

test('coin-detail', async ({ page, extensionId, context }) => {
	await page.goto(`chrome-extension://${extensionId}/home.html`);

	await unlockScreen(page);

	await page.waitForTimeout(3000);

	// Explore screen
	await page.locator('text=Explore').click();

	await page.locator('text=Coins').click();

	await page.locator('text=Bitcoin').first().click();

	// Wait for the Bitcoin coin detail page to load
	await page.waitForTimeout(3000);

	// Verify the Bitcoin coin detail page is displayed
	await expect(page.locator('text=Bitcoin')).toBeVisible();

	// check if the price is not $0.00
	await expect(page.locator('#chart-price')).not.toHaveText('$0.00');
});