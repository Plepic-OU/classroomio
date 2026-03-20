import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { When, Then } = createBdd(test);

When('I navigate to the my learning page', async ({ page }) => {
  // Navigate via sidebar link to preserve Svelte stores
  await page.getByRole('link', { name: /my learning/i }).click();
  await expect(page).toHaveURL(/\/lms\/mylearning/, { timeout: 10000 });
});

Then('I should see the course {string}', async ({ page }, courseTitle: string) => {
  await expect(page.getByText(courseTitle).first()).toBeVisible({ timeout: 10000 });
});
