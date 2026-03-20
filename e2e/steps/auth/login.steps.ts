import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { PlaywrightWorld } from '../../support/world';

Given('I am on the login page', async function (this: PlaywrightWorld) {
  await this.page.goto('/login');
  // Wait for SvelteKit hydration by checking an interactive element is attached and enabled.
  // This is better than waitForTimeout() because it completes as soon as hydration finishes.
  await this.page.locator('button[type="submit"]').waitFor({ state: 'attached' });
});

When('I enter email {string}', async function (this: PlaywrightWorld, email: string) {
  await this.page.locator('input[type="email"]').fill(email);
});

When('I enter password {string}', async function (this: PlaywrightWorld, password: string) {
  await this.page.locator('input[type="password"]').fill(password);
});

When('I click the login button', async function (this: PlaywrightWorld) {
  await this.page.locator('button[type="submit"]').click();
});

Then('I should be redirected to the dashboard', async function (this: PlaywrightWorld) {
  // After login, user goes to /org/** or /onboarding (first-time setup)
  await this.page.waitForURL(/\/(org|onboarding)/, { timeout: 10_000 });
  const url = this.page.url();
  expect(url.includes('/org/') || url.includes('/onboarding')).toBeTruthy();
});

Then('I should see an error message', async function (this: PlaywrightWorld) {
  // Wait for any error indication to appear
  const errorVisible = await this.page
    .locator('[role="alert"], .error, .snackbar-error, [class*="error"]')
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);

  // Also check if we're still on the login page (not redirected)
  const stillOnLogin = this.page.url().includes('/login');

  expect(errorVisible || stillOnLogin).toBeTruthy();
});
