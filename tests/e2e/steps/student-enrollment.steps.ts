import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

const STUDENT_ID = '0c256e75-aa40-4f62-8d30-0217ca1c60d9'; // student@test.com

Given(
  'I am logged in as a student with the waitlist reset for {string}',
  async ({ page }, courseTitle: string) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    };
    // Ensure the course has allowNewStudent:true so the Enroll Now button is enabled.
    const courseRes = await fetch(
      `http://localhost:54321/rest/v1/course?title=eq.${encodeURIComponent(courseTitle)}&select=id,metadata`,
      { headers }
    );
    const [course] = await courseRes.json();
    const updatedMetadata = { ...(course.metadata || {}), allowNewStudent: true };
    await fetch(`http://localhost:54321/rest/v1/course?id=eq.${course.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ metadata: updatedMetadata })
    });
    // Remove any existing WAITLISTED row for this student so the test starts fresh.
    await fetch(
      `http://localhost:54321/rest/v1/groupmember?profile_id=eq.${STUDENT_ID}&status=eq.WAITLISTED`,
      { method: 'DELETE', headers }
    );
    // Log in as student (same flow as the standard student login step).
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('student@test.com');
    await page.locator('input[type="password"]').fill('123456');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/lms**');
  }
);

Then('I should see a {string} button', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label })).toBeVisible({ timeout: 10_000 });
});

Then('I should see the waitlist confirmation message', async ({ page }) => {
  await expect(page.locator('[data-testid="waitlist-confirmation"]')).toBeVisible({
    timeout: 10_000
  });
});

Given('I am logged in as a student', async ({ page }) => {
  // Start from the app root so localStorage is accessible, then clear the
  // pre-loaded admin auth state before logging in as the student.
  await page.goto('/');
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('student@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  // Students are redirected to /lms (not /org) — they have no org-admin role.
  await page.waitForURL('**/lms**');
});

When('I navigate to the LMS explore page', async ({ page }) => {
  // Must use SPA navigation (click the sidebar link) instead of page.goto().
  // A full-page navigation triggers appSetup.ts → getProfile() which detects
  // a student account and unconditionally redirects to /lms, overriding the
  // /lms/explore destination.
  await page.getByRole('link', { name: 'Explore' }).click();
  await page.waitForURL('**/lms/explore**');
});

When(
  'I click "Learn more" for the {string} course',
  async ({ page }, courseName: string) => {
    // Course cards render only after $profile and $currentOrg are both loaded.
    // Waiting for the card to appear is sufficient — org is ready by then.
    // Course cards load async — wait for the specific card to appear.
    // On the explore page, isLMS=false so no inner "Learn more" button renders.
    // The entire card div is role="button" and navigates to /course/${slug} on click.
    const card = page.locator('div[role="button"]').filter({ hasText: courseName });
    await card.waitFor();
    await card.click();
    await page.waitForURL('**/course/**');
  },
);

Then('I should be on the LMS page', async ({ page }) => {
  await page.waitForURL('**/lms**');
});
