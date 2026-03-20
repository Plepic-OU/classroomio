import { test as base } from 'playwright-bdd';
import { Page } from '@playwright/test';

export const test = base.extend<{ adminPage: Page; orgSlug: string }>({
  // storageState from globalSetup means the page context is already authenticated.
  adminPage: async ({ page }, use) => {
    await use(page);
  },
  orgSlug: async ({ adminPage }, use) => {
    // Navigate to root and let SvelteKit redirect to the org page to capture the slug.
    await adminPage.goto('/');
    await adminPage.waitForURL('**/org/**');
    const slug = new URL(adminPage.url()).pathname.split('/')[2];
    await use(slug);
  },
});
