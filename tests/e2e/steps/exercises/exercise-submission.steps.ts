import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

const TEST_COURSE_ID = '00000000-bdd1-0000-0000-000000000002';

When('I navigate to the exercises page', async ({ page }) => {
  await page.goto('/lms/exercises');
  await page.waitForLoadState('domcontentloaded');
});

When('I navigate to the submissions page for the test course', async ({ page }) => {
  await page.goto(`/courses/${TEST_COURSE_ID}/submissions`);
  await page.waitForLoadState('domcontentloaded');
});

Then('I should see the exercises heading', async ({ page }) => {
  await page.getByRole('heading', { name: 'Exercises' }).waitFor({ timeout: 10_000 });
});

Then('I should see the {string} section', async ({ page }, sectionName: string) => {
  await page.getByText(sectionName).waitFor({ timeout: 10_000 });
});

Then('I should see the submitted exercises heading', async ({ page }) => {
  await page.getByRole('heading', { name: 'Submitted Exercises' }).waitFor({ timeout: 10_000 });
});
