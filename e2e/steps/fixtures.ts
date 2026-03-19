import { test as base, createBdd } from 'playwright-bdd';
import { getTestUserSession } from '../support/auth';

export const test = base.extend<{ authenticatedPage: typeof base }>({
  authenticatedPage: async ({ page }, use) => {
    const session = await getTestUserSession();

    await page.evaluate((s) => {
      localStorage.setItem('supabase.auth.token', JSON.stringify(s));
    }, session);

    await page.goto('/');
    await use(page as any);
  },
});

export const { Given, When, Then, Before, After, AfterAll } = createBdd(test);
