import { expect } from '@playwright/test';
import { When, Then } from '../../fixtures/test';

When('I land on the admin org dashboard', async ({ page }) => {
  await page.goto('/');
  // The storageState redirects an authenticated admin to /org/<slug>/...
  await page.waitForURL(/\/org\//);
});

When('I reload the page', async ({ page }) => {
  await page.reload();
});

Then('I am still on the admin org dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\//);
});

Then('I am not redirected to the login page', async ({ page }) => {
  await expect(page).not.toHaveURL(/\/login/);
});
