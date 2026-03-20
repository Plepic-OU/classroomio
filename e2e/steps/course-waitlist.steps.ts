import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { adminClient } from './supabase';

const { When, Then, Before, After } = createBdd();

// Seed constants
const ORG_ID = '1a1dcddd-1abc-4f72-b644-0bd18191a289'; // 'Udemy Test' org
const ADMIN_PROFILE_ID = '7ac00503-8519-43c8-a5ea-b79aeca900b1';
const ADMIN_EMAIL = 'admin@test.com';
const COURSE_TITLE_PREFIX = 'BDD Waitlist ';

// Module-level state — intentional, tests run sequentially (workers: 1)
let createdCourseId = '';
let createdGroupId = '';

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForSelector('html[theme]', { timeout: 8000 });
}

Before({ tags: '@waitlist' }, async () => {
  // Clean up any leftover data from prior failed runs
  const { data: oldCourses } = await adminClient
    .from('course')
    .select('id, group_id')
    .like('title', `${COURSE_TITLE_PREFIX}%`);

  for (const c of oldCourses ?? []) {
    await adminClient.from('course').delete().eq('id', c.id);
    if (c.group_id) {
      await adminClient.from('groupmember').delete().eq('group_id', c.group_id);
      await adminClient.from('group').delete().eq('id', c.group_id);
    }
  }

  // Create a fresh group for this test
  const { data: group, error: groupError } = await adminClient
    .from('group')
    .insert({
      name: `${COURSE_TITLE_PREFIX}Group`,
      organization_id: ORG_ID,
      description: 'BDD test group for waitlist',
    })
    .select('id')
    .single();

  if (!group) throw new Error(`Failed to create group: ${groupError?.message}`);
  createdGroupId = group.id;

  // Create a fresh course
  const { data: course, error: courseError } = await adminClient
    .from('course')
    .insert({
      title: `${COURSE_TITLE_PREFIX}${Date.now()}`,
      description: 'BDD test course for waitlist settings',
      group_id: createdGroupId,
      metadata: {},
    })
    .select('id')
    .single();

  if (!course) throw new Error(`Failed to create course: ${courseError?.message}`);
  createdCourseId = course.id;

  // Add admin as teacher so the settings page is accessible
  await adminClient.from('groupmember').insert({
    group_id: createdGroupId,
    profile_id: ADMIN_PROFILE_ID,
    email: ADMIN_EMAIL,
    role_id: 2, // teacher
  });
});

After({ tags: '@waitlist' }, async () => {
  if (createdCourseId) {
    await adminClient.from('course').delete().eq('id', createdCourseId);
    createdCourseId = '';
  }
  if (createdGroupId) {
    await adminClient.from('groupmember').delete().eq('group_id', createdGroupId);
    await adminClient.from('group').delete().eq('id', createdGroupId);
    createdGroupId = '';
  }
});

When('I navigate to the course settings page', async ({ page }) => {
  await page.goto(`/courses/${createdCourseId}/settings`);
  await waitForHydration(page);
  // Wait for the save button to appear, confirming the settings form has loaded
  await expect(page.getByTestId('settings-save-btn')).toBeVisible({ timeout: 15_000 });
});

When('I set the max capacity to {string}', async ({ page }, capacity: string) => {
  const input = page.locator('#course-max-capacity-input');
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill(capacity);
  // Trigger the change event so Svelte's bind:value updates $settings.max_capacity
  await input.dispatchEvent('change');
});

When('I enable the waitlist', async ({ page }) => {
  const toggleWrapper = page.getByTestId('course-waitlist-toggle');
  const toggleInput = toggleWrapper.locator('input[role="switch"]');
  // Toggle is disabled until max_capacity is set — wait for it to become enabled
  await expect(toggleInput).toBeEnabled({ timeout: 10_000 });
  // Click the label (the input is visually hidden in Carbon's toggle pattern)
  await toggleWrapper.locator('label').click();
});

When('I save the course settings', async ({ page }) => {
  await page.getByTestId('settings-save-btn').click();
  // Wait for the snackbar or let the DB write commit
  await page.waitForTimeout(1000);
});

Then('the course should have max capacity {int} and waitlist enabled', async ({}, capacity: number) => {
  if (!createdCourseId) throw new Error('createdCourseId not set');
  const { data, error } = await adminClient
    .from('course')
    .select('max_capacity, waitlist_enabled')
    .eq('id', createdCourseId)
    .single();
  if (error || !data) throw new Error(`Could not fetch course: ${error?.message}`);
  expect(data.max_capacity).toBe(capacity);
  expect(data.waitlist_enabled).toBe(true);
});
