import { test, expect } from '../fixtures/base';

const ORG_SLUG = 'udemy-test';

test.describe('Logout', () => {
  test('log out from the org sidebar', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/courses`);

    // The sidebar profile button shows the user's fullname. Click it to open the profile menu.
    // The button is a <button> in the sidebar containing the user's fullname text.
    const profileBtn = page.getByRole('button').filter({ hasText: 'Elon Gates' });
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    // "Log out" text comes from translation key settings.profile.logout
    const logoutBtn = page.getByText('Log out', { exact: true });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // After logout, redirected to /login
    await expect(page).toHaveURL(/\/login/);
  });
});
