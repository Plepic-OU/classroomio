import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Then } = createBdd();

Then('I should see a greeting with the admin name', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /elon gates/i })).toBeVisible();
});

Then('I should see the revenue card', async ({ page }) => {
  await expect(page.getByText('Revenue ($)')).toBeVisible();
});

Then('I should see the courses count card', async ({ page }) => {
  await expect(page.getByText(/number of courses/i)).toBeVisible();
});

Then('I should see the students count card', async ({ page }) => {
  await expect(page.getByText(/total students/i)).toBeVisible();
});
