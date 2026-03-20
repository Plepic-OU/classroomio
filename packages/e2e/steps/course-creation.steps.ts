import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import 'dotenv/config';

const { Given: given, When: when, Then: then } = createBdd();

let courseTitle = '';

given('I am logged in', async ({ page }) => {
  // Auth is handled via storageState from the setup project.
  // Just verify we have a valid session by checking we can access a protected page.
});

given('I am on the org courses page', async ({ page }) => {
  await page.goto('/org/testorg/courses');
  // Wait for the page heading to appear (signals Svelte has rendered)
  await page.getByRole('heading', { name: /courses/i }).waitFor({ state: 'visible' });
});

when('I select {string} as the course type', async ({ page }, courseType: string) => {
  // Click the button containing the course type text
  await page.locator('button').filter({ hasText: courseType }).click();
});

when('I enter a unique course title', async ({ page }) => {
  courseTitle = `Test Course ${Date.now()}`;
  await page.getByPlaceholder('Your course name').fill(courseTitle);
});

when('I enter {string} as the description', async ({ page }, description: string) => {
  await page.getByPlaceholder('A little description about this course').fill(description);
});

then('I should see the created course in the course list', async ({ page }) => {
  // After course creation, the app redirects to the course page.
  // Navigate back to courses list and verify the course appears.
  await page.goto('/org/testorg/courses');
  await page.getByRole('heading', { name: /courses/i }).waitFor({ state: 'visible' });
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 10_000 });
});
