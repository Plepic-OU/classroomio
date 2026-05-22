import { expect } from '@playwright/test';
import { Given, When, Then } from '../fixtures';
import { waitForHydration } from '../../helpers/hydration';

Given('I am on the signup page', async ({ page }) => {
  await page.goto('/signup');
  await waitForHydration(page);
});

When('I fill the signup form with a unique email and password {string}', async ({ page }, password: string) => {
  const email = `bdd+${Date.now()}@test.local`;
  await page.getByPlaceholder('you@domain.com').fill(email);
  await page.getByPlaceholder('************').first().fill(password);
  await page.getByPlaceholder('************').nth(1).fill(password);
});

When('I enter signup email {string}', async ({ page }, email: string) => {
  await page.getByPlaceholder('you@domain.com').fill(email);
});

When('I enter signup password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').first().fill(password);
});

When('I enter confirm password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').nth(1).fill(password);
});

When('I click the create account button', async ({ page }) => {
  await page.getByRole('button', { name: /create account/i }).click();
});

Then('I should be redirected to the login page', async ({ page }) => {
  await page.waitForURL('/login', { timeout: 15_000 });
});

Then('the create account button should be disabled', async ({ page }) => {
  await expect(page.getByRole('button', { name: /create account/i })).toBeDisabled();
});

Then('I should see a password validation error', async ({ page }) => {
  await page.locator('.text-red-500').waitFor({ timeout: 5_000 });
});
