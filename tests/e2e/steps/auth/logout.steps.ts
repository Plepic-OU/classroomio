import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I navigate to the logout page', async ({ page }) => {
  await page.goto('/logout');
});

Then('I should be redirected to the login page', async ({ page }) => {
  await page.waitForURL(/\/login/, { timeout: 10_000 });
});
