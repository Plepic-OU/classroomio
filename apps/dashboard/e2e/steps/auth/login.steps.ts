import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter my test credentials', async ({ page }) => {
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL ?? 'admin@test.com');
  await page.locator('input[type="password"]').fill(process.env.TEST_PASSWORD ?? '123456');
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /log in/i }).click();
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/lms|\/org/);
});
