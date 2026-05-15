import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then } = createBdd();

When('I open the lesson {string}', async ({ page }, title: string) => {
  await page.getByText(title, { exact: false }).click();
  await page.waitForLoadState('networkidle');
});

Then('I should see the exercises tab', async ({ page }) => {
  await expect(page.getByRole('tab', { name: /exercises/i })
    .or(page.getByRole('link', { name: /exercises/i }))).toBeVisible();
});
