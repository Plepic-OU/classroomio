import { expect } from '@playwright/test';
import { Given, Then } from '../../helpers/fixtures';

Given('I navigate to my learning page', async ({ page }) => {
  // Full page load at /lms triggers INITIAL_SESSION → getProfile (1 s debounce).
  // getProfile detects student role and calls goto('/lms') — a no-op since we're already here.
  // We wait for the profile name to appear, which confirms getProfile has settled,
  // before using the sidebar link (SPA nav) so getProfile won't fire again.
  await page.goto('/lms');
  await page.waitForURL(/\/lms/);
  await page.getByText('John Doe').first().waitFor({ timeout: 8_000 });
  await page.getByRole('link', { name: /my learning/i }).click();
  await page.waitForURL(/\/lms\/mylearning/);
});

Then('I should see the My Learning heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'My Learning' })).toBeVisible();
});

Then('I should see no courses in progress', async ({ page }) => {
  await expect(page.getByText('No Course In progress')).toBeVisible();
});
