import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { waitForHydration } from '../../helpers/hydration';

const { Given, When, Then } = createBdd();

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);
});

When('I enter email {string}', async ({ page }, email: string) => {
  await page.getByTestId('auth-login-email').fill(email);
});

When('I enter password {string}', async ({ page }, password: string) => {
  await page.getByTestId('auth-login-password').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByTestId('auth-login-submit').click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await page.waitForURL(/\/org\//);
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
});
