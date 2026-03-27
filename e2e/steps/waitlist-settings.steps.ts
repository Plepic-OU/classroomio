import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When(
  'I navigate to settings for course {string}',
  async ({ page }, courseTitle: string) => {
    // Navigate to courses page first
    await page.getByRole('link', { name: 'Courses' }).click();
    await expect(page).toHaveURL(/\/courses/);

    // Click the course card
    await page.getByRole('heading', { name: courseTitle }).click();
    await expect(page).toHaveURL(/\/courses\/[a-f0-9-]+/);

    // Navigate to settings tab
    await page.getByText('Settings').click();
    await expect(page).toHaveURL(/\/settings/);
  }
);

When('I set max capacity to {string}', async ({ page }, capacity: string) => {
  const input = page.locator('input[type="number"]');
  await input.fill(capacity);
});

When('I save the course settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Save' }).click();
});

Then('the settings should save successfully', async ({ page }) => {
  // The snackbar shows "Saved successfully"
  await expect(page.getByText('Saved successfully')).toBeVisible();
});
