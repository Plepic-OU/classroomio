import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I open the profile menu', async ({ page }) => {
  // Click the sidebar button containing the user's name
  const profileButton = page.locator('aside button').filter({ hasText: /gates/i });
  await profileButton.waitFor({ timeout: 5000 });
  await profileButton.click();
  // Wait for the profile menu to be visible
  await page.getByText(/log\s*out/i).waitFor();
});

When('I click the log out button', async ({ page }) => {
  await page.getByText(/log\s*out/i).click();
});

Then('I should be on the login page', async ({ page }) => {
  await page.waitForURL(/\/login/);
});
