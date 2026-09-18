import { Given, When, Then } from '../../fixtures';
import { restoreStorageState } from '../../helpers/auth-state';
import { TEST_USERS } from '../../helpers/test-users';

Given('I am logged in as {string}', async ({ page, workerStorageState }, email: string) => {
  const role = (Object.keys(TEST_USERS) as (keyof typeof TEST_USERS)[]).find(
    (key) => TEST_USERS[key].email === email
  );
  if (!role) throw new Error(`Unknown test user: ${email}`);

  await restoreStorageState(page, workerStorageState[role]);
  // Admins land on /org/..., students on /lms — either confirms the session took.
  await page.waitForURL(/\/(org|lms)/);
});

Given('I am on the courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await page.waitForURL(/\/courses/);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select a course type and proceed', async ({ page }) => {
  // The NewCourseModal has two steps: step 0 = type selection, step 1 = title entry
  // Default type (Live Class) is pre-selected, click Next to proceed
  await page.getByRole('button', { name: /next/i }).click();
});

When('I enter the course title {string}', async ({ page }, title: string) => {
  // Reset runs at most once per worker, not once per @resets-db file (see steps/hooks.ts),
  // so entity names must stay unique across every scenario that could share that one
  // baseline — append a per-run suffix.
  await page.getByPlaceholder(/course name/i).fill(`${title} ${Date.now()}`);
});

When('I enter the course description {string}', async ({ page }, description: string) => {
  await page.getByPlaceholder(/a little description/i).fill(description);
});

When('I submit the new course form', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should be redirected to the new course page', async ({ page }) => {
  await page.waitForURL(/\/courses\/[^/]+$/, { timeout: 15_000 });
});
