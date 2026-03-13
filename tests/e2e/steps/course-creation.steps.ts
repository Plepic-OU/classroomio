import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I am logged in as {string} with password {string}', async ({ page }, email: string, password: string) => {
  await page.goto('/login');
  await page.fill('[type=email]', process.env.TEST_USER_EMAIL ?? email);
  await page.fill('[type=password]', process.env.TEST_USER_PASSWORD ?? password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/org\//);
});

Given('I am on the courses page', async ({ page }) => {
  // Extract org path from current URL (e.g. /org/udemy-test) and navigate to /courses
  const url = page.url();
  const orgMatch = url.match(/\/org\/[^/?]+/);
  const orgPath = orgMatch ? orgMatch[0] : '/org/udemy-test';
  await page.goto(orgPath + '/courses');
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('the course creation modal opens', async ({ page }) => {
  await page.waitForURL(/[?&]create=true/);
});

When('I fill in the course title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder('Your course name').fill(title);
});

When('I fill in the course description {string}', async ({ page }, description: string) => {
  await page.getByPlaceholder('A little description about this course').fill(description);
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: 'Finish' }).click();
});

Then('I should see {string} in the courses list', async ({ page }, title: string) => {
  await expect(page.getByText(title).first()).toBeVisible();
});
