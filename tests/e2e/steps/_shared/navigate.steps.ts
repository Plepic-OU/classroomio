import { expect } from '@playwright/test';
import { Given } from '../../helpers/fixtures';

Given('I am on the org dashboard', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/org\//);
  await expect(page.locator('aside').first()).toBeVisible();
});
