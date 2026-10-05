import type { Page } from '@playwright/test';

/**
 * Wait for SvelteKit client-side hydration of the current page.
 *
 * The login form is server-rendered with its final markup, so there is no DOM attribute that
 * flips on hydration. Until the client bundle has loaded and hydrated, clicking "Log In" would do
 * a native form submit (a GET reload of /login) instead of calling better-auth. In dev mode every
 * module is fetched separately, so "no network requests for 500ms" after load means the bundle
 * has been fetched and evaluated, which is when Svelte hydrates.
 */
export async function waitForHydration(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
}
