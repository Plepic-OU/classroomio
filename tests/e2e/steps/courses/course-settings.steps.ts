import { expect } from '@playwright/test';
import { Given, When, Then } from '../../helpers/fixtures';

Given('I create a course named {string}', async ({ page }, title: string) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await page.waitForURL(/\/courses/);
  await page.getByRole('button', { name: /create course/i }).click();
  await page.getByRole('button', { name: /next/i }).click();
  await page.getByPlaceholder(/course name/i).fill(title);
  await page.getByPlaceholder(/a little description/i).fill('Test description');
  await page.getByRole('button', { name: /finish/i }).click();
  await page.waitForURL(/\/courses\/[^/]+$/, { timeout: 15_000 });
});

When('I navigate to the course settings', async ({ page }) => {
  const courseId = page.url().match(/\/courses\/([^/]+)/)?.[1];
  await page.goto(`/courses/${courseId}/settings`);
  await page.waitForURL(/\/settings/);
  const titleInput = page.getByPlaceholder('Write the course title here');
  await expect(titleInput).toBeVisible();
  // Wait for $course to load and populate $settings (including course_description)
  await expect(titleInput).not.toHaveValue('', { timeout: 10_000 });
});

When('I update the course title to {string}', async ({ page }, title: string) => {
  const titleInput = page.getByPlaceholder('Write the course title here');
  await titleInput.clear();
  await titleInput.fill(title);
});

When('I save the course settings', async ({ page }) => {
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText('Saved successfully')).toBeVisible();
});

Then('the course title should be {string}', async ({ page }, expectedTitle: string) => {
  await expect(page.getByPlaceholder('Write the course title here')).toHaveValue(expectedTitle);
});
