import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { Given: given, When: when, Then: then } = createBdd();

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ORG_SITE_NAME = 'testorg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Store course data between steps
let fullCourseWithWaitlistHash = '';
let fullCourseNoWaitlistHash = '';

function buildInviteHash(id: string, name: string, description: string, orgSiteName: string) {
  return encodeURIComponent(
    Buffer.from(JSON.stringify({ id, name, description, orgSiteName })).toString('base64')
  );
}

given('there is a full course with waitlist enabled', async () => {
  // Look up the seeded course
  const { data: course } = await supabase
    .from('course')
    .select('id, title, description')
    .eq('title', 'E2E Waitlist Course')
    .single();

  if (!course) throw new Error('E2E Waitlist Course not found — run waitlist seed first');

  fullCourseWithWaitlistHash = buildInviteHash(
    course.id, course.title, course.description ?? '', ORG_SITE_NAME
  );
});

given('there is a full course with waitlist disabled', async () => {
  const { data: course } = await supabase
    .from('course')
    .select('id, title, description')
    .eq('title', 'E2E No Waitlist Course')
    .single();

  if (!course) throw new Error('E2E No Waitlist Course not found — run waitlist seed first');

  fullCourseNoWaitlistHash = buildInviteHash(
    course.id, course.title, course.description ?? '', ORG_SITE_NAME
  );
});

when('I visit the invite link for the full course', async ({ page }) => {
  await page.goto(`/invite/s/${fullCourseWithWaitlistHash}`);
  await page.waitForTimeout(3000); // SvelteKit hydration + capacity check
});

when('I visit the invite link for the full course without waitlist', async ({ page }) => {
  await page.goto(`/invite/s/${fullCourseNoWaitlistHash}`);
  await page.waitForTimeout(3000);
});

// Note: "I should see the {string} button" step is defined in profile-settings.steps.ts
// and is shared across features via playwright-bdd's global step matching.

then('I should see the course full waitlist message', async ({ page }) => {
  await expect(
    page.getByText(/course is full.*notified when a spot opens/i)
  ).toBeVisible({ timeout: 5000 });
});

then('I should see the waitlist confirmation message', async ({ page }) => {
  await expect(
    page.getByText(/added to the waitlist/i)
  ).toBeVisible({ timeout: 10_000 });
});

then('I should see the course full message', async ({ page }) => {
  await expect(
    page.getByText(/this course is full/i)
  ).toBeVisible({ timeout: 5000 });
});

then('I should not see any join button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /join/i })).not.toBeVisible();
});
