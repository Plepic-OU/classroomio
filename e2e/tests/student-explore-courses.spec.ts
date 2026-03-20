import { test, expect } from '@playwright/test';

// Student navigates to the Explore page and sees published courses.
// Seed data has multiple published courses visible to students.
test('student explores available courses', async ({ page }) => {
  // Login as student — students redirect to /lms
  await page.goto('/login');
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('you@domain.com').fill('student@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/lms/);

  // Navigate to Explore via sidebar
  await page.getByText('Explore').click();
  await expect(page).toHaveURL(/\/lms\/explore/);

  // Verify the explore page heading
  await expect(page.getByRole('heading', { name: /Explore/i })).toBeVisible();

  // Should see at least one published seed course the student is NOT enrolled in.
  // "Modern Web Development with React" is always available since the student
  // is never enrolled in it by any other test.
  await expect(
    page.getByRole('heading', { name: 'Modern Web Development with React' })
  ).toBeVisible();
});
