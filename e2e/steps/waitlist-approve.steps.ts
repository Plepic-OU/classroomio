import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { adminClient } from './supabase';

const { When, Then, Before, After } = createBdd();

// Seed constants
const ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289'; // 'Udemy Test' org
const ADMIN_PROFILE_ID = '7ac00503-8519-43c8-a5ea-b79aeca900b1';
const ADMIN_EMAIL = 'admin@test.com';
const STUDENT_PROFILE_ID = '0c256e75-aa40-4f62-8d30-0217ca1c60d9';
const STUDENT_EMAIL = 'student@test.com';
const COURSE_TITLE_PREFIX = 'BDD Approve ';

// Module-level state — intentional, tests run sequentially (workers: 1)
let courseId = '';
let groupId = '';

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForSelector('html[theme]', { timeout: 8000 });
}

Before({ tags: '@approve' }, async () => {
  // Clean up any leftover data from prior failed runs
  const { data: old } = await adminClient
    .from('course')
    .select('id, group_id')
    .like('title', `${COURSE_TITLE_PREFIX}%`);

  for (const c of old ?? []) {
    await adminClient.from('groupmember').delete().eq('group_id', c.group_id);
    await adminClient.from('course').delete().eq('id', c.id);
    if (c.group_id) await adminClient.from('group').delete().eq('id', c.group_id);
  }

  // Create a fresh group
  const { data: group, error: ge } = await adminClient
    .from('group')
    .insert({
      name: `${COURSE_TITLE_PREFIX}Group`,
      organization_id: ORG_ID,
      description: 'BDD test group for waitlist approval',
    })
    .select('id')
    .single();
  if (!group) throw new Error(`Failed to create group: ${ge?.message}`);
  groupId = group.id;

  // Create course with waitlist enabled
  const { data: course, error: ce } = await adminClient
    .from('course')
    .insert({
      title: `${COURSE_TITLE_PREFIX}${Date.now()}`,
      description: 'BDD test course for waitlist approval',
      group_id: groupId,
      metadata: {},
      max_capacity: 10,
      waitlist_enabled: true,
    })
    .select('id')
    .single();
  if (!course) throw new Error(`Failed to create course: ${ce?.message}`);
  courseId = course.id;

  // Add admin as teacher
  await adminClient.from('groupmember').insert({
    group_id: groupId,
    profile_id: ADMIN_PROFILE_ID,
    email: ADMIN_EMAIL,
    role_id: 2,
  });

  // Add student as waitlisted member
  await adminClient.from('groupmember').insert({
    group_id: groupId,
    profile_id: STUDENT_PROFILE_ID,
    email: STUDENT_EMAIL,
    role_id: 3,
    status: 'waitlisted',
  });
});

After({ tags: '@approve' }, async () => {
  if (groupId) {
    await adminClient.from('groupmember').delete().eq('group_id', groupId);
    if (courseId) await adminClient.from('course').delete().eq('id', courseId);
    await adminClient.from('group').delete().eq('id', groupId);
  }
  courseId = '';
  groupId = '';
});

When('I navigate to the people tab of the course', async ({ page }) => {
  await page.goto(`/courses/${courseId}/people`);
  // Wait for the structured list header (people table) to appear — confirms the page and
  // course data have loaded. Avoids relying on html[theme] which may not be set by then.
  await expect(page.locator('.bx--structured-list')).toBeVisible({ timeout: 15_000 });
});

Then('I should see the waitlist section', async ({ page }) => {
  await expect(page.getByTestId('people-waitlist-section')).toBeVisible({ timeout: 15_000 });
});

When('I click the approve button for the waitlisted student', async ({ page }) => {
  const approveBtn = page.getByTestId('waitlist-approve-btn').first();
  await expect(approveBtn).toBeVisible({ timeout: 10_000 });
  await approveBtn.click();
  // Wait for the re-fetch to complete and the waitlist section to disappear
  await expect(page.getByTestId('people-waitlist-section')).not.toBeVisible({ timeout: 10_000 });
});

Then('the student should be enrolled in the database', async () => {
  if (!groupId) throw new Error('groupId not set');
  const { data, error } = await adminClient
    .from('groupmember')
    .select('status')
    .eq('group_id', groupId)
    .eq('profile_id', STUDENT_PROFILE_ID)
    .eq('role_id', 3)
    .single();
  if (error || !data) throw new Error(`Could not find groupmember row: ${error?.message}`);
  expect(data.status).toBe('enrolled');
});
