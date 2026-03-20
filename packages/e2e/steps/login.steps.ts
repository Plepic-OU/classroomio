import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import 'dotenv/config';

const { Given: given, When: when, Then: then } = createBdd();

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'testuser@classroomio.test';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestPass123!';

given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  // Wait for SvelteKit hydration — fixed delay because networkidle won't resolve (HMR WebSocket)
  await page.waitForTimeout(2000);
});

when('I enter the test user credentials', async ({ page }) => {
  await page.getByPlaceholder('you@domain.com').fill(TEST_USER_EMAIL);
  await page.getByPlaceholder('************').fill(TEST_USER_PASSWORD);
});

when('I enter the test user email with password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('you@domain.com').fill(TEST_USER_EMAIL);
  await page.getByPlaceholder('************').fill(password);
});

then('I should be redirected to the org courses page', async ({ page }) => {
  await page.waitForURL('**/org/**', { timeout: 10_000 });
  await expect(page).toHaveURL(/\/org\/[^/]+/);
});

then('I should see an error message', async ({ page }) => {
  const errorMessage = page.locator('.text-red-500').first();
  await expect(errorMessage).toBeVisible({ timeout: 5_000 });
});
