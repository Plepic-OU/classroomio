import type { Page } from '@playwright/test';

/**
 * Wait for SvelteKit + Svelte client-side hydration on the login page.
 * SSR renders inputs without a type attribute. After hydration, the
 * use:typeAction directive sets type="email". Waiting for that selector via
 * locator API (not eval) is the CSP-safe signal that Svelte event handlers
 * are wired and the form is safe to interact with.
 * 60s timeout covers Vite cold-start on the first test run.
 */
export async function waitForHydration(page: Page) {
  await page.locator('input[type="email"]').waitFor({ timeout: 60_000 });
}
