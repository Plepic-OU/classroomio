import { expect } from '@playwright/test';
import { Then } from './fixtures';

Then('I should see the dashboard greeting', async ({ page }) => {
  // Greeting is time-of-day dependent: "Good morning/afternoon/evening {fullname}!"
  await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible();
});

Then('I should see analytics cards for courses and students', async ({ page }) => {
  await expect(page.getByText(/number of courses/i)).toBeVisible();
  await expect(page.getByText(/total students/i)).toBeVisible();
});
