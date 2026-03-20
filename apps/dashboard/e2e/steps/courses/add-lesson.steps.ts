import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the lessons page for course {string}', async ({ page }, courseId: string) => {
  await page.goto(`/courses/${courseId}/lessons`);
  // Wait for the lesson list or empty state to render
  await expect(page.getByText(/content/i).first()).toBeVisible({ timeout: 15000 });
});

When('I click the add lesson button', async ({ page }) => {
  // Button text is just "Add" (translated from button_title key)
  await page.getByRole('button', { name: /^add$/i }).click();
});

When('I fill in the lesson title {string}', async ({ page }, title: string) => {
  // The modal's TextField has autoFocus — find the visible input in the modal
  const input = page.locator('input[type="text"]').last();
  await expect(input).toBeVisible();
  await input.fill(title);
});

When('I save the lesson', async ({ page }) => {
  await page.getByRole('button', { name: /save/i }).click();
});

Then(
  'I should see the lesson {string} in the content list',
  async ({ page }, title: string) => {
    // The lesson should appear in the sidebar content list
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });
  }
);
