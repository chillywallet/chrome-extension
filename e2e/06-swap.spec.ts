/* eslint-disable jest/no-conditional-expect */
/* eslint-disable testing-library/prefer-screen-queries */
import { expect, screenshot, test, unlockScreen } from './util';

test('swap', async ({ page, extensionId, context }) => {
	await page.goto(`chrome-extension://${extensionId}/home.html`);

	await unlockScreen(page);

	await page.waitForTimeout(3000);

	// Open Swap from the bottom navigation ("Swap" also appears in the action
	// capsule and on the submit button, so a bare text locator is ambiguous).
	await page.getByTestId('nav-swap').click();

	await page.waitForTimeout(5000);

	//Choose coin
	// await page.locator('text=USDC').first().click();
	// await page.locator('text=CHOG').first().click();

	//generate 2 digits random amount for testing
	const randomDigits = Math.floor(Math.random() * 90 + 10);
	const monAmount = "0.01" + randomDigits;

	//Enter amount
	await page.locator('input[type="text"]').nth(0).fill(monAmount);

	//Wait for the gas fee to be resolved
	await page.waitForTimeout(2000);

	const swapBtn = page.getByTestId('swap-submit');
	await expect(swapBtn).toBeEnabled({
		timeout: 30000
	});
	await swapBtn.click();

	//Verify the transaction is successful
	await expect(page.locator('text=Success')).toBeVisible();

	await page.locator('text=Close').last().click();

	await page.waitForTimeout(1000);

	//Back to home page
	await page.goBack();

	//Go to the Activity screen (transaction history moved out of the wallet tabs)
	await page.getByTestId('nav-activity').click();

	//Verify the transaction is successful
	await expect(page.locator('text=Swapped')).toBeVisible();

	//Refresh the wallet to see the updated balance
	await page.locator('#refresh-wallet').click();

	await screenshot(page, 'after-swap');

	const monAmountFloat = parseFloat(monAmount).toString();
	await expect(page.locator('text=' + monAmountFloat + ' MON').first()).toBeVisible();

	// Wait for the transaction to be processed
	//await page.waitForTimeout(25000);
	//await expect(page.locator('text=-' + monAmount + ' MON')).toBeVisible();
});