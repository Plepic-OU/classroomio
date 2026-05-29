import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

Given('I am on the organization settings page', async ({ page }) => {
  const url = page.url();
  const match = url.match(/\/org\/[^/?#]+/);
  if (!match) throw new Error('Not on an org page after login');
  await page.goto(`${match[0]}/settings?tab=org`);
  await page.waitForURL(/\/settings/);
  // The layout debounces a getProfile() call that runs getOrganizations() ~1s after
  // mount. If we interact before that settles the store gets reset mid-save. Wait
  // for the organizationmember response so the store is stable before we type.
  await page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/organizationmember') && resp.status() < 400,
    { timeout: 15000 }
  );
  await page.getByLabel('Organization Name').waitFor();
});

When('I update the organization name to {string}', async ({ page }, name: string) => {
  const input = page.getByLabel('Organization Name');
  await input.click({ clickCount: 3 });
  await input.pressSequentially(name, { delay: 30 });
  await input.blur();
});

When('I save the organization settings', async ({ page }) => {
  await page.getByRole('button', { name: /update organization/i }).click();
});

Then('I should see a success notification', async ({ page }) => {
  await page.locator('.bx--inline-notification--success').waitFor({ timeout: 20000 });
});

When('I reload the settings page', async ({ page }) => {
  await page.reload();
  await page.waitForURL(/\/settings/);
  await page.getByLabel('Organization Name').waitFor();
});

Then('the organization name field should show {string}', async ({ page }, name: string) => {
  await expect(page.getByLabel('Organization Name')).toHaveValue(name);
});
