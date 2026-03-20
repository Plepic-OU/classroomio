import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Then, When } = createBdd();

Then('I should see a greeting with {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('heading', { level: 1 }).filter({ hasText: name })).toBeVisible();
});

Then('I should see the {string} section', async ({ page }, sectionTitle: string) => {
  await expect(page.getByRole('heading', { name: sectionTitle })).toBeVisible();
});

When('I click the courses navigation link', async ({ page }) => {
  await page.getByRole('link', { name: 'Courses' }).click();
});

Then('I should be on the courses page', async ({ page }) => {
  await expect(page).toHaveURL(/\/courses/);
});

Then('I should see the {string} heading', async ({ page }, heading: string) => {
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
});
