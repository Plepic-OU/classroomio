import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given: given, Then: then } = createBdd();

given('I am on the org settings page', async ({ page }) => {
  await page.goto('/org/testorg/settings');
  // Wait for SvelteKit hydration
  await page.waitForTimeout(1000);
});

then('I should see the profile form with user data', async ({ page }) => {
  // Verify the profile tab is active and form fields are populated
  await expect(page.getByText('Profile Picture')).toBeVisible();
  await expect(page.getByText('Personal Information')).toBeVisible();

  // TextField wraps input in <label> with <p> for label text — getByLabel works
  const fullNameInput = page.getByLabel('Full Name');
  await expect(fullNameInput).toBeVisible();
  await expect(fullNameInput).toHaveValue('Test User');

  const usernameInput = page.getByLabel('Username');
  await expect(usernameInput).toBeVisible();
  await expect(usernameInput).toHaveValue('testuser');
});

then('I should see the {string} button', async ({ page }, buttonName: string) => {
  await expect(page.getByRole('button', { name: buttonName })).toBeVisible();
});
