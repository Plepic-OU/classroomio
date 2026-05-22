import { expect } from '@playwright/test';
import { Given, When, Then } from '../fixtures';

Given('I am on the reset password page', async ({ page }) => {
  await page.goto('/reset');
  await page.locator('input[type="password"]').first().waitFor({ timeout: 15_000 });
});

When('I enter new password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').first().fill(password);
});

When('I enter confirm new password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').nth(1).fill(password);
});

When('I click the reset password submit button', async ({ page }) => {
  await page.getByRole('button', { name: /reset password/i }).click();
});

Then('the reset password button should be disabled', async ({ page }) => {
  await expect(page.getByRole('button', { name: /reset password/i })).toBeDisabled();
});
