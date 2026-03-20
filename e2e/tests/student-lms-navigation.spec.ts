import { test, expect } from '@playwright/test';

// Student logs in and navigates the LMS: dashboard → My Learning → course lessons.
// Uses seed student (student@test.com) who is enrolled in "Data Science with Python and Pandas".
test('student navigates LMS dashboard and opens a course', async ({ page }) => {
  // Login as student
  await page.goto('/login');
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('you@domain.com').fill('student@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/lms/);

  // LMS dashboard shows greeting with student's name
  await expect(page.getByRole('heading', { name: /John Doe/ })).toBeVisible();

  // Navigate to My Learning via sidebar
  await page.getByText('My Learning').click();
  await expect(page).toHaveURL(/\/lms\/mylearning/);

  // Should see enrolled course — use heading selector to avoid matching description too
  const courseHeading = page.getByRole('heading', { name: 'Data Science with Python and Pandas' });
  await expect(courseHeading).toBeVisible();

  // Click the course card (the heading's parent button wrapper)
  await courseHeading.click();

  // Clicking the card navigates to the course overview page
  await expect(page).toHaveURL(/\/courses\/.+/);
});
