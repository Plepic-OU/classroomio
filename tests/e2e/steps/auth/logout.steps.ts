import { expect } from '@playwright/test';
import { Given, When, Then } from '../../fixtures/test';

Given('I am logged in via the admin storage state', async ({ page }) => {
  // The @persona-admin tag selected .auth/admin.json — landing on a protected page proves it.
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/);
});

When('I navigate to {string}', async ({ page }, pathname: string) => {
  await page.goto(pathname);
});

Then('I am redirected to the login page', async ({ page }) => {
  await page.waitForURL(/\/login/);
});
