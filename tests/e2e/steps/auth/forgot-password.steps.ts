import { Given, When, Then } from '../fixtures';
import { waitForHydration } from '../../helpers/hydration';

Given('I am on the forgot password page', async ({ page }) => {
  await page.goto('/forgot');
  await waitForHydration(page);
});

When('I enter my email {string}', async ({ page }, email: string) => {
  await page.getByPlaceholder('you@domain.com').fill(email);
});

When('I click the reset password button', async ({ page }) => {
  await page.getByRole('button', { name: /reset password/i }).click();
});

When('I click the cancel button on the forgot password page', async ({ page }) => {
  await page.getByRole('button', { name: /cancel/i }).click();
});

Then('I should see the email sent confirmation', async ({ page }) => {
  await page.locator('h3', { hasText: /email sent/i }).waitFor({ timeout: 10_000 });
});

Then('I should see an email validation error', async ({ page }) => {
  await page.locator('.text-red-500').waitFor({ timeout: 5_000 });
});

Then('I should be on the login page', async ({ page }) => {
  await page.waitForURL('/login');
});
