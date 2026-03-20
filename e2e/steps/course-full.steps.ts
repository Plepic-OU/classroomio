import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { adminClient } from './supabase';

const { Given, When, Then, Before, After } = createBdd();

// Seed constants
const ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289'; // 'Udemy Test' org
const ORG_SLUG = 'udemy-test';
const ADMIN_PROFILE_ID = '7ac00503-8519-43c8-a5ea-b79aeca900b1';
const ADMIN_EMAIL = 'admin@test.com';
const STUDENT_PROFILE_ID = '0c256e75-aa40-4f62-8d30-0217ca1c60d9';
const STUDENT_EMAIL = 'student@test.com';
const COURSE_TITLE_PREFIX = 'BDD Full ';

// Module-level state — intentional, tests run sequentially (workers: 1)
let courseId = '';
let courseTitle = '';
let courseDesc = '';
let groupId = '';

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForSelector('html[theme]', { timeout: 8000 });
}

async function buildInviteHash(id: string, title: string, desc: string): Promise<string> {
  return encodeURIComponent(
    Buffer.from(JSON.stringify({ id, name: title, description: desc, orgSiteName: ORG_SLUG })).toString('base64')
  );
}

async function cleanupLeftovers() {
  const { data: old } = await adminClient
    .from('course')
    .select('id, group_id')
    .like('title', `${COURSE_TITLE_PREFIX}%`);

  for (const c of old ?? []) {
    await adminClient.from('groupmember').delete().eq('group_id', c.group_id);
    await adminClient.from('course').delete().eq('id', c.id);
    if (c.group_id) await adminClient.from('group').delete().eq('id', c.group_id);
  }
}

async function createFullCourse(waitlistEnabled: boolean): Promise<void> {
  const { data: group, error: ge } = await adminClient
    .from('group')
    .insert({ name: `${COURSE_TITLE_PREFIX}Group`, organization_id: ORG_ID, description: 'BDD full-course test group' })
    .select('id')
    .single();
  if (!group) throw new Error(`Failed to create group: ${ge?.message}`);
  groupId = group.id;

  // max_capacity = 0 means 0 slots: any student will see the course as full
  // (server logic: isFull = enrolledCount >= max_capacity = 0 >= 0 = true)
  const { data: course, error: ce } = await adminClient
    .from('course')
    .insert({
      title: `${COURSE_TITLE_PREFIX}${Date.now()}`,
      description: 'BDD test course at capacity',
      group_id: groupId,
      metadata: {},
      max_capacity: 0,
      waitlist_enabled: waitlistEnabled,
      is_published: true, // required: RLS policy blocks anon reads of unpublished courses
    })
    .select('id, title, description')
    .single();
  if (!course) throw new Error(`Failed to create course: ${ce?.message}`);
  courseId = course.id;
  courseTitle = course.title;
  courseDesc = course.description ?? '';

  // Add admin as teacher so the course is discoverable
  const { error: me } = await adminClient.from('groupmember').insert({
    group_id: groupId,
    profile_id: ADMIN_PROFILE_ID,
    email: ADMIN_EMAIL,
    role_id: 2,
  });
  if (me) throw new Error(`Failed to add admin as teacher: ${me.message}`);
}

async function cleanup() {
  if (groupId) {
    await adminClient.from('groupmember').delete().eq('group_id', groupId);
    if (courseId) await adminClient.from('course').delete().eq('id', courseId);
    await adminClient.from('group').delete().eq('id', groupId);
  }
  courseId = '';
  groupId = '';
  courseTitle = '';
  courseDesc = '';
}

// ── @course-full ────────────────────────────────────────────────────────────

Before({ tags: '@course-full' }, async () => {
  await cleanupLeftovers();
  await createFullCourse(false);
});

After({ tags: '@course-full' }, async () => {
  await cleanup();
});

// ── @course-full-waitlist ────────────────────────────────────────────────────

Before({ tags: '@course-full-waitlist' }, async () => {
  await cleanupLeftovers();
  await createFullCourse(true);
});

After({ tags: '@course-full-waitlist' }, async () => {
  // Also remove the student waitlist entry created during the test
  if (groupId) {
    await adminClient.from('groupmember').delete().eq('group_id', groupId).eq('profile_id', STUDENT_PROFILE_ID);
  }
  await cleanup();
});

// ── Login step (student) ─────────────────────────────────────────────────────

Given(
  'I am logged in as {string}',
  { tags: '@course-full or @course-full-waitlist' },
  async ({ page }, email: string) => {
    await page.goto('/login');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="login-email"]');
    await page.fill('[data-testid="login-email"]', email);
    await page.fill('[data-testid="login-password"]', '123456');
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL(/\/(lms|org\/)/, { timeout: 10_000 });
  }
);

// ── Shared step: visit full-course invite link ────────────────────────────────

async function visitFullCourseInvite(page: import('@playwright/test').Page) {
  const hash = await buildInviteHash(courseId, courseTitle, courseDesc);
  await page.goto(`/invite/s/${hash}`);
  await waitForHydration(page);
  await page.waitForURL(/\/invite\/s\//, { timeout: 10_000 });
}

When('I visit the invite link for the full course', async ({ page }) => {
  await visitFullCourseInvite(page);
});

When('I visit the invite link for the full course with waitlist', async ({ page }) => {
  await visitFullCourseInvite(page);
});

// ── @course-full steps ────────────────────────────────────────────────────────

Then('I should see the course is full message', async ({ page }) => {
  await expect(page.getByTestId('invite-course-full-msg')).toBeVisible({ timeout: 15_000 });
});

// ── @course-full-waitlist steps ───────────────────────────────────────────────

Then('I should see the join waitlist button', async ({ page }) => {
  await expect(page.getByTestId('invite-waitlist-btn')).toBeVisible({ timeout: 15_000 });
});

When('I click the join waitlist button', async ({ page }) => {
  const btn = page.getByTestId('invite-waitlist-btn');
  await expect(btn).toBeEnabled({ timeout: 15_000 });
  await btn.click();
});

Then('I should see the waitlisted confirmation message', async ({ page }) => {
  await expect(page.getByTestId('invite-waitlisted-msg')).toBeVisible({ timeout: 10_000 });
});

Then('the student should be waitlisted in the database', async () => {
  if (!groupId) throw new Error('groupId not set');
  const { data, error } = await adminClient
    .from('groupmember')
    .select('status')
    .eq('group_id', groupId)
    .eq('profile_id', STUDENT_PROFILE_ID)
    .eq('role_id', 3)
    .single();
  if (error || !data) throw new Error(`Could not find groupmember row: ${error?.message}`);
  expect(data.status).toBe('waitlisted');
});
