import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { TEST_USERS } from './test-users';
import { waitForLoginHydration } from './hydration';

export async function loginAs(
  page: Page,
  email: string,
  expectedUrlPattern: RegExp = /\/(org|lms)(\/|$)/
) {
  const user = Object.values(TEST_USERS).find(u => u.email === email);
  if (!user) throw new Error(`Unknown test user: ${email}`);
  await page.goto('/login');
  await waitForLoginHydration(page);
  await page.getByPlaceholder('you@domain.com').fill(user.email);
  await page.getByPlaceholder('************').fill(user.password);
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
  await expect(page).toHaveURL(expectedUrlPattern, { timeout: 15_000 });
}
