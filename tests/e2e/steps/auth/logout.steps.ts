import { Given, When, Then } from '../../fixtures';
import { TEST_USERS } from '../../helpers/test-users';

Given('I am on the org dashboard', async ({ page }) => {
  await page.waitForURL(/\/org\//);
});

When('I log out', async ({ page }) => {
  // Open the profile menu by clicking the user's name in the sidebar
  await page.getByText(TEST_USERS.admin.fullname).first().click();
  // Click the Log out button inside the profile menu popover
  await page.getByRole('button', { name: /log\s*out/i }).click();
});

Then('I should be redirected to the login page', async ({ page }) => {
  await page.waitForURL(/\/login/);
});
