import { test, expect } from '@playwright/test';

// Admin updates the organization name via org settings and verifies it persists after reload.
// Uses seed org "Udemy Test" (siteName: udemy-test). Restores the original name at the end
// so the test is idempotent and doesn't disturb other tests that rely on this seed value.

const ORG_SETTINGS_URL = '/org/udemy-test/settings?tab=org';
const ORIGINAL_NAME = 'Udemy Test';
const NEW_NAME = 'Udemy Test Updated';

test('admin updates organization name and verifies it persists after reload', async ({ page }) => {
  // --- Login as admin ---
  await page.goto('/login');
  await page.waitForTimeout(2000); // SvelteKit v1 hydration
  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\/.+/);

  // --- Navigate to Organization settings tab ---
  // domcontentloaded avoids timeout from long-running resources on the settings page
  await page.goto(ORG_SETTINGS_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await expect(page.getByRole('tab', { name: 'Organization' })).toBeVisible();

  // --- Update the organization name ---
  await page.getByLabel('Organization Name').fill(NEW_NAME);
  await page.getByRole('button', { name: 'Update Organization' }).click();
  await expect(page.getByText('Update successful')).toBeVisible();

  // --- Reload and verify the new name persisted ---
  await page.goto(ORG_SETTINGS_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await expect(page.getByLabel('Organization Name')).toHaveValue(NEW_NAME);

  // --- Restore original name (cleanup — keeps test idempotent) ---
  await page.getByLabel('Organization Name').fill(ORIGINAL_NAME);
  await page.getByRole('button', { name: 'Update Organization' }).click();
  await expect(page.getByText('Update successful')).toBeVisible();
});
