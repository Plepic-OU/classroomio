import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

const ORG_SLUG = 'udemy-test';
const SETTINGS_URL = `/org/${ORG_SLUG}/settings`;

When('I navigate to the org settings page', async ({ page }) => {
  await page.goto(SETTINGS_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.getByLabel('Organization Name').waitFor({ timeout: 10_000 });
});

When('I update the organization name to {string}', async ({ page }, name: string) => {
  const field = page.getByLabel('Organization Name');
  await field.clear();
  await field.fill(name);
});

When('I click the update organization button', async ({ page }) => {
  await page.getByRole('button', { name: /update organization/i }).click();
});

Then('I should see a success notification', async ({ page }) => {
  await page.getByText('Update successful').waitFor({ timeout: 10_000 });
});

When('I reload the org settings page', async ({ page }) => {
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.getByLabel('Organization Name').waitFor({ timeout: 10_000 });
});

Then('the organization name field should contain {string}', async ({ page }, name: string) => {
  const field = page.getByLabel('Organization Name');
  await expect(field).toHaveValue(name, { timeout: 5_000 });
});

When('I restore the organization name to {string}', async ({ page }, name: string) => {
  const field = page.getByLabel('Organization Name');
  await field.clear();
  await field.fill(name);
});
