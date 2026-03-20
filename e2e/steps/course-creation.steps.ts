import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

// No After cleanup hook needed — globalSetup truncates + re-seeds before every run.

Given('I am logged in as an admin', async ({ adminPage }) => {});

When('I navigate to the courses page', async ({ adminPage, orgSlug }) => {
  await adminPage.goto(`/org/${orgSlug}/courses`);
});

When('I click the create course button', async ({ adminPage }) => {
  await adminPage.click('[data-testid="create-course-btn"]');
});

// Step 0 of NewCourseModal: select course type before the title form appears.
// Use regex because the button's accessible name includes both title and subtitle text.
When('I select the course type {string}', async ({ adminPage }, courseType: string) => {
  await adminPage.getByRole('button', { name: new RegExp(courseType) }).click();
});

// Advance from step 0 (type selection) to step 1 (title form)
When('I click the next button to proceed', async ({ adminPage }) => {
  await adminPage.getByRole('button', { name: /next/i }).click();
});

When('I fill in the course title {string}', async ({ adminPage }, title: string) => {
  await adminPage.fill('[name="title"]', title);
});

When('I fill in the course description {string}', async ({ adminPage }, description: string) => {
  await adminPage.locator('textarea[required]').fill(description);
});

When('I submit the course form', async ({ adminPage }) => {
  await adminPage.click('[type="submit"]');
});

Then('I should see the new course in the courses list', async ({ adminPage }) => {
  await adminPage.waitForSelector('text=Introduction to Testing');
});
