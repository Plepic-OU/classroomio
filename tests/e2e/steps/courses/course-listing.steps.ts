import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I navigate to the courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await page.waitForURL(/\/courses/);
});

Then('I should see the courses heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /courses/i })).toBeVisible();
});

Then('I should see the {string} button', async ({ page }, buttonName: string) => {
  await expect(page.getByRole('button', { name: new RegExp(buttonName, 'i') })).toBeVisible();
});
