import { expect } from '@playwright/test';
import { Given, When, Then, waitForHydration } from './fixtures';

Given('I am on the profile settings page', async ({ page }) => {
  await page.goto('/org/udemy-test/settings');
  await waitForHydration(page);
  // Wait for profile store to populate -- the Full Name field gets its value async
  const fullNameInput = page.locator('label', { hasText: /^Full Name/ }).locator('input');
  await expect(fullNameInput).not.toHaveValue('');
});

When('I clear the full name field', async ({ page }) => {
  const input = page.locator('label', { hasText: /^Full Name/ }).locator('input');
  await input.clear();
});

When('I enter the full name {string}', async ({ page }, name: string) => {
  const input = page.locator('label', { hasText: /^Full Name/ }).locator('input');
  await input.fill(name);
});

When('I click the update profile button', async ({ page }) => {
  await page.getByRole('button', { name: /update profile/i }).click();
});

Then(
  'the full name field should contain {string}',
  async ({ page }, name: string) => {
    await expect(
      page.locator('label', { hasText: /^Full Name/ }).locator('input')
    ).toHaveValue(name);
  }
);
