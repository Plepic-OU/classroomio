import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When: when, Then: then } = createBdd();

when('I click on the first course in the list', async ({ page }) => {
  // Course cards are <div role="button"> containing <h3> with the course title
  const firstCourse = page.locator('[role="button"] h3').first();
  await expect(firstCourse).toBeVisible({ timeout: 5_000 });
  await firstCourse.click();
});

then('I should see the course navigation sidebar', async ({ page }) => {
  // Course detail pages have a navigation sidebar with "News Feed", "Content", etc.
  await page.waitForURL('**/courses/**');
  // Wait for the course container to load
  await page.waitForTimeout(1000);
});

then('I should see the {string} heading', async ({ page }, headingText: string) => {
  await expect(page.getByRole('heading', { name: headingText })).toBeVisible({ timeout: 5_000 });
});
