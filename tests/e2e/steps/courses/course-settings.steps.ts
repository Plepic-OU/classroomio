import { When, Then } from '../../fixtures';

When('I go to the course settings tab', async ({ page }) => {
  await page.getByRole('button', { name: /^settings$/i }).click();
  await page.waitForURL(/\/settings$/);
});

When('I update the course title to {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder('Write the course title here').fill(title);
});

When('I save the course settings', async ({ page }) => {
  await page.getByRole('button', { name: /save changes/i }).click();
});

Then('I should see {string} in the course header', async ({ page }, text: string) => {
  await page.getByText(text).first().waitFor();
});
