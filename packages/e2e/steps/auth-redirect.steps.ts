import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given: given, When: when, Then: then } = createBdd();

given('I am not logged in', async ({ page }) => {
  // This test runs in a project with clean storageState — no auth session
});

when('I navigate to the org courses page directly', async ({ page }) => {
  await page.goto('/org/testorg/courses');
});

then('I should be redirected to the login page', async ({ page }) => {
  // The app redirects to /login?redirect=... — wait for URL to contain /login
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});
