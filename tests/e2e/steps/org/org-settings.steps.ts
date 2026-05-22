import { Given, When, Then } from '../../fixtures';

Given('I am on the org settings page', async ({ page }) => {
  await page.goto('/org/udemy-test/settings');
  await page.getByRole('heading', { name: /settings/i }).waitFor();
});

When('I update my full name to {string}', async ({ page }, fullName: string) => {
  await page.getByLabel(/full name/i).fill(fullName);
});

When('I save the profile settings', async ({ page }) => {
  await page.getByRole('button', { name: /update profile/i }).click();
});

Then('I should see {string} on the page', async ({ page }, text: string) => {
  await page.getByText(text).first().waitFor();
});
