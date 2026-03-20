import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given } = createBdd(test);

Given('I am logged in as a student', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('student@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(/\/(lms|org)/);
});
