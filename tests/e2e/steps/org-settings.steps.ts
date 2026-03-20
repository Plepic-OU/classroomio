import { expect } from '@playwright/test';
import { Given, When, Then, waitForHydration } from './fixtures';

Given('I am on the organization settings page', async ({ page }) => {
  await page.goto('/org/udemy-test/settings');
  await waitForHydration(page);
  // Wait for the Organization tab to become enabled (isOrgAdmin loads async)
  const orgTab = page.getByRole('tab', { name: /organization/i });
  await expect(orgTab).toBeEnabled();
  await orgTab.click();
});

When('I clear the organization name field', async ({ page }) => {
  await page.getByLabel(/organization name/i).clear();
});

When('I enter the organization name {string}', async ({ page }, name: string) => {
  await page.getByLabel(/organization name/i).fill(name);
});

When('I click the update organization button', async ({ page }) => {
  await page.getByRole('button', { name: /update organization/i }).click();
});

Then('I should see a success notification', async ({ page }) => {
  await expect(page.getByText(/update successful/i)).toBeVisible();
});

Then(
  'the organization name field should contain {string}',
  async ({ page }, name: string) => {
    await expect(page.getByLabel(/organization name/i)).toHaveValue(name);
  }
);
