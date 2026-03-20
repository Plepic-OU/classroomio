import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

/** Wait for SvelteKit hydration to complete.
 * Carbon's <Theme> component sets `theme` attribute on <html> only client-side.
 * This attribute is absent in SSR HTML, so its presence indicates hydration is done.
 */
async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForSelector('html[theme]', { timeout: 8000 });
}

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);
  await page.waitForSelector('[data-testid="login-email"]');
});

When('I enter email {string}', async ({ page }, email: string) => {
  await page.fill('[data-testid="login-email"]', email);
});

When('I enter password {string}', async ({ page }, password: string) => {
  await page.fill('[data-testid="login-password"]', password);
});

When('I click the login button', async ({ page }) => {
  await page.click('[data-testid="login-submit"]');
});

Then('I should be redirected to the org page', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\//, { timeout: 10_000 });
});

Then('I should see a login error message', async ({ page }) => {
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
});
