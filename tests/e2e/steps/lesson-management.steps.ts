import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

// Seeded course IDs from supabase/seed.sql
const COURSE_IDS: Record<string, string> = {
  'Modern Web Development with React': '16e3bc8d-5d1b-4708-988e-93abae288ccf',
  'Data Science with Python and Pandas': 'f0a85d18-aff4-412f-b8e6-3b34ef098dce'
};

Given('I am on the lessons page for course {string}', async ({ page }, courseName: string) => {
  const courseId = COURSE_IDS[courseName];
  await page.goto(`/courses/${courseId}/lessons`);
  // Wait for the course container to finish loading
  await page.waitForURL(`/courses/${courseId}/lessons`);
});

Then('the add lesson modal should open', async ({ page }) => {
  await expect(page.getByText('Add New Lesson')).toBeVisible();
});

When('I fill in the lesson title {string}', async ({ page }, title: string) => {
  // The add-lesson modal has autoFocus on its title input. Scope to .dialog to avoid
  // matching unrelated inputs elsewhere on the page.
  await page.locator('.dialog').getByRole('textbox').fill(title);
});

When('I save the lesson', async ({ page }) => {
  await page.getByRole('button', { name: 'Save' }).click();
});

Then('I should be navigated to the new lesson page', async ({ page }) => {
  // After saving, goto('/courses/[id]/lessons/[lessonId]') is called
  await page.waitForURL(/\/courses\/.+\/lessons\/.+/);
  await expect(page).toHaveURL(/\/courses\/.+\/lessons\/.+/);
});
