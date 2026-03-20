import { test, expect } from '../fixtures/base';

test.describe('Course creation', () => {
  test.afterAll(async ({ supabaseAdmin }) => {
    await supabaseAdmin.from('course').delete().like('title', 'Test Course%');
  });

  test('create a new course', async ({ authenticatedPage: page }) => {
    // Navigate to the courses page
    await page.goto('/org/udemy-test/courses');

    // Wait for the Create Course button to become enabled (org admin check resolves async)
    const createBtn = page.getByRole('button', { name: 'Create Course' });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Wait for the modal to open
    const modal = page.locator('.dialog');
    await modal.waitFor({ state: 'visible' });

    // Step 0: "Live Class" is already selected by default — click Next
    await modal.getByRole('button', { name: 'Next' }).click();

    // Step 1: Fill course name and description (both required)
    await page.getByPlaceholder('Your course name').fill('Test Course');
    await page
      .getByPlaceholder('A little description about this course')
      .fill('Automated E2E test course');
    await page.getByRole('button', { name: 'Finish' }).click();

    // Expect redirect to course detail page
    await expect(page).toHaveURL(/\/courses\//);
  });
});
