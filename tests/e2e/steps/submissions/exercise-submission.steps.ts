import { When, Then } from '../../fixtures';

When('I go to the submissions tab', async ({ page }) => {
  await page.getByRole('button', { name: /^submissions$/i }).click();
  await page.waitForURL(/\/submissions$/);
});

Then('I should see the submissions page heading', async ({ page }) => {
  await page.getByRole('heading', { name: /submitted exercises/i }).waitFor();
});
