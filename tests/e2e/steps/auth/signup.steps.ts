import { Client } from 'pg';
import { expect } from '@playwright/test';
import { Given, When, Then, BeforeScenario, AfterScenario } from '../../helpers/fixtures';

const DB_URL = 'postgresql://postgres:postgres@localhost:54322/postgres';

const createdUserEmails: string[] = [];

async function deleteSignupTestUsers(emails: string[]): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
    for (const email of emails) {
      const res = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
      if (res.rows.length === 0) continue;
      const userId = res.rows[0].id;
      await client.query('DELETE FROM public.analytics_login_events WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM public.profile WHERE id = $1', [userId]);
      await client.query('DELETE FROM auth.users WHERE id = $1', [userId]);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

BeforeScenario(async ({ $testInfo }) => {
  // Clean up any leftover auth user from a previous failed test run.
  const email = `signup+${$testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '-')}@test.com`;
  await deleteSignupTestUsers([email]);
});

AfterScenario(async () => {
  if (createdUserEmails.length === 0) return;
  await deleteSignupTestUsers(createdUserEmails);
  createdUserEmails.length = 0;
});

Given('I am on the signup page', async ({ page }) => {
  await page.goto('/signup');
  await page.locator('input[type="email"]').waitFor();
});

When('I sign up with a unique test email', async ({ page, $testInfo }) => {
  const email = `signup+${$testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '-')}@test.com`;
  createdUserEmails.push(email);
  await page.getByPlaceholder('you@domain.com').fill(email);
});

When('I enter signup password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').first().fill(password);
});

When('I enter signup confirm password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').last().fill(password);
});

When('I submit the signup form', async ({ page }) => {
  await page.getByRole('button', { name: /create account/i }).click();
});

Then('I should be redirected to the onboarding page after signup', async ({ page }) => {
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });
});
