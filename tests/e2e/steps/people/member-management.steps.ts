import { When, Then } from '../../fixtures';

When('I go to the people tab', async ({ page }) => {
  await page.getByRole('button', { name: /^people$/i }).click();
  await page.waitForURL(/\/people/);
});

Then('I should see the people table', async ({ page }) => {
  await page.getByRole('table').waitFor();
});
