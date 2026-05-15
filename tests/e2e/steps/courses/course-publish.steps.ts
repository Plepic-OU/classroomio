import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Then } = createBdd();

Then('I should see the publish toggle', async ({ page }) => {
  // The settings page has a "Publish Course" section header
  await expect(page.getByText(/publish course/i)).toBeVisible();
});

Then('the publish toggle should be in the unpublished state', async ({ page }) => {
  // New courses default to unpublished; the toggle label "Unpublished" is visible
  await expect(page.getByText(/unpublished/i)).toBeVisible();
});
