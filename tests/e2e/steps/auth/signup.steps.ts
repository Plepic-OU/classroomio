import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { waitForHydration } from '../../helpers/hydration';

const { Given, When, Then } = createBdd();

Given('I am on the signup page', async ({ page }) => {
  await page.goto('/signup');
  await waitForHydration(page);
});

Then('I should see the email field', async ({ page }) => {
  await expect(page.getByPlaceholder('you@domain.com')).toBeVisible();
});

Then('I should see the password field', async ({ page }) => {
  await expect(page.getByPlaceholder('************').first()).toBeVisible();
});

Then('I should see the create account button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
});

When('I fill the signup form with email {string} and mismatched passwords', async ({ page }, email: string) => {
  await page.getByPlaceholder('you@domain.com').fill(email);
  await page.getByPlaceholder('************').first().fill('Password123');
  await page.getByPlaceholder('************').nth(1).fill('Different456');
});

When('I submit the signup form', async ({ page }) => {
  await page.getByRole('button', { name: /create account/i }).click();
});

Then('I should see a password validation error', async ({ page }) => {
  // Validation fires client-side; error text renders in the form
  await expect(page.locator('.text-red-500, [class*="error"]').first()).toBeVisible();
});
