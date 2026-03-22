import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

Then('I should be on the LMS dashboard', async ({ page }) => {
  await page.waitForURL(/\/lms/);
});

Then('I should see a greeting with my name', async ({ page }) => {
  // The greeting heading contains the user's name
  await expect(page.getByRole('heading', { name: /john doe/i })).toBeVisible();
});

When('I click on {string}', async ({ page }, linkText: string) => {
  await page.getByRole('link', { name: new RegExp(linkText, 'i') }).click();
});

Then('I should be on the My Learning page', async ({ page }) => {
  await page.waitForURL(/\/lms\/mylearning/);
});
