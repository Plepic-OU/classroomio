import { Given, When, Then } from '../../fixtures';
import { waitForHydration } from '../../helpers/hydration';

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);
});

When('I enter email {string}', async ({ page }, email: string) => {
  await page.getByPlaceholder('you@domain.com').fill(email);
});

When('I enter password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder('************').fill(password);
});

When('I click the login button', async ({ page }) => {
  // Use type="submit" to avoid matching the "Login with Google" button
  await page.locator('button[type="submit"]').click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await page.waitForURL(/\/org\//);
});

Then('I should see an error message', async ({ page }) => {
  // Login errors render as <p class="text-red-500"> not role="alert"
  await page.locator('p.text-red-500').waitFor();
});
