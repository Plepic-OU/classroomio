import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then } = createBdd();

When('I clear and fill the course title field with {string}', async ({ page }, title: string) => {
  const field = page.getByLabel(/course title/i);
  await field.clear();
  await field.fill(title);
});

When('I click save changes', async ({ page }) => {
  await page.getByRole('button', { name: /save changes/i }).click();
});
