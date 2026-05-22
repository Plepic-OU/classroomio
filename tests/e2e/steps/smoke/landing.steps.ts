import { expect } from '@playwright/test';
import { Given, Then } from '../../fixtures/test';
import { waitForHydration } from '../../helpers/hydration';

Given('I open the login page', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);
});

Then('I see the Log in submit button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /log\s*in/i }).first()).toBeVisible();
});

Then('I see a Sign Up link pointing at {string}', async ({ page }, href: string) => {
  const link = page.getByRole('link', { name: /sign\s*up/i }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', new RegExp(`^${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});
