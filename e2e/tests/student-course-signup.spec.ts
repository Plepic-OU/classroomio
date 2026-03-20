import { test, expect } from '@playwright/test';

// Student enrollment: login → invite link → join course → lands on /lms.
// Uses seed student (student@test.com) joining seed course (Getting started with MVC).
// Multiple Supabase writes (group member + notifications) need extra time.
test('student signs up to a course via invite link', async ({ page }) => {
  // Login as student — students redirect to /lms, not /org/...
  await page.goto('/login');
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('you@domain.com').fill('student@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/lms/);

  // Navigate to student invite link for "Getting started with MVC"
  // Hash = base64(JSON.stringify({ id, name, description, orgSiteName }))
  const inviteHash = btoa(
    JSON.stringify({
      id: '98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e',
      name: 'Getting started with MVC',
      description: 'MVC architecture course',
      orgSiteName: 'udemy-test'
    })
  );
  await page.goto(`/invite/s/${encodeURIComponent(inviteHash)}`);
  await page.waitForTimeout(2000);

  // Verify course info is displayed
  await expect(page.getByText('Getting started with MVC')).toBeVisible();

  // Join the course
  await page.getByRole('button', { name: 'Join Course' }).click();

  // After joining, app redirects to /lms
  await expect(page).toHaveURL(/\/lms/);
});
