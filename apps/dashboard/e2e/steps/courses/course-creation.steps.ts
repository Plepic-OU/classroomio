import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBdd } from 'playwright-bdd';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the courses page', async ({ page }) => {
  const { orgSlug } = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../.auth/context.json'), 'utf-8')
  );
  await page.goto(`/org/${orgSlug}/courses`);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select the course type {string}', async ({ page }, courseType: string) => {
  await page.getByRole('button', { name: new RegExp(courseType, 'i') }).click();
  await page.getByRole('button', { name: /next/i }).click();
});

When('I fill in the course title {string}', async ({ page }, title: string) => {
  await page.getByLabel(/course name/i).fill(title);
  // Short Description is required — target by placeholder to avoid strict mode violation
  await page.getByPlaceholder('A little description about this course').fill('Test course description');
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should see the new course {string} in the courses list', async ({ page }, title: string) => {
  await expect(page.getByText(title)).toBeVisible();
});
