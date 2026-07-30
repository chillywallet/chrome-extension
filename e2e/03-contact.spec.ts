/* eslint-disable jest/no-conditional-expect */
/* eslint-disable testing-library/prefer-screen-queries */
import { expect, screenshot, test, unlockScreen } from './util';

test('contact', async ({ page, extensionId, context }) => {
	await page.goto(`chrome-extension://${extensionId}/home.html`);

	await unlockScreen(page);

	await page.waitForTimeout(3000);

	//Go to Contacts screen
	await page.locator('#home-context-menu').click();
	await page.locator('text=Contacts').click();

	// Contact screen
	await expect(page.locator("text=My Contacts").first()).toBeVisible({
		timeout: 30000
	});
	await screenshot(page, 'contact-main');

	// Add a new contact
	await page.locator('text=ADD CONTACT').click();
	await page.locator('input[type="text"]').first().fill("0xF7f484A99cf8535B30b5033A245C28A2E2bD875E");
	await page.locator('input[type="text"]').last().fill("Test Contact");
	await page.locator('text=Add').last().click();
	await page.waitForTimeout(1000);

	const alreadyExists = await page.locator('text=The contact name already exists.').isVisible();
	if (alreadyExists) {
		await page.locator('text=Close').click();
	}

	// Verify the contact is added
	await page.locator('input[type="search"]').first().fill("Test Con");
	await expect(page.locator('text=Test Contact')).toBeVisible();

	await screenshot(page, 'contact-added');

	// Click on the contact to view details
	await page.locator('text=Test Contact').click();

	//Delete the contact
	await page.locator('#contact-modal button').nth(1).click();

	//Should see a confirmation dialog
	await expect(page.locator('text=Are you sure you want to delete this contact?')).toBeVisible();
	await page.locator('#alert-modal button').first().click();
});