import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then } = createBdd();

When('I navigate to the org settings team tab', async ({ page }) => {
  // After login, URL is /org/{slug}. Navigate to settings and select team tab.
  const orgSlug = page.url().match(/\/org\/([^/?#]+)/)?.[1] ?? '*';
  await page.goto(`/org/${orgSlug}/settings?tab=org`);
  await page.waitForLoadState('networkidle');
});

Then('I should see the invite email field', async ({ page }) => {
  await expect(page.getByPlaceholder(/email comma separated/i)).toBeVisible();
});

Then('I should see the send invite button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /send invite/i })).toBeVisible();
});
