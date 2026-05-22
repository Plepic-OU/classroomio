import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

// Fixed UUID for the seeded BDD test course (matches seed-db.ts)
const TEST_COURSE_ID = '00000000-bdd1-0000-0000-000000000002';

When('I navigate to the lessons page for the test course', async ({ page }) => {
  await page.goto(`/courses/${TEST_COURSE_ID}/lessons`);
  await page.waitForLoadState('domcontentloaded');
});

When('I navigate to my learning page', async ({ page }) => {
  await page.goto('/lms/mylearning');
  await page.waitForLoadState('domcontentloaded');
});

When('I click the add lesson button', async ({ page }) => {
  await page.getByRole('button', { name: /add/i }).click();
});

Then('I should see {string} in the lessons list', async ({ page }, lessonTitle: string) => {
  await page.getByText(lessonTitle).first().waitFor({ timeout: 10_000 });
});

Then('the new lesson modal should appear', async ({ page }) => {
  await page.getByText('Add New Lesson').waitFor({ timeout: 10_000 });
});

Then('I should see the {string} heading', async ({ page }, heading: string) => {
  await page.getByRole('heading', { name: heading }).waitFor({ timeout: 10_000 });
});
