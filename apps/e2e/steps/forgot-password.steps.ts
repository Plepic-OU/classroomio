import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

// "I am on the login page" is already defined in login.steps.ts

When('I click the forgot password link', async ({ page }) => {
  await page.getByRole('link', { name: /forgot password/i }).click();
  await expect(page).toHaveURL(/\/forgot/);
  await page.locator('html[theme]').waitFor({ timeout: 10000 });
});

When('I enter my email for password reset {string}', async ({ page }, email: string) => {
  await page.getByLabel('Your email').fill(email);
});

When('I click the reset password button', async ({ page }) => {
  await page.getByRole('button', { name: /reset password/i }).click();
});

Then('I should see the email sent confirmation', async ({ page }) => {
  await expect(page.getByText('Email Sent!')).toBeVisible({ timeout: 10000 });
});
