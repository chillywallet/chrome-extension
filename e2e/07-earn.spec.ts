/* eslint-disable jest/no-conditional-expect */
/* eslint-disable testing-library/prefer-screen-queries */
import { test, unlockScreen } from './util';

test('earn', async ({ page, extensionId, context }) => {
	await page.goto(`chrome-extension://${extensionId}/home.html`);

	await unlockScreen(page);

	await page.waitForTimeout(3000);

	// Send coin
	await page.locator('text=Earn').click();

	//Choose aprMON
	await page.locator('text=aPriori').first().click();

	await page.locator('text=shMON').last().click();

	//Disable for now since using web
	/*
	//generate 2 digits random amount for testing
	const randomDigits = Math.floor(Math.random() * 90 + 10);
	const monAmount = "0.01" + randomDigits;

	await screenshot(page, 'earn');

	//Enter amount
	await page.locator('input[type="text"]').nth(0).fill(monAmount);

	//Wait for the gas fee to be resolved
	await page.waitForTimeout(2000);

	const stakeBtn = page.locator('text=STAKE').last();
	await expect(stakeBtn).toBeEnabled({
		timeout: 30000
	});
	await stakeBtn.click();

	//Verify the transaction is successful
	await expect(page.locator('text=Success')).toBeVisible();

	await page.locator('text=Close').last().click();

	//Unstake the staked amount
	await page.locator('text=Unstake').first().click();
	await page.waitForTimeout(10000);
	await page.locator('text=100%').last().click();

	//Wait for the gas fee to be resolved
	const unstakeBtn = page.locator('text=UNSTAKE').last();
	await expect(unstakeBtn).toBeEnabled({
		timeout: 30000
	});
	await unstakeBtn.click();

	//Verify the transaction is successful
	await expect(page.locator('text=Success').last()).toBeVisible();
	*/
});