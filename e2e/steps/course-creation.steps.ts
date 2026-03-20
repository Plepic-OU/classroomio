import { expect } from '@playwright/test';
import { Given, When, Then, AfterAll } from './fixtures';
import { getTestUserSession, TEST_ORG_SITENAME } from '../support/auth';
import { deleteTestCourses } from '../support/cleanup';

Given('I am logged in as an instructor', async ({ page }) => {
  const session = await getTestUserSession();

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  await page.evaluate((s) => {
    const key = `sb-localhost-auth-token`;
    const value = JSON.stringify({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      expires_in: s.expires_in,
      token_type: s.token_type,
      user: s.user,
    });
    localStorage.setItem(key, value);
  }, session);
});

Given('I am on the courses page', async ({ page }) => {
  await page.goto(`/org/${TEST_ORG_SITENAME}/courses`);
  await page.waitForLoadState('domcontentloaded');
});

When('I click the create course button', async ({ page }) => {
  await page.locator('[data-testid="create-course-btn"]').click();
  // Step 1: course type (Live Class pre-selected), click Next
  await page.locator('[data-testid="new-course-next"]').click();
});

When('I enter course title {string}', async ({ page }, title: string) => {
  await page.locator('[data-testid="new-course-title"]').fill(title);
});

When('I enter course description {string}', async ({ page }, description: string) => {
  await page.locator('[data-testid="new-course-description"]').fill(description);
});

When('I submit the course form', async ({ page }) => {
  await page.locator('[data-testid="new-course-finish"]').click();
});

When('I submit the course form without a title', async ({ page }) => {
  await page.locator('[data-testid="new-course-finish"]').click();
});

Then('I should be on the new course page', async ({ page }) => {
  await page.waitForURL('**/courses/**', { timeout: 15000 });
  expect(page.url()).toMatch(/\/courses\/.+/);
});

Then('I should see a validation error', async ({ page }) => {
  // Native HTML5 required validation fires before custom JS validation
  const isInvalid = await page.locator('[data-testid="new-course-title"]').evaluate(
    (el: HTMLInputElement) => !el.validity.valid
  );
  expect(isInvalid).toBe(true);
});

AfterAll(async () => {
  await deleteTestCourses();
});
