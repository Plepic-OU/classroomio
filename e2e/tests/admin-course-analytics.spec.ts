import { test, expect } from '@playwright/test';

// Admin navigates to a course's Analytics page and verifies it loads.
// Uses seed course "Data Science with Python and Pandas" which has enrolled students.
test('admin views course analytics page', async ({ page }) => {
  // Login as admin
  await page.goto('/login');
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\/.+/);

  // Navigate directly to the Data Science course's analytics page
  const courseId = 'f0a85d18-aff4-412f-b8e6-3b34ef098dce';
  await page.goto(`/courses/${courseId}/analytics`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Verify the analytics heading is visible
  await expect(page.getByRole('heading', { name: /Analytics/i })).toBeVisible();
});
