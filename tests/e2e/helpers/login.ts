import type { Page } from '@playwright/test';
import { TEST_USERS } from './test-users';
import { waitForHydration } from './hydration';

export async function loginAs(page: Page, email: string) {
  const user = Object.values(TEST_USERS).find(u => u.email === email);
  if (!user) throw new Error(`Unknown test user: ${email}`);
  await page.goto('/login');
  await waitForHydration(page);
  await page.getByPlaceholder('you@domain.com').fill(user.email);
  await page.getByPlaceholder('************').fill(user.password);
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
  // Students redirect to /lms, admins/teachers redirect to /org/<slug>
  await page.waitForURL(/\/(org\/|lms)/);
}
