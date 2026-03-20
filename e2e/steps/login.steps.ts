import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  // autoFocus on the email field fires via onMount — waiting for :focus confirms SvelteKit hydration
  await page.waitForSelector('[name="email"]:focus');
});

When('I enter admin credentials', async ({ page }) => {
  await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
});

When('I enter student credentials', async ({ page }) => {
  await page.fill('[name="email"]', process.env.TEST_STUDENT_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_STUDENT_PASSWORD!);
});

When('I enter invalid credentials', async ({ page }) => {
  await page.fill('[name="email"]', 'bad@test.com');
  await page.fill('[name="password"]', 'wrongpassword');
});

When('I submit the login form', async ({ page }) => {
  await page.click('[type="submit"]');
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
});

Then('I should be redirected to the student portal', async ({ page }) => {
  await page.waitForURL('**/lms');  // students land on /lms (no trailing segment)
});

Then('I should see an error message', async ({ page }) => {
  await page.waitForSelector('[data-testid="error-message"]');
});
