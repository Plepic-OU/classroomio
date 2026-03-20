import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I navigate to the logout page', async ({ page }) => {
  await page.goto('/logout');
});

Then('I should be on the login page', async ({ page }) => {
  await expect(page).toHaveURL(/\/login/);
});
