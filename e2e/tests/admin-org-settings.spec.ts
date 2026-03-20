import { test, expect } from '@playwright/test';

// Admin navigates to the org settings page and verifies org info is displayed.
// Uses seed org "Udemy Test" (siteName: udemy-test).
test('admin views org settings page', async ({ page }) => {
  // Login as admin
  await page.goto('/login');
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\/.+/);

  // Navigate to org settings — use domcontentloaded because the settings page
  // has long-running resources that delay the "load" event
  await page.goto('/org/udemy-test/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Verify we're on the settings page with the Settings heading
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // Org name appears multiple times (sidebar, org switcher, profile) — use .first()
  await expect(page.getByText('Udemy Test').first()).toBeVisible();

  // Settings tabs should be present — use tab role to avoid matching other "Profile" elements
  await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Organization' })).toBeVisible();
});
