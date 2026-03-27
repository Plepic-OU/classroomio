import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Given, When, Then } = createBdd(test);

function getOrgSlug(): string {
  const { orgSlug } = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../.auth/context.json'), 'utf-8')
  );
  return orgSlug;
}

Given('I am on the org settings page', async ({ page }) => {
  const orgSlug = getOrgSlug();
  await page.goto(`/org/${orgSlug}/settings`);
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
});

Then('I should see the organization settings form', async ({ page }) => {
  await expect(page.getByText(/settings/i).first()).toBeVisible();
  await expect(page.getByRole('tab').first()).toBeVisible();
});

When('I change the organization name to {string}', async ({ page }, newName: string) => {
  // TextField wraps the input in a <label> — find the input inside the label containing "Organization Name"
  const orgNameInput = page
    .locator('label')
    .filter({ has: page.getByText(/organization name/i) })
    .locator('input');
  await orgNameInput.clear();
  await orgNameInput.fill(newName);
});

When('I click the update organization button', async ({ page }) => {
  await page.getByRole('button', { name: /update organization/i }).click();
});

Then('I should see a success notification', async ({ page }) => {
  await expect(page.getByText(/update successful/i)).toBeVisible({ timeout: 10000 });
});

When('I reload the org settings page', async ({ page }) => {
  const orgSlug = getOrgSlug();
  await page.goto(`/org/${orgSlug}/settings`);
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
});

Then('the organization name should be {string}', async ({ page }, expectedName: string) => {
  const orgNameInput = page
    .locator('label')
    .filter({ has: page.getByText(/organization name/i) })
    .locator('input');
  await expect(orgNameInput).toHaveValue(expectedName, { timeout: 10000 });
});

Then('I restore the original organization name', async ({ page }) => {
  const orgNameInput = page
    .locator('label')
    .filter({ has: page.getByText(/organization name/i) })
    .locator('input');
  await orgNameInput.clear();
  await orgNameInput.fill('Udemy Test');
  await page.getByRole('button', { name: /update organization/i }).click();
  await expect(page.getByText(/update successful/i)).toBeVisible({ timeout: 10000 });
});
