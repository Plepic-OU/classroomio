import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

Given('I am on the org settings page', async ({ page }) => {
  const orgSlug = process.env.E2E_ORG_SLUG ?? 'udemy-test';
  await page.goto(`/org/${orgSlug}/settings`);
  await page.locator('html[theme]').waitFor({ timeout: 10000 });
  await expect(page).toHaveURL(/settings/, { timeout: 10000 });
});

When('I update the organization name to {string}', async ({ page }, name: string) => {
  const field = page.getByLabel('Organization Name');
  await field.clear();
  await field.fill(name);
});

When('I save the organization settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Update Organization' }).click();
});

Then('the organization name should be {string} after reload', async ({ page }, name: string) => {
  await page.reload();
  await page.locator('html[theme]').waitFor({ timeout: 10000 });
  await expect(page.getByLabel('Organization Name')).toHaveValue(name, { timeout: 10000 });
});

Then('I restore the organization name to {string}', async ({ page }, name: string) => {
  const field = page.getByLabel('Organization Name');
  await field.clear();
  await field.fill(name);
  await page.getByRole('button', { name: 'Update Organization' }).click();
});
