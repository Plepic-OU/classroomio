import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

Given('I am on the signup page', async ({ page }) => {
  await page.goto('/signup');
  await page.locator('html[theme]').waitFor({ timeout: 10000 });
});

When('I fill in signup email {string}', async ({ page }, email: string) => {
  await page.getByLabel('Your email').fill(email);
});

When('I fill in signup password {string}', async ({ page }, password: string) => {
  await page.getByLabel('Your password').fill(password);
});

When('I confirm the password {string}', async ({ page }, password: string) => {
  await page.getByLabel('Confirm password').fill(password);
});

When('I click the create account button', async ({ page }) => {
  await page.getByRole('button', { name: /create account/i }).click();
});

Then('I should be redirected to onboarding', async ({ page }) => {
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });
  await page.locator('html[theme]').waitFor({ timeout: 10000 });
});

When('I fill in my full name {string}', async ({ page }, name: string) => {
  await page.getByLabel(/full name/i).fill(name);
});

When('I fill in organization name {string}', async ({ page }, orgName: string) => {
  await page.getByLabel(/name of organization/i).fill(orgName);
});

When('I click the next button', async ({ page }) => {
  await page.getByRole('button', { name: /continue/i }).click();
});

When('I select a goal', async ({ page }) => {
  await page.getByText('Sell courses online').click();
});

When('I select a source', async ({ page }) => {
  await page.getByText('Search engine').click();
});

When('I click the finish button', async ({ page }) => {
  await page.getByRole('button', { name: /continue/i }).click();
});

Then('I should be redirected to my org dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/org\//, { timeout: 15000 });
});
