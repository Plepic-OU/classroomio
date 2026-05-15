import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Then } = createBdd();

Then('I should see {string} on the page', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false })).toBeVisible();
});

Then('I should not see {string} on the page', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false })).not.toBeVisible();
});
