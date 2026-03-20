import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given: given, Then: then } = createBdd();

given('I am on the student dashboard', async ({ page }) => {
  await page.goto('/lms');
  await page.waitForTimeout(2000);
});

then('I should see a personalized greeting', async ({ page }) => {
  // Greeting is "Good Morning/Afternoon/Evening, Test User!"
  const greeting = page.getByRole('heading', { name: /Good (Morning|Afternoon|Evening).+Test User/i });
  await expect(greeting).toBeVisible({ timeout: 5_000 });
});

then('I should see the progress section', async ({ page }) => {
  // "Your Progress" appears twice on the page — use .first() for strict mode
  await expect(page.getByText('Your Progress').first()).toBeVisible();
});

then('I should see the student sidebar navigation', async ({ page }) => {
  // LMS sidebar has Home, My Learning, and Explore links
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Learning' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore' })).toBeVisible();
});
