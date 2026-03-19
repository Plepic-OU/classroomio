import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When(
  'I enter email {string} and password {string}',
  async ({ page }, email: string, password: string) => {
    await page.getByText('Your email').click();
    await page.locator('input[type="email"]').fill(email);
    await page.getByText('Your password').click();
    await page.locator('input[type="password"]').fill(password);
  }
);

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /log in/i }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**', { timeout: 15000 });
  expect(page.url()).toContain('/org/');
});

Then('I should see the organization name', async ({ page }) => {
  await expect(page.locator('nav')).toBeVisible();
});

Then('I should see an error message', async ({ page }) => {
  await expect(
    page.getByText(/invalid login credentials|must be 6 or more/i)
  ).toBeVisible({ timeout: 10000 });
});
