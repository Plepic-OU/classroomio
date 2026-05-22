import { When, Then } from '../../helpers/fixtures';
import { TEST_USERS } from '../../helpers/test-users';

When('I navigate to the logout page', async ({ page }) => {
  await page.goto('/logout');
});

// After verifying the redirect, re-authenticate so that .auth/admin.json holds a
// fresh, valid session. supabase.auth.signOut() uses global scope by default,
// which revokes all server-side sessions; without this step every subsequent
// @auth-admin test would get a 401 from the API.
Then('I should be redirected to the login page', async ({ page, context }) => {
  await page.waitForURL(/\/login/);
  await page.getByPlaceholder('you@domain.com').fill(TEST_USERS.admin.email);
  await page.getByPlaceholder('************').fill(TEST_USERS.admin.password);
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
  await page.waitForURL(/\/org\//);
  await context.storageState({ path: '.auth/admin.json' });
});
