import { Given, When, Then } from '../fixtures';
import { expect } from '@playwright/test';

Given('I am on the courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await expect(page).toHaveURL(/\/courses/, { timeout: 15_000 });
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select course type {string} and proceed', async ({ page }, courseType: string) => {
  await page.getByText(courseType, { exact: true }).click();
  await page.getByRole('button', { name: /next/i }).click();
});

When('I enter the course title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder(/course name/i).fill(title);
});

When('I enter the course description {string}', async ({ page }, description: string) => {
  await page.getByPlaceholder(/a little description/i).fill(description);
});

When('I submit the new course form', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should be redirected to the new course page', async ({ page }) => {
  await expect(page).toHaveURL(/\/courses\/[^/]+$/, { timeout: 15_000 });
});

Then('I should see a title validation error', async ({ page }) => {
  // The form fields use HTML5 `required`, so clicking Finish with an empty title triggers
  // native browser constraint validation: the form does NOT submit and the user stays in
  // the modal at /courses. The JS `errors.title = 'Title is required'` only renders if
  // native validation is bypassed. Asserting the URL is the determinism-safe signal.
  await expect(page).toHaveURL(/\/org\/[^/]+\/courses[?/]?[^/]*$/, { timeout: 5_000 });
  const titleInput = page.getByPlaceholder(/course name/i);
  await expect(titleInput).toBeVisible();
  await expect(titleInput).toHaveJSProperty('validity.valueMissing', true);
});
