import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  // Wait for Svelte hydration — theme attr is set by JS after hydration
  await page.locator('html[theme]').waitFor({ timeout: 10000 });
});

When(
  'I enter email {string} and password {string}',
  async ({ page }, email: string, password: string) => {
    await page.locator('[data-testid="login-email"]').fill(email);
    await page.locator('[data-testid="login-password"]').fill(password);
  }
);

When('I click the login button', async ({ page }) => {
  await page.locator('[data-testid="login-submit"]').click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**', { timeout: 15000 });
  expect(page.url()).toContain('/org/');
});

Then('I should see the organization name', async ({ page }) => {
  await expect(page.locator('nav')).toBeVisible();
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible({
    timeout: 10000,
  });
});
