import { expect, type Page } from '@playwright/test';
import { TEST_USERS } from './test-users';

export async function loginAs(page: Page, email: string) {
  const user = Object.values(TEST_USERS).find((u) => u.email === email);
  if (!user) throw new Error(`Unknown test user: ${email}`);
  await page.goto('/login');
  // Hydration signal per design §4.4 — `input[type="email"]` is the
  // SvelteKit CSR-attached form state (SSR renders type="text"; the
  // use:typeAction directive flips it after hydration). Waiting on
  // `getByRole('textbox')` is insufficient — both states match. Using a
  // web-first assertion preserves auto-wait semantics.
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.getByPlaceholder('you@domain.com').fill(user.email);
  await page.getByPlaceholder('************').fill(user.password);
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
  await page.waitForURL(/\/org\//);
}
