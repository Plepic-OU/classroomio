import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { Given: given, When: when, Then: then } = createBdd();

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let courseId = '';
let coursePageUrl = '';

given('there is a course with waitlisted students', async () => {
  // Look up the seeded course with a waitlisted student
  const { data: course } = await supabase
    .from('course')
    .select('id')
    .eq('title', 'E2E Waitlist Course')
    .single();

  if (!course) throw new Error('E2E Waitlist Course not found — run waitlist seed first');
  courseId = course.id;

  // Verify there is at least one waitlisted student
  const { count } = await supabase
    .from('course_waitlist')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);

  if (!count || count === 0) {
    // Re-seed the waitlist entry
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const waitlistUser = existingUsers?.users?.find(
      (u) => u.email === 'waitlist-student@classroomio.test'
    );
    if (waitlistUser) {
      await supabase.from('course_waitlist').upsert(
        { course_id: courseId, profile_id: waitlistUser.id },
        { onConflict: 'course_id,profile_id' }
      );
    }
  }
});

when('I navigate to the course people page', async ({ page }) => {
  coursePageUrl = `/courses/${courseId}/people`;
  await page.goto(coursePageUrl);
  // Wait for course data to load — the people table header appears once the page is ready
  await expect(page.getByText('Name').first()).toBeVisible({ timeout: 8000 });
});

then('I should see the waitlist section', async ({ page }) => {
  await expect(
    page.getByText(/waitlist/i).first()
  ).toBeVisible({ timeout: 5000 });
});

then('I should see the waitlisted student name and email', async ({ page }) => {
  await expect(page.getByText('Waitlist Student')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('waitlist-student@classroomio.test')).toBeVisible({ timeout: 5000 });
});

when('I click the {string} button for the waitlisted student', async ({ page }, buttonName: string) => {
  // Find the Approve button within the waitlist section
  const waitlistSection = page.locator('div').filter({ hasText: /waitlist/i }).first();
  await waitlistSection.getByRole('button', { name: buttonName }).first().click();
});

then('the student should be removed from the waitlist', async ({ page }) => {
  // After approval, the waitlist student should no longer appear in the waitlist section
  // Wait for the UI to update
  await page.waitForTimeout(2000);

  // The student name should either be gone from waitlist or moved to the enrolled list
  // Check that the waitlist count decreased or the section is hidden
  const waitlistHeader = page.getByText(/waitlist\s*\(0\)/i);
  const noWaitlistSection = page.getByText('Waitlist Student').first();

  // Either the waitlist shows (0) or the student name is no longer in the waitlist section
  try {
    await expect(waitlistHeader).toBeVisible({ timeout: 3000 });
  } catch {
    // Waitlist section might be hidden entirely when count is 0
    // Verify the student is no longer in a waitlist context
    const isStillInWaitlist = await page
      .locator('.mb-8')
      .filter({ hasText: /waitlist/i })
      .filter({ hasText: 'Waitlist Student' })
      .isVisible();
    expect(isStillInWaitlist).toBe(false);
  }
});
