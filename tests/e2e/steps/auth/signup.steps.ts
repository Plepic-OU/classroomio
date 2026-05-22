import { createBdd } from 'playwright-bdd';
import { waitForHydration } from '../../helpers/hydration';

const { Given, When, Then } = createBdd();

Given('I am on the signup page', async ({ page }) => {
  await page.goto('/signup');
  await waitForHydration(page);
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

When('I click the create account button', async ({ page }) => {
  await page.getByRole('button', { name: /create account/i }).click();
});

Then('I should be redirected to the onboarding page', async ({ page }) => {
  await page.waitForURL(/\/onboarding/, { timeout: 10_000 });
});

Then('I should see a password mismatch error', async ({ page }) => {
  await page.getByText('Does not match password').waitFor({ timeout: 5_000 });
});
