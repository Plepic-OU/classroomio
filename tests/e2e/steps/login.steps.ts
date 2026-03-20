import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').waitFor({ state: 'visible' });
});

When('I enter email {string}', async ({ page }, email: string) => {
  await page.locator('input[type="email"]').fill(email);
});

When('I enter password {string}', async ({ page }, password: string) => {
  await page.locator('input[type="password"]').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /log in/i }).click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
  await expect(page).toHaveURL(/\/org\//);
});

Then('I should see a login error message', async ({ page }) => {
  await expect(page.locator('p.text-red-500')).toBeVisible();
});
