import { Given, When, Then } from '../fixtures';
import { expect } from '@playwright/test';
import { userExistsInAuth } from '../../helpers/supabase-admin';
import { waitForLoginHydration } from '../../helpers/hydration';

Given('I am on the signup page', async ({ page, $test }) => {
  // supabase.auth.signUp + 8s polling exceed the 10s default test budget; raise once.
  $test.setTimeout(30_000);
  await page.goto('/signup');
  // Wait for hydration before interacting — otherwise the form's preventDefault
  // hasn't been attached and submit posts natively, never calling handleSubmit.
  await waitForLoginHydration(page);
  await expect(page.getByRole('button', { name: /create account/i })).toBeVisible({ timeout: 15_000 });
});

When('I enter signup email {string}', async ({ page }, email: string) => {
  await page.getByPlaceholder('you@domain.com').fill(email);
});

When('I enter signup password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').first().fill(password);
});

When('I enter confirm password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').last().fill(password);
});

When('I submit the signup form', async ({ page }) => {
  await page.getByRole('button', { name: /create account/i }).click();
});

// The signup UI does not redirect to /login from the root domain (no currentOrg context);
// signUp does create an auth.users row. Verify that directly until the UI flow is reworked.
Then('the user {string} should exist in auth.users', async ({ page }, email: string) => {
  await expect.poll(() => userExistsInAuth(email), { timeout: 8_000, intervals: [250, 500, 1000] }).toBe(true);
});
