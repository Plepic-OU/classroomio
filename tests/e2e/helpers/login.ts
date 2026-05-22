import type { Page } from '@playwright/test';
import { TEST_USERS, userByEmail } from './test-users';
import { waitForHydration } from './hydration';

export async function loginAs(page: Page, email: string) {
  const user = userByEmail(email);
  // Admin lands on /org/<slug>; student lands on /lms. Mirrors uiLogin in
  // fixtures/storage-state.ts so loginAs works for both personas.
  const landingPattern =
    email === TEST_USERS.student.email ? /\/lms(\/|$|\?)/ : /\/org\//;
  await page.goto('/login');
  await waitForHydration(page);
  await page.getByPlaceholder('you@domain.com').fill(user.email);
  await page.getByPlaceholder('************').fill(user.password);
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
  await page.waitForURL(landingPattern);
}
