import { Given, When, Then } from '../../helpers/fixtures';

Given('I am on the courses page', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/org\//);
  await page.getByRole('link', { name: /courses/i }).click();
  await page.waitForURL(/\/courses/);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select a course type and proceed', async ({ page }) => {
  await page.getByRole('button', { name: /next/i }).click();
});

When('I enter the course title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder(/course name/i).fill(title);
});

When('I enter the course title based on this scenario', async ({ page, $testInfo }) => {
  const title = `Course_${$testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  await page.getByPlaceholder(/course name/i).fill(title);
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
