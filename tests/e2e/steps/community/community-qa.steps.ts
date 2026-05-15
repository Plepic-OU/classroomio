import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then } = createBdd();

When('I navigate to the org community page', async ({ page }) => {
  const orgSlug = page.url().match(/\/org\/([^/?#]+)/)?.[1] ?? '*';
  await page.goto(`/org/${orgSlug}/community`);
  await page.waitForLoadState('networkidle');
});

Then('I should be on the community page', async ({ page }) => {
  await expect(page).toHaveURL(/\/community/);
});
