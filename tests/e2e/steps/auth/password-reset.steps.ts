import { Given, When, Then } from '../fixtures';
import { waitForEmail, extractLink } from '../../helpers/inbucket';
import { waitForLoginHydration } from '../../helpers/hydration';
import { expect } from '@playwright/test';

Given('I am on the forgot password page', async ({ page, $test }) => {
  // Supabase Auth issues an SMTP send for password resets; the full happy path also
  // round-trips through Inbucket. 10s is not enough — extend for this scenario only.
  $test.setTimeout(60_000);
  await page.goto('/forgot');
  // CRITICAL: without waiting for hydration, the form's `on:submit|preventDefault`
  // handler isn't attached when we click submit — the form posts natively to /forgot?
  // and handleSubmit never runs. Confirmed via trace: zero /auth/v1/recover calls.
  await waitForLoginHydration(page);
  await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible({ timeout: 15_000 });
});

When('I enter the reset email {string}', async ({ page }, email: string) => {
  await page.getByPlaceholder('you@domain.com').fill(email);
});

When('I submit the password reset form', async ({ page }) => {
  await page.getByRole('button', { name: /reset password/i }).click();
});

Then('I should see the email sent confirmation', async ({ page }) => {
  await expect(page.getByText(/email sent/i)).toBeVisible({ timeout: 15_000 });
});

When('I follow the reset link from the {string} inbox', async ({ page }, localpart: string) => {
  const message = await waitForEmail(localpart, { subject: /reset|password/i, timeout: 15_000 });
  const link = extractLink(message.body, /https?:\/\/\S+\/reset\S*/);
  await page.goto(link);
  await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible({ timeout: 15_000 });
});

When('I enter new password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').first().fill(password);
});

When('I enter confirm new password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').last().fill(password);
});

When('I submit the new password form', async ({ page }) => {
  await page.getByRole('button', { name: /reset password/i }).click();
});

Then('I should be redirected to the login page', async ({ page }) => {
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await waitForLoginHydration(page);
});
