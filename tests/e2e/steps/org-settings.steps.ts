import { expect } from '@playwright/test';
import { Given, When, Then, waitForHydration } from './fixtures';

const nameInput = (page) => page.locator('label', { hasText: /^Organization Name/ }).locator('input');

async function goToOrgSettingsOrgTab(page) {
  await page.goto('/org/udemy-test/settings');
  await waitForHydration(page);
  const orgTab = page.getByRole('tab', { name: /organization/i });
  await expect(orgTab).toBeEnabled();
  await orgTab.click();
  // Wait for async store to populate before interacting with the name field
  await expect(nameInput(page)).not.toHaveValue('');
}

Given('I am on the organization settings page', async ({ page }) => {
  await goToOrgSettingsOrgTab(page);
});

When('I update the organization name to {string}', async ({ page }, name: string) => {
  const input = nameInput(page);
  await input.clear();
  await input.fill(name);
  await page.getByRole('button', { name: /update organization/i }).click();
});

When('I reload the organization settings page', async ({ page }) => {
  await page.reload();
  await waitForHydration(page);
  const orgTab = page.getByRole('tab', { name: /organization/i });
  await expect(orgTab).toBeEnabled();
  await orgTab.click();
  await expect(nameInput(page)).not.toHaveValue('');
});

Then('I should see a success notification', async ({ page }) => {
  await expect(page.getByText(/update successful/i)).toBeVisible();
});

Then('the organization name field should contain {string}', async ({ page }, name: string) => {
  await expect(nameInput(page)).toHaveValue(name);
});
