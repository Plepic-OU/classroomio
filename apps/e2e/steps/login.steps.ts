import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  // Wait for Carbon's Theme component to set theme attribute on <html>
  // This signals Svelte has hydrated and on:submit handlers are attached
  await page.locator('html[theme]').waitFor({ timeout: 10000 });
});

When('I enter my admin credentials', async ({ page }) => {
  await page.getByLabel('Your email').fill(process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com');
  await page.getByLabel('Your password').fill(process.env.E2E_ADMIN_PASSWORD ?? '123456');
});

When('I enter invalid credentials', async ({ page }) => {
  await page.getByLabel('Your email').fill('wrong@test.com');
  await page.getByLabel('Your password').fill('wrongpassword');
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: 'Log In' }).click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\//, { timeout: 15000 });
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.locator('p.text-red-500')).toBeVisible();
});
