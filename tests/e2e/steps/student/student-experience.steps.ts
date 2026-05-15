import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then } = createBdd();

When('I navigate to the LMS page', async ({ page }) => {
  await page.goto('/lms');
  await page.waitForLoadState('networkidle');
});

Then('I should be on the LMS page', async ({ page }) => {
  await expect(page).toHaveURL(/\/lms/);
});

Then('I should see the my learning section', async ({ page }) => {
  await expect(page.getByRole('link', { name: /my learning/i })
    .or(page.getByText(/my learning/i))).toBeVisible();
});
