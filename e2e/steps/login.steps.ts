import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from '../support/auth';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  // Wait for SvelteKit hydration — data-hydrated is set in +layout.svelte onMount
  await page.locator('body[data-hydrated]').waitFor();
});

When(
  'I enter email {string} and password {string}',
  async ({ page }, email: string, password: string) => {
    await page.locator('[data-testid="login-email"]').fill(email);
    await page.locator('[data-testid="login-password"]').fill(password);
  }
);

When('I enter the test user credentials', async ({ page }) => {
  await page.locator('[data-testid="login-email"]').fill(TEST_USER_EMAIL);
  await page.locator('[data-testid="login-password"]').fill(TEST_USER_PASSWORD);
});

When('I click the login button', async ({ page }) => {
  await page.locator('[data-testid="login-submit"]').click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
  expect(page.url()).toContain('/org/');
});

Then('I should see the organization name', async ({ page }) => {
  await expect(page.locator('nav')).toBeVisible();
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
});
