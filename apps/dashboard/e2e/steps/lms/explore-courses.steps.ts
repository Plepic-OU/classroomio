import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { When, Then } = createBdd(test);

When('I navigate to the explore page', async ({ page }) => {
  // Navigate via sidebar link to preserve Svelte stores (page.goto resets them)
  await page.getByRole('link', { name: /explore/i }).click();
  await expect(page).toHaveURL(/\/lms\/explore/, { timeout: 10000 });
});

Then('I should see available courses to enroll in', async ({ page }) => {
  // Wait for course cards to render — verify a known seeded course title appears
  await expect(page.getByText('Modern Web Development with React')).toBeVisible({ timeout: 15000 });
});
