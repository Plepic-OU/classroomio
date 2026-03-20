import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { adminClient } from './supabase';

const { Given, When, Then, Before, After } = createBdd();

const ORG_SLUG = 'udemy-test';
const COURSE_TITLE_PREFIX = 'BDD Test Course';

// Track created course titles per test for cleanup.
// Module-level is intentional here: tests run sequentially (workers: 1 default for BDD).
// The Before hook wipes all prefix-matching rows before each course scenario anyway.
let createdCourseTitle = '';

Before({ tags: '@course' }, async () => {
  // Clean up any leftover BDD test courses from prior failed runs
  const { error } = await adminClient
    .from('course')
    .delete()
    .like('title', `${COURSE_TITLE_PREFIX}%`);
  if (error) console.warn('BDD cleanup warning:', error.message);
  createdCourseTitle = '';
});

After({ tags: '@course' }, async () => {
  if (createdCourseTitle) {
    await adminClient.from('course').delete().eq('title', createdCourseTitle);
    createdCourseTitle = '';
  }
});

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForSelector('html[theme]', { timeout: 8000 });
}

Given('I am logged in as {string}', async ({ page }, email: string) => {
  const password = email === 'admin@test.com' ? '123456' : 'unknown';
  await page.goto('/login');
  await waitForHydration(page);
  await page.waitForSelector('[data-testid="login-email"]');
  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', password);
  await page.click('[data-testid="login-submit"]');
  await expect(page).toHaveURL(/\/org\//, { timeout: 10_000 });
});

When('I navigate to the courses page', async ({ page }) => {
  await page.goto(`/org/${ORG_SLUG}/courses`);
  await page.waitForSelector('[data-testid="create-course-btn"]');
  // Wait for skeleton loading placeholders to disappear before asserting course list content
  await page.waitForSelector('.bx--skeleton__placeholder', { state: 'detached', timeout: 10_000 }).catch(() => {
    // No skeletons present — data was already loaded, proceed
  });
});

When('I click the create course button', async ({ page }) => {
  await page.click('[data-testid="create-course-btn"]');
  await page.waitForSelector('[data-testid="course-type-SELF_PACED"]');
});

When('I select the {string} course type', async ({ page }, type: string) => {
  const typeMap: Record<string, string> = {
    'Self Paced': 'SELF_PACED',
    'Live Class': 'LIVE_CLASS',
  };
  const testId = `course-type-${typeMap[type] ?? type}`;
  await page.click(`[data-testid="${testId}"]`);
});

When('I click next', async ({ page }) => {
  await page.click('[data-testid="course-type-next"]');
  await page.waitForSelector('[data-testid="course-title-input"]');
});

When('I enter course title {string}', async ({ page }, title: string) => {
  createdCourseTitle = `${title} ${Date.now()}`;
  await page.fill('[data-testid="course-title-input"]', createdCourseTitle);
});

When('I enter course description {string}', async ({ page }, description: string) => {
  // page.fill() doesn't propagate through Svelte component bind:value chains.
  // Use evaluate to dispatch a native InputEvent which Svelte's internal listener picks up.
  await page.evaluate((desc) => {
    const el = document.querySelector('[data-testid="course-description-input"]') as HTMLTextAreaElement | null;
    if (!el) throw new Error('course-description-input not found');
    el.focus();
    el.value = desc;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertText', data: desc }));
  }, description);
});

When('I submit the course creation form', async ({ page }) => {
  await page.click('[data-testid="course-create-submit"]');
});

Then('I should be on the new course page', async ({ page }) => {
  await expect(page).toHaveURL(/\/courses\//, { timeout: 10_000 });
});

Then('I should see {string} in the courses list', async ({ page }) => {
  if (!createdCourseTitle) throw new Error('createdCourseTitle is not set — was "I enter course title" step skipped?');
  await expect(page.getByText(createdCourseTitle, { exact: true })).toBeVisible();
});
