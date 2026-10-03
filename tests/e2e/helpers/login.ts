import { expect, type Page } from '@playwright/test';
import { TEST_USERS } from './test-users';

/**
 * Log in without driving the form: sign in through the dashboard's same-origin auth proxy
 * (`/api/auth/*` → API better-auth), which stores the session cookie on the page origin and
 * avoids Svelte hydration races on the bound login fields. Use this for scenarios that only need
 * a logged-in user; the login feature itself drives the real form.
 */
export async function loginAs(page: Page, baseURL: string, email: string) {
  const user = Object.values(TEST_USERS).find((u) => u.email === email);
  if (!user) throw new Error(`Unknown test user: ${email}`);

  const response = await page.request.post('/api/auth/sign-in/email', {
    data: { email: user.email, password: user.password },
    headers: { Origin: baseURL }
  });
  expect(response.ok(), `sign-in as ${email} failed: ${response.status()}`).toBeTruthy();

  await page.goto('/');
  await page.waitForURL(/\/org\//);
}
