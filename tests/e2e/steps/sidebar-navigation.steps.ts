import { expect } from '@playwright/test';
import { When, Then } from './fixtures';

When('I click {string} in the sidebar', async ({ page }, linkText: string) => {
  await page.getByRole('link', { name: linkText, exact: true }).click();
});

Then('I should be on the courses page', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\/[^/]+\/courses/);
  await expect(page.getByRole('heading', { name: /courses/i })).toBeVisible();
});

Then('I should be on the community page', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\/[^/]+\/community/);
  await expect(page.getByRole('heading', { name: /community/i })).toBeVisible();
});
