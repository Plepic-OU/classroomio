import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

Given('I am logged in as an admin', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com');
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD ?? '123456');
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page).toHaveURL(/\/org\//);
});

Given('I am on the org courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await expect(page).toHaveURL(/\/courses/);
});

When('I click {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I select course type {string}', async ({ page }, courseType: string) => {
  await page.getByText(courseType).click();
});

When('I fill in the course name {string}', async ({ page }, name: string) => {
  await page.getByLabel(/course name/i).fill(name);
});

When('I fill in the course description {string}', async ({ page }, description: string) => {
  await page.getByLabel(/description/i).fill(description);
});

When('I submit the form', async ({ page }) => {
  await page.getByRole('button', { name: /create|submit/i }).last().click();
});

Then('I should be on the new course detail page', async ({ page }) => {
  await expect(page).toHaveURL(/\/courses\/.+/);
});
