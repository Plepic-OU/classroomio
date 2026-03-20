import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Given, Then } = createBdd(test);

Given('I am on the org settings page', async ({ page }) => {
  const { orgSlug } = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../.auth/context.json'), 'utf-8')
  );
  await page.goto(`/org/${orgSlug}/settings`);
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
});

Then('I should see the organization settings form', async ({ page }) => {
  // Verify the Settings heading and at least one tab is visible
  await expect(page.getByText(/settings/i).first()).toBeVisible();
  await expect(page.getByRole('tab').first()).toBeVisible();
});
