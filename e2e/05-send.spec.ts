/* eslint-disable testing-library/prefer-screen-queries */
import { expect, screenshot, test, unlockScreen } from './util';

test('send', async ({ page, extensionId, context }) => {
	await page.goto(`chrome-extension://${extensionId}/home.html`);

	await unlockScreen(page);

	await page.waitForTimeout(3000);

	// Send coin
	await page.locator('text=Send').click();

	//Choose coin
	await page.locator('text=MON').first().click();

	// Enter recipient address
	await page.locator('input[type="text"]').nth(0).fill("feb.nad");

	//Wait for the recipient address to be resolved
	await page.waitForTimeout(3000);

	await screenshot(page, 'after-typing-feb.nad');

	await expect(page.locator('input[type="checkbox"]')).toBeVisible({
		timeout: 30000
	});

	//Uncheck a checkbox
	await page.locator('input[type="checkbox"]').first().uncheck();

	await page.locator('text=Next').last().click();

	await page.waitForTimeout(5000);

	//generate 2 digits random amount for testing
	const randomDigits = Math.floor(Math.random() * 90 + 10);
	const monAmount = "0.001" + randomDigits;

	// Enter amount
	await page.locator('input[type="text"]').nth(0).fill(monAmount);
	//await page.locator('text=Next').last().click();
	const nextBtn = page.locator('text=Next').last();
	await expect(nextBtn).toBeEnabled({
		timeout: 30000
	});
	await nextBtn.click();

	//Wait for the gas fee to be resolved
	await page.waitForTimeout(3000);

	const confirmBtn = page.getByRole('button', { name: 'Send' });
	await expect(confirmBtn).toBeEnabled({
		timeout: 30000
	});
	await confirmBtn.click();

	//Verify the transaction is successful
	await expect(page.locator('text=Sent')).toBeVisible({
		timeout: 30000
	});

	await page.waitForTimeout(5000);
	await page.locator('#refresh-wallet').click();

	await screenshot(page, 'after-send');

	const monAmountTrim = parseFloat(monAmount).toString();
	await expect(page.locator('text=' + monAmountTrim + ' MON').first()).toBeVisible();

	// await expect(page.locator('text=Out').first()).toBeVisible();
	// await expect(page.locator('text=-' + monAmount + ' MON')).toBeVisible();
});