import { expect } from '@playwright/test';
import { Given, When, Then } from '../../fixtures/test';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  // Hydration signal per design §4.4: `input[type="email"]` is set by
  // Svelte's `use:typeAction` after CSR hydration (SSR renders type="text").
  // Waiting on `getByRole('textbox')` is insufficient — both SSR and post-
  // hydration states have role=textbox.
  await expect(page.locator('input[type="email"]')).toBeVisible();
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
  await page.waitForURL(/\/org\//);
});

Then('I should see an error message', async ({ page }) => {
  await page.locator('.text-red-500').waitFor();
});
