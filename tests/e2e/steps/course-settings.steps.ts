import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

const COURSE_IDS: Record<string, string> = {
  'Modern Web Development with React': '16e3bc8d-5d1b-4708-988e-93abae288ccf',
  'Data Science with Python and Pandas': 'f0a85d18-aff4-412f-b8e6-3b34ef098dce'
};

Given('I am on the settings page for course {string}', async ({ page }, courseName: string) => {
  const courseId = COURSE_IDS[courseName];
  await page.goto(`/courses/${courseId}/settings`);
  await page.waitForURL(`/courses/${courseId}/settings`);
  // Course data loads asynchronously into $settings store. Wait for the title field to be
  // populated before proceeding — otherwise handleSave exits early due to empty validation.
  await expect(page.getByRole('textbox').first()).not.toBeEmpty();
});

Then(
  'I should see a success notification with text {string}',
  async ({ page }, message: string) => {
    // Snackbar uses Carbon InlineNotification. The subtitle holds the translated message.
    // The notification appears briefly — use toBeVisible() before it auto-hides.
    await expect(page.getByText(message).first()).toBeVisible();
  }
);
