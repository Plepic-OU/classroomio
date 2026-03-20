import { test, expect } from '@playwright/test';

test('user logs in with valid credentials', async ({ page }) => {
  await page.goto('/login');

  // SvelteKit v1 SSR renders the form before hydration. The form elements
  // are visible and actionable (Playwright's auto-wait passes), but Svelte's
  // on:submit|preventDefault handler isn't attached until client JS hydrates.
  // Without this wait, clicking "Log In" triggers a native GET submit → /login?.
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page).toHaveURL(/\/org\/.+/);
});
