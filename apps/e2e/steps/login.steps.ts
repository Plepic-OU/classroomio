import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ page }) => {
  await page.goto('/');
});

When('I enter my admin credentials', async ({ page }) => {
  await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com');
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD ?? '123456');
});

When('I enter invalid credentials', async ({ page }) => {
  await page.getByLabel('Email').fill('wrong@test.com');
  await page.getByLabel('Password').fill('wrongpassword');
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: /log in|sign in/i }).click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\//);
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.getByRole('alert')).toBeVisible();
});
