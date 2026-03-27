import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

// "I am logged in as an admin" is already defined in course-creation.steps.ts
// playwright-bdd shares step definitions across features, so no need to redefine

When('I navigate to the logout page', async ({ page }) => {
  await page.goto('/logout');
});

Then('I should be redirected to the login page', async ({ page }) => {
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
});
