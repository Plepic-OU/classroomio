import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('successful login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@test.com');
    await page.locator('input[type="password"]').fill('123456');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/org\//);
  });
});
