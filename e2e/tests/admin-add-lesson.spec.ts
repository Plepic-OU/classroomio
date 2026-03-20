import { test, expect } from '@playwright/test';

// Admin navigates to a course's Content page and creates a new lesson.
// Uses seed course "Getting started with MVC" (has existing lessons).
// The lesson creation navigates to /courses/[id]/lessons/[lessonId] on success.
test('admin adds a lesson to an existing course', async ({ page }) => {
  // Login as admin
  await page.goto('/login');
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\/.+/);

  // Navigate to the MVC course's lessons page directly
  const courseId = '98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e';
  await page.goto(`/courses/${courseId}/lessons`);
  await page.waitForTimeout(2000);

  // Verify we're on the content page — existing lessons should be visible
  await expect(page.getByRole('heading', { name: 'Lesson 1: Introduction to MVC Architecture' })).toBeVisible();

  // Click "Add" button to open the new lesson modal
  await page.getByRole('button', { name: 'Add' }).click();

  // Fill in the lesson title in the modal
  await page.getByLabel('Lesson Title').fill('Playwright Test Lesson');
  await page.getByRole('button', { name: 'Save' }).click();

  // After saving, the lesson appears in the sidebar and lesson list
  // Use exact link role to avoid strict mode (title appears in both sidebar and main content)
  await expect(page.getByRole('link', { name: 'Playwright Test Lesson', exact: true })).toBeVisible();
});
