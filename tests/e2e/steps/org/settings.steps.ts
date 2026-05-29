import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then, Given } = createBdd();

let originalOrgName: string;

Given('I navigate to the org settings org tab', async ({ page }) => {
  const orgSlug = page.url().match(/\/org\/([^/?#]+)/)?.[1] ?? '*';
  await page.goto(`/org/${orgSlug}/settings?tab=org`);
  await page.waitForURL(new RegExp(`/org/.*/settings`));
  await page.waitForLoadState('domcontentloaded');
  const nameField = page.getByLabel(/organization name/i);
  await nameField.waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  let value = await nameField.inputValue();
  let attempts = 0;
  while (!value && attempts < 10) {
    await page.waitForTimeout(100);
    value = await nameField.inputValue();
    attempts++;
  }
});

When('I store the current organization name', async ({ page }) => {
  const nameField = page.getByLabel(/organization name/i);
  originalOrgName = (await nameField.inputValue()) || '';
});

When('I update the organization name to {string}', async ({ page }, newName: string) => {
  const nameField = page.getByLabel(/organization name/i);
  await nameField.clear();
  await nameField.fill(newName);
});

When('I click the update organization button', async ({ page }) => {
  const updateButton = page.getByRole('button', { name: /update organization/i });
  await updateButton.click();
  await page.waitForTimeout(500);
});

Then('I should see {string} in the organization name field', async ({ page }, expectedName: string) => {
  const nameField = page.getByLabel(/organization name/i);
  const displayedName = await nameField.inputValue();
  expect(displayedName?.trim()).toBe(expectedName.trim());
});

When('I restore the organization name to the original', async ({ page }) => {
  const nameField = page.getByLabel(/organization name/i);
  await nameField.clear();
  await nameField.fill(originalOrgName);
});

Then('I should see the original organization name in the field', async ({ page }) => {
  const nameField = page.getByLabel(/organization name/i);
  const displayedName = await nameField.inputValue();
  expect(displayedName?.trim()).toBe(originalOrgName.trim());
});
