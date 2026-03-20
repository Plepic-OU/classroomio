import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('I am not logged in', async ({ page }) => {
  // Clear any existing session by navigating with a fresh context
  // (Playwright creates a fresh browser context per test by default)
});

When('I try to access the dashboard directly', async ({ page }) => {
  await page.goto('/org/test-org');
  await page.locator('html[theme]').waitFor({ state: 'attached' });
});

Then('I should be redirected to the login page', async ({ page }) => {
  await expect(page).toHaveURL(/\/login/);
});
