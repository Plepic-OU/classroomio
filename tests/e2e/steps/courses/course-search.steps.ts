import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I search the course list for {string}', async ({ page }, query: string) => {
  // The courses page resets the search field in onMount, so a fill before hydration is discarded.
  const searchInput = page.getByTestId('course-list-search');
  await expect(async () => {
    await searchInput.fill(query);
    await page.waitForURL((url) => url.searchParams.get('search') === query, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
});

Then('I should see the course {string} in the course list', async ({ page }, title: string) => {
  await expect(page.getByRole('link', { name: title })).toBeVisible();
});

Then('I should not see the course {string} in the course list', async ({ page }, title: string) => {
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
});
