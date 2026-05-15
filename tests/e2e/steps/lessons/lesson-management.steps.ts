import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then } = createBdd();

When('I click the add lesson button', async ({ page }) => {
  await page.getByRole('button', { name: /^add$/i }).click();
});

When('I enter the lesson title {string}', async ({ page }, title: string) => {
  await page.getByLabel(/lesson title/i).fill(title);
});

When('I save the new lesson', async ({ page }) => {
  await page.getByRole('button', { name: /^save$/i }).click();
});

When('I save the new lesson without a title', async ({ page }) => {
  await page.getByRole('button', { name: /^save$/i }).click();
});

Then('I should see a lesson title error', async ({ page }) => {
  await expect(page.getByText(/title cannot be empty/i)).toBeVisible();
});
