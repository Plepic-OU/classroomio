import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { adminClient } from './supabase';

const { Given, When, Then, Before, After } = createBdd();

const ORG_SLUG = 'udemy-test';
const STUDENT_EMAIL = 'student@test.com';

/** Wait for SvelteKit hydration to complete. */
async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForSelector('html[theme]', { timeout: 8000 });
}
// Title of the course used in the enrollment scenario — must match the feature file and seed data.
// "Getting started with MVC" is a seed course the test student is not already enrolled in.
const ENROLLMENT_COURSE_TITLE = 'Getting started with MVC';

let enrollmentGroupId = '';
let studentProfileId = '';

async function removeTestEnrollment(groupId: string, profileId: string) {
  const { error } = await adminClient
    .from('groupmember')
    .delete()
    .eq('group_id', groupId)
    .eq('profile_id', profileId)
    .eq('role_id', 3); // STUDENT
  if (error) console.warn('Enrollment cleanup warning:', error.message);
}

// Enrollment-specific login step: student accounts redirect to /lms, not /org
Given('I am logged in as {string}', { tags: '@enrollment' }, async ({ page }, email: string) => {
  await page.goto('/login');
  await waitForHydration(page);
  await page.waitForSelector('[data-testid="login-email"]');
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', '123456');
  await page.click('[data-testid="login-submit"]');
  // Students are redirected to /lms, not /org
  await expect(page).toHaveURL(/\/(lms|org\/)/, { timeout: 10_000 });
});

Before({ tags: '@enrollment' }, async () => {
  const [{ data: profile }, { data: course }] = await Promise.all([
    adminClient.from('profile').select('id').eq('email', STUDENT_EMAIL).single(),
    adminClient.from('course').select('group_id').eq('title', ENROLLMENT_COURSE_TITLE).single(),
  ]);

  studentProfileId = profile?.id ?? '';
  enrollmentGroupId = '';

  if (studentProfileId && course?.group_id) {
    await removeTestEnrollment(course.group_id, studentProfileId);
  }
});

After({ tags: '@enrollment' }, async () => {
  if (enrollmentGroupId && studentProfileId) {
    await removeTestEnrollment(enrollmentGroupId, studentProfileId);
  }
  enrollmentGroupId = '';
});

When('I visit the invite link for {string}', async ({ page }, courseTitle: string) => {
  const { data: course, error } = await adminClient
    .from('course')
    .select('id, title, description, group_id')
    .eq('title', courseTitle)
    .single();

  if (!course) throw new Error(`Course "${courseTitle}" not found: ${error?.message}`);

  enrollmentGroupId = course.group_id ?? '';

  const hash = encodeURIComponent(
    Buffer.from(
      JSON.stringify({ id: course.id, name: course.title, description: course.description, orgSiteName: ORG_SLUG })
    ).toString('base64')
  );

  await page.goto(`/invite/s/${hash}`);
  await page.waitForURL(/\/invite\/s\//, { timeout: 10_000 });
});

Then('I should see the course invite page with title {string}', async ({ page }, title: string) => {
  await expect(page.getByTestId('invite-course-title')).toBeVisible();
  await expect(page.getByTestId('invite-course-title')).toHaveText(title);
});

When('I click the join course button', async ({ page }) => {
  const btn = page.getByTestId('invite-join-btn');
  // The root layout debounces getProfile by 1s, so $profile.id (which controls
  // the disabled state) takes >1s to populate after navigation. Wait properly.
  await expect(btn).toBeEnabled({ timeout: 15_000 });
  await btn.click();
  await page.waitForURL(/\/lms/, { timeout: 30_000 });
});

Then('I should be redirected to the LMS page', async ({ page }) => {
  await expect(page).toHaveURL(/\/lms/, { timeout: 15_000 });
});

Then('the enrollment status should be {string}', async ({}, expectedStatus: string) => {
  if (!enrollmentGroupId || !studentProfileId) {
    throw new Error('enrollmentGroupId or studentProfileId not set — cannot verify enrollment status');
  }
  const { data, error } = await adminClient
    .from('groupmember')
    .select('status')
    .eq('group_id', enrollmentGroupId)
    .eq('profile_id', studentProfileId)
    .eq('role_id', 3)
    .single();
  if (error || !data) throw new Error(`Could not find groupmember row: ${error?.message}`);
  expect(data.status).toBe(expectedStatus);
});
