import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I navigate to the courses page', async ({ page }) => {
  // Navigate via the sidebar nav link — avoids hard-coding the org slug
  await page.getByRole('link', { name: 'Courses' }).click();
  await page.waitForURL('**/org/**/courses');
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I select a course type', async ({ page }) => {
  // Modal step 0: the first type (Live Class) is pre-selected; just advance to step 1.
  // Wait for modal to render after URL change (?create=true) before clicking.
  await page.waitForURL('**?create=true');
  await page.getByRole('button', { name: 'Next' }).click();
});

When('I fill in the course name {string}', async ({ page }, name: string) => {
  await page.locator('input[placeholder="Your course name"]').fill(name);
});

When('I fill in the course description {string}', async ({ page }, description: string) => {
  // Use the full placeholder text to uniquely identify this textarea.
  // The modal contains multiple textareas; `.first()` is flaky.
  const textarea = page.locator('textarea[placeholder="A little description about this course"]');
  // The description field is below the visible viewport inside the modal.
  // Scrolling into view is required before Playwright can interact with it.
  await textarea.scrollIntoViewIfNeeded();
  await textarea.fill(description);
});

When('I submit the form', async ({ page }) => {
  await page.getByRole('button', { name: 'Finish' }).click();
});

Then('I should see {string} on the page', async ({ page }, name: string) => {
  await page.waitForURL('**/courses/**');
  // The nav link shows "Go to Courses" while loading, then changes to the course name.
  // Waiting for the named link confirms the course page has fully loaded.
  await expect(page.getByRole('link', { name })).toBeVisible();
});

// No per-test cleanup needed: global-setup.ts runs TRUNCATE + reseed before every
// test run, which resets the database to a known state. Attempting to DELETE a
// course via the REST API fails with 409 because course_newsfeed records are
// auto-created with the course and have NO ACTION on delete.
