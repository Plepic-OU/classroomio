import { Given, When, Then } from '../fixtures';
import { waitForLoginHydration } from '../../helpers/hydration';
import { expect } from '@playwright/test';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  await waitForLoginHydration(page);
});

When('I enter email {string}', async ({ page }, email: string) => {
  await page.getByPlaceholder('you@domain.com').fill(email);
});

When('I enter password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\//, { timeout: 15_000 });
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.locator('.text-red-500')).toBeVisible();
});
