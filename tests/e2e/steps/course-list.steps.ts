import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Then } = createBdd();

Then('the courses page should show {string}', async ({ page }, courseName: string) => {
  // Course cards render the title as an <h3> heading — use getByRole('heading')
  // to avoid strict mode violations (getByText also matches the description <p>).
  await expect(page.getByRole('heading', { name: courseName })).toBeVisible();
});
