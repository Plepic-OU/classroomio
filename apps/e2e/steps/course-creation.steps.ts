import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

Given('I am logged in as an admin', async ({ page }) => {
  await page.goto('/login');
  await page.locator('html[theme]').waitFor({ timeout: 10000 });
  await page.getByLabel('Your email').fill(process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com');
  await page.getByLabel('Your password').fill(process.env.E2E_ADMIN_PASSWORD ?? '123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\//, { timeout: 15000 });
});

Given('I am on the org courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await expect(page).toHaveURL(/\/courses/);
});

When('I click {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I select course type {string}', async ({ page }, courseType: string) => {
  // Scope to the modal to avoid matching existing course type badges on course cards
  await page.locator('.dialog').getByRole('button', { name: new RegExp(courseType, 'i') }).click();
});

When('I fill in the course name {string}', async ({ page }, name: string) => {
  await page.getByLabel(/course name/i).fill(name);
});

When('I fill in the course description {string}', async ({ page }, description: string) => {
  // The description label has a button inside it so getByLabel doesn't work; use exact placeholder
  await page.getByPlaceholder('A little description about this course').fill(description);
});

When('I submit the form', async ({ page }) => {
  // Step 2 of the modal uses "Finish" as the submit button
  await page.locator('.dialog').getByRole('button', { name: /finish/i }).click();
});

Then('I should be on the new course detail page', async ({ page }) => {
  await expect(page).toHaveURL(/\/courses\/.+/);
});
