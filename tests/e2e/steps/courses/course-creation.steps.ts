import { createBdd } from 'playwright-bdd';
import { loginAs } from '../../helpers/login';

const { Given, When, Then } = createBdd();

Given('I am logged in as {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
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
  await page.getByPlaceholder(/course name/i).fill(title);
});

When('I submit the new course form', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should see {string} in the course list', async ({ page }, title: string) => {
  await page.getByText(title).waitFor();
});
