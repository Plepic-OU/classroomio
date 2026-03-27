import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given: given, When: when, Then: then } = createBdd();

const ORIGINAL_ORG_NAME = 'Test Organization';

given('I am on the organization settings tab', async ({ page }) => {
  // Navigate directly with ?tab=org — Carbon Tabs renders all tabpanels regardless of
  // disabled state, and the reactive $: block picks up the tab query param.
  await page.goto('/org/testorg/settings?tab=org', { waitUntil: 'domcontentloaded' });
  // Wait for the org name field to be visible and populated (store data loaded)
  const nameInput = page.getByLabel('Organization Name');
  await expect(nameInput).toBeVisible({ timeout: 8000 });
  await expect(nameInput).not.toHaveValue('', { timeout: 5000 });
});

when('I update the organization name to {string}', async ({ page }, newName: string) => {
  const nameInput = page.getByLabel('Organization Name');
  await nameInput.clear();
  await nameInput.fill(newName);
});

then('I should see the update success notification', async ({ page }) => {
  const notification = page.locator('.root.absolute').first();
  await expect(notification).toBeVisible({ timeout: 5000 });
});

when('I reload the page', async ({ page }) => {
  // Reload preserves the ?tab=org query param, so the Organization content stays visible.
  // The tab may show as aria-disabled until isOrgAdmin resolves, but the content is rendered.
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Wait for the org name field to appear with data loaded
  await expect(page.getByLabel('Organization Name')).toBeVisible({ timeout: 8000 });
});

then('the organization name should be {string}', async ({ page }, expectedName: string) => {
  const nameInput = page.getByLabel('Organization Name');
  await expect(nameInput).toHaveValue(expectedName, { timeout: 5000 });
});

when('I restore the original organization name', async ({ page }) => {
  const nameInput = page.getByLabel('Organization Name');
  await nameInput.clear();
  await nameInput.fill(ORIGINAL_ORG_NAME);
});
